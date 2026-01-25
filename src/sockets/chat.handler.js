const logger = require('../utils/logger');
const { verifyToken } = require('../utils/jwt');
const companyRepository = require('../repositories/company.repository');
const chatService = require('../services/chat.service');
const supportChatRepository = require('../repositories/supportChat.repository');
const redis = require('../config/redis');

// Valkey keys for socket presence and room membership
const ONLINE_SOCKETS_KEY = 'chat:online:sockets';
const SOCKET_META_KEY = (socketId) => `chat:socket:${socketId}:meta`;
const SOCKET_ROOMS_KEY = (socketId) => `chat:socket:${socketId}:rooms`;
const ROOM_SOCKETS_KEY = (roomId) => `chat:room:${roomId}:sockets`;

// Presence TTL to avoid stale sockets on abrupt disconnects
const SOCKET_TTL_SECONDS = 24 * 60 * 60;

const nowEpochSeconds = () => Math.floor(Date.now() / 1000);

const trackOnlineSocket = async (socketId, userId, companyId) => {
  const expiresAt = nowEpochSeconds() + SOCKET_TTL_SECONDS;
  const pipeline = redis.pipeline();
  pipeline.zadd(ONLINE_SOCKETS_KEY, expiresAt, socketId);
  pipeline.hset(SOCKET_META_KEY(socketId), {
    userId: String(userId),
    companyId: companyId ? String(companyId) : '',
  });
  pipeline.expire(SOCKET_META_KEY(socketId), SOCKET_TTL_SECONDS);
  pipeline.expire(SOCKET_ROOMS_KEY(socketId), SOCKET_TTL_SECONDS);
  await pipeline.exec();
};

const trackRoomJoin = async (socketId, roomId) => {
  const expiresAt = nowEpochSeconds() + SOCKET_TTL_SECONDS;
  const pipeline = redis.pipeline();
  pipeline.zadd(ROOM_SOCKETS_KEY(roomId), expiresAt, socketId);
  pipeline.sadd(SOCKET_ROOMS_KEY(socketId), String(roomId));
  pipeline.expire(SOCKET_ROOMS_KEY(socketId), SOCKET_TTL_SECONDS);
  await pipeline.exec();
};

const trackRoomLeave = async (socketId, roomId) => {
  const pipeline = redis.pipeline();
  pipeline.zrem(ROOM_SOCKETS_KEY(roomId), socketId);
  pipeline.srem(SOCKET_ROOMS_KEY(socketId), String(roomId));
  await pipeline.exec();
};

const cleanupSocketPresence = async (socketId) => {
  try {
    const roomIds = await redis.smembers(SOCKET_ROOMS_KEY(socketId));
    const pipeline = redis.pipeline();
    pipeline.zrem(ONLINE_SOCKETS_KEY, socketId);
    pipeline.del(SOCKET_META_KEY(socketId));
    pipeline.del(SOCKET_ROOMS_KEY(socketId));

    if (roomIds?.length) {
      roomIds.forEach((roomId) => pipeline.zrem(ROOM_SOCKETS_KEY(roomId), socketId));
    }

    await pipeline.exec();
  } catch (error) {
    logger.error({ err: error, socketId }, 'Failed to cleanup socket presence');
  }
};

/**
 * Authenticate socket connection using JWT from handshake
 */
const authenticateSocket = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = await verifyToken(token); // ✅ await promise
    if (!decoded) {
      return next(new Error('Authentication failed'));
    }

    const company = await companyRepository.findByAgentId(decoded.id);
    socket.userId = decoded.id;
    socket.companyId = company?.id;
    socket.company = company ? { id: company.id, name: company.name, logo: company.logo } : null;
    socket.user = decoded;

    next();
  } catch (error) {
    logger.error({ err: error }, 'Socket authentication failed');
    next(new Error('Authentication failed'));
  }
};

/**
 * Register chat socket handlers
 */
