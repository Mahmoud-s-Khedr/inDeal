const logger = require('../utils/logger');
const { verifyToken } = require('../utils/jwt');
const companyRepository = require('../repositories/company.repository');
const chatRepository = require('../repositories/chat.repository');

// Store for online users: socketId -> { userId, companyId }
const onlineUsers = new Map();
// Store for room subscriptions: roomId -> Set<socketId>
const roomSubscriptions = new Map();

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

    const decoded = verifyToken(token);
    if (!decoded) {
      return next(new Error('Invalid token'));
    }

    // Attach user info to socket
    const company = await companyRepository.findByAgentId(decoded.id);
    socket.userId = decoded.id;
    socket.companyId = company?.id;
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
  const { userId, companyId } = socket;

  // Track online user
  onlineUsers.set(socket.id, { userId, companyId });
  logger.debug({ socketId: socket.id, userId, companyId }, 'User connected to chat');

  /**
   * Join a chat room
   * @event chat:join
   * @param {Object} data - { roomId: number }
   */
  socket.on('chat:join', async (data) => {
    try {
      const { roomId } = data;

      // Verify user is participant in room
      const isParticipant = await chatRepository.isRoomParticipant(roomId, companyId);
      if (!isParticipant) {
        socket.emit('chat:error', { message: 'Unauthorized to join this room' });
        return;
      }

      const roomName = `room:${roomId}`;
      socket.join(roomName);

      // Track room subscription
      if (!roomSubscriptions.has(roomId)) {
        roomSubscriptions.set(roomId, new Set());
      }
      roomSubscriptions.get(roomId).add(socket.id);

      socket.emit('chat:joined', { roomId });
      logger.debug({ socketId: socket.id, roomId }, 'User joined room');
    } catch (error) {
      logger.error({ err: error, event: 'chat:join' }, 'Error joining room');
      socket.emit('chat:error', { message: 'Failed to join room' });
    }
  });

  /**
   * Leave a chat room
   * @event chat:leave
   * @param {Object} data - { roomId: number }
   */
  socket.on('chat:leave', (data) => {
    const { roomId } = data;
    const roomName = `room:${roomId}`;
    socket.leave(roomName);

    if (roomSubscriptions.has(roomId)) {
      roomSubscriptions.get(roomId).delete(socket.id);
    }

    socket.emit('chat:left', { roomId });
    logger.debug({ socketId: socket.id, roomId }, 'User left room');
  });

  /**
   * Send a message
   * @event chat:message
   * @param {Object} data - { roomId: number, text?: string, attachmentFileId?: number }
   */
  socket.on('chat:message', async (data) => {
    try {
      const { roomId, text, attachmentFileId } = data;

      // Validate: must have text or attachment
      const hasText = text && typeof text === 'string' && text.trim().length > 0;
      const hasAttachment = attachmentFileId && Number.isInteger(attachmentFileId);

      if (!hasText && !hasAttachment) {
        socket.emit('chat:error', { message: 'Message must have text or attachment' });
        return;
      }

      if (hasText && text.length > 5000) {
        socket.emit('chat:error', { message: 'Message too long (max 5000 chars)' });
        return;
      }

      // Verify user is participant
      const isParticipant = await chatRepository.isRoomParticipant(roomId, companyId);
      if (!isParticipant) {
        socket.emit('chat:error', { message: 'Unauthorized to message this room' });
        return;
      }

      // Save message to database
      const message = await chatRepository.createMessage(null, {
        roomId,
        senderUserId: userId,
        messageText: hasText ? text.trim() : null,
        attachmentFileId: hasAttachment ? attachmentFileId : null,
      });

      // Fetch full message with sender info and attachment
      const fullMessage = await chatRepository.findMessageById(message.id);

      const messagePayload = {
        id: fullMessage.id,
        roomId: fullMessage.room_id,
        senderUserId: fullMessage.sender_user_id,
        messageText: fullMessage.message_text,
        sentAt: fullMessage.sent_at,
        senderFirstName: fullMessage.sender_first_name,
        senderLastName: fullMessage.sender_last_name,
        attachment: fullMessage.attachment_file_id
          ? {
              id: fullMessage.attachment_file_id,
              fileName: fullMessage.attachment_file_name,
              filePath: fullMessage.attachment_file_path,
            }
          : null,
      };

      // Broadcast to all users in the room (including sender for confirmation)
      const roomName = `room:${roomId}`;
      io.to(roomName).emit('chat:message', messagePayload);

      logger.debug(
        { socketId: socket.id, roomId, messageId: message.id, hasAttachment },
        'Message sent'
      );
    } catch (error) {
      logger.error({ err: error, event: 'chat:message' }, 'Error sending message');
      socket.emit('chat:error', { message: 'Failed to send message' });
    }
  });

  /**
   * Typing indicator
   * @event chat:typing
   * @param {Object} data - { roomId: number, isTyping: boolean }
   */
  socket.on('chat:typing', (data) => {
    const { roomId, isTyping } = data;
    const roomName = `room:${roomId}`;

    // Broadcast to other users in the room
    socket.to(roomName).emit('chat:typing', {
      roomId,
      userId,
      companyId,
      isTyping,
    });
  });

  /**
   * Handle disconnect
   */
  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);

    // Clean up room subscriptions
    for (const [roomId, sockets] of roomSubscriptions) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        roomSubscriptions.delete(roomId);
      }
    }

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
const getOnlineUsersCount = () => onlineUsers.size;

/**
 * Get users in a room (utility)
 */
const getRoomParticipantCount = (roomId) => roomSubscriptions.get(roomId)?.size || 0;

module.exports = {
  initializeChatSockets,
  getOnlineUsersCount,
  getRoomParticipantCount,
};
