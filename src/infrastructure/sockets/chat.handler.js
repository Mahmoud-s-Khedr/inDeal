const logger = require('../../shared/utils/logger');
const { verifyToken } = require('../../shared/utils/jwt');
const companyModule = require('../../modules/company');
const chatModule = require('../../modules/chat');
const redis = require('../config/redis');
const { validateSocketPayload } = require('../../core/contracts/socket/registry');
const { companyRepository } = companyModule.repository;
const chatService = chatModule.service;

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
  const emitValidated = (event, payload) => {
    const validation = validateSocketPayload({ direction: 'send', event, payload });
    if (!validation.success) {
      logger.error({ event, reason: validation.reason }, 'Socket DTO validation failed (outgoing)');
      return;
    }
    socket.emit(event, validation.data);
  };

  const ioEmitValidated = (room, event, payload) => {
    const validation = validateSocketPayload({ direction: 'send', event, payload });
    if (!validation.success) {
      logger.error({ event, reason: validation.reason }, 'Socket DTO validation failed (outgoing)');
      return;
    }
    io.to(room).emit(event, validation.data);
  };

  // Track online user
  trackOnlineSocket(socket.id, userId, companyId).catch((error) =>
    logger.error({ err: error, socketId: socket.id }, 'Failed to track online socket')
  );

  // Join user-specific and company-specific rooms for notifications
  socket.join(`user:${userId}`);
  if (companyId) {
    socket.join(`company:${companyId}`);
  }

  // Auto-join all B2B channels on connect
  const autoJoinAllChannels = async () => {
    const result = {
      b2bRoomIds: [],
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

      emitValidated('chat:ready', result);
      logger.debug(
        {
          socketId: socket.id,
          userId,
          companyId,
          b2bRoomCount: result.b2bRoomIds.length,
        },
        'User auto-joined B2B channels'
      );
    } catch (error) {
      logger.error({ err: error, socketId: socket.id }, 'Failed to auto-join channels');
      result.error = 'Failed to load channels';
      emitValidated('chat:ready', result);
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
      const parsedIncoming = validateSocketPayload({
        direction: 'receive',
        event: 'chat:message',
        payload: data || {},
      });
      if (!parsedIncoming.success) {
        emitValidated('chat:error', { message: 'Invalid chat:message payload', code: 400 });
        return;
      }
      const { roomId, text, messageText, attachmentFileId } = parsedIncoming.data;

      const messagePayload = await chatService.sendMessage(roomId, userId, companyId, {
        messageText: messageText ?? text,
        attachmentFileId,
      });

      // Build per-company payloads so isRead reflects the other participant
      const room = await chatService.getRoomById(roomId, companyId);
      const senderCompanyId = companyId;
      const otherCompanyId = room.otherCompany?.id;

      const msgForSender = await chatService.getMessageById(messagePayload.id, senderCompanyId);
      ioEmitValidated(`company:${senderCompanyId}`, 'chat:message', msgForSender);

      if (otherCompanyId) {
        const msgForOther = await chatService.getMessageById(messagePayload.id, otherCompanyId);
        ioEmitValidated(`company:${otherCompanyId}`, 'chat:message', msgForOther);
      }

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
      emitValidated('chat:error', {
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
      const parsedIncoming = validateSocketPayload({
        direction: 'receive',
        event: 'chat:read',
        payload: data || {},
      });
      if (!parsedIncoming.success) {
        emitValidated('chat:error', { message: 'Invalid chat:read payload', code: 400 });
        return;
      }
      const { roomId, messageId } = parsedIncoming.data;
      const readResult = await chatService.markRoomRead(roomId, companyId, { messageId });

      const roomName = `room:${roomId}`;
      ioEmitValidated(roomName, 'chat:read', {
        roomId: readResult.roomId,
        companyId,
        company,
        messageId: readResult.messageId,
        unreadCount: readResult.unreadCount,
      });
    } catch (error) {
      logger.error({ err: error, event: 'chat:read' }, 'Error marking messages read');
      emitValidated('chat:error', {
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
    const parsedIncoming = validateSocketPayload({
      direction: 'receive',
      event: 'chat:typing',
      payload: data || {},
    });
    if (!parsedIncoming.success) {
      emitValidated('chat:error', { message: 'Invalid chat:typing payload', code: 400 });
      return;
    }
    const { roomId, isTyping } = parsedIncoming.data;
    const roomName = `room:${roomId}`;

    // Broadcast to other users in the room
    ioEmitValidated(roomName, 'chat:typing', {
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

  io.on('connection', (socket) => {
    registerChatHandlers(io, socket);
  });

  logger.info('Chat socket handlers initialized');
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