const registerChatHandlers = (io, socket) => {
  const { userId, companyId, company } = socket;

  // Track online user
  trackOnlineSocket(socket.id, userId, companyId).catch((error) =>
    logger.error({ err: error, socketId: socket.id }, 'Failed to track online socket')
  );

  // Join user-specific and company-specific rooms for notifications
  socket.join(`user:${userId}`);
  if (companyId) {
    socket.join(`company:${companyId}`);
  }

  // Auto-join all channels on connect (B2B rooms + active support room)
  const autoJoinAllChannels = async () => {
    const result = {
      b2bRoomIds: [],
      supportRoomId: null,
      error: null,
    };

    try {
      // 1. Auto-join all active B2B chat rooms
      if (companyId) {
        const b2bRoomIds = await chatService.getActiveRoomIds(companyId);
        for (const roomId of b2bRoomIds) {
          socket.join(`room:${roomId}`);
          await trackRoomJoin(socket.id, roomId);
        }
        result.b2bRoomIds = b2bRoomIds;
      }

      // 2. Auto-join active support chat room (if any)
      const supportRoom = await supportChatRepository.findActiveRoomByUserId(userId);
      if (supportRoom) {
        socket.join(`support:room:${supportRoom.id}`);
        result.supportRoomId = supportRoom.id;
      }

      socket.emit('chat:ready', result);
      logger.debug(
        {
          socketId: socket.id,
          userId,
          companyId,
          b2bRoomCount: result.b2bRoomIds.length,
          supportRoomId: result.supportRoomId,
        },
        'User auto-joined all channels'
      );
    } catch (error) {
      logger.error({ err: error, socketId: socket.id }, 'Failed to auto-join channels');
      result.error = 'Failed to load channels';
      socket.emit('chat:ready', result);
    }
  };

  autoJoinAllChannels();

  /**
   * Send a message
   * @event chat:message
   * @param {Object} data - { roomId: number, text?: string, attachmentFileId?: number }
   * Client usage: emit after optional upload; use `text` or `messageText` and/or `attachmentFileId`.
   * Server behavior: persists message and broadcasts `chat:message` to the room.
   */
  socket.on('chat:message', async (data) => {
    try {
      const { roomId, text, messageText, attachmentFileId } = data || {};

      const messagePayload = await chatService.sendMessage(roomId, userId, companyId, {
        messageText: messageText ?? text,
        attachmentFileId,
      });

      // Broadcast to all users in the room (including sender for confirmation)
      const roomName = `room:${roomId}`;
      io.to(roomName).emit('chat:message', messagePayload);

      logger.debug(
        {
          socketId: socket.id,
          roomId,
          messageId: messagePayload.id,
          hasAttachment: !!messagePayload.attachment,
        },
        'Message sent'
      );
    } catch (error) {
      logger.error({ err: error, event: 'chat:message' }, 'Error sending message');
      socket.emit('chat:error', {
        message: error.message || 'Failed to send message',
        code: error.statusCode || 500,
      });
    }
  });

  /**
   * Mark messages as read
   * @event chat:read
   * @param {Object} data - { roomId: number, messageId?: number }
   * Client usage: emit when opening the room or after reading messages.
   * Server behavior: updates read receipts and broadcasts `chat:read` with `unreadCount`.
   */
  socket.on('chat:read', async (data) => {
    try {
      const { roomId, messageId } = data || {};
      const readResult = await chatService.markRoomRead(roomId, companyId, { messageId });

      const roomName = `room:${roomId}`;
      io.to(roomName).emit('chat:read', {
        roomId: readResult.roomId,
        companyId,
        company,
        messageId: readResult.messageId,
        unreadCount: readResult.unreadCount,
      });
    } catch (error) {
      logger.error({ err: error, event: 'chat:read' }, 'Error marking messages read');
      socket.emit('chat:error', {
        message: error.message || 'Failed to mark messages read',
        code: error.statusCode || 500,
      });
    }
  });

  /**
   * Typing indicator
   * @event chat:typing
   * @param {Object} data - { roomId: number, isTyping: boolean }
   * Client usage: emit on input start/stop (debounced) to reduce event volume.
   * Server behavior: broadcasts to other participants in the room.
   */
  socket.on('chat:typing', (data) => {
    const { roomId, isTyping } = data;
    const roomName = `room:${roomId}`;

    // Broadcast to other users in the room
    socket.to(roomName).emit('chat:typing', {
      roomId,
      userId,
      companyId,
      company,
      isTyping,
    });
  });

  /**
   * Handle disconnect
   */
  socket.on('disconnect', () => {
    cleanupSocketPresence(socket.id);

    logger.debug({ socketId: socket.id, userId }, 'User disconnected from chat');
  });
};

/**
 * Initialize chat socket handlers on the io instance
 */
const initializeChatSockets = (io) => {
  // Apply authentication middleware
  io.use(authenticateSocket);

  // Import support chat handlers
  const { registerSupportChatHandlers } = require('./supportChat.handler');

  io.on('connection', (socket) => {
    // Register B2B chat handlers
    registerChatHandlers(io, socket);

    // Register support chat handlers (FR-SUP-004)
    registerSupportChatHandlers(io, socket);
  });

  logger.info('Chat and support socket handlers initialized');
};

/**
 * Get online users count (utility for admin/stats)
 */
const getOnlineUsersCount = async () => {
  const now = nowEpochSeconds();
  await redis.zremrangebyscore(ONLINE_SOCKETS_KEY, 0, now);
  return redis.zcard(ONLINE_SOCKETS_KEY);
};

/**
 * Get users in a room (utility)
 */
const getRoomParticipantCount = async (roomId) => {
  const now = nowEpochSeconds();
  await redis.zremrangebyscore(ROOM_SOCKETS_KEY(roomId), 0, now);
  return redis.zcard(ROOM_SOCKETS_KEY(roomId));
};

module.exports = {
  initializeChatSockets,
  getOnlineUsersCount,
  getRoomParticipantCount,
  trackRoomJoin,
};
