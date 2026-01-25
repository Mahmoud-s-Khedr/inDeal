/**
 * Support Chat Socket Handler
 * Real-time messaging for live support chat (FR-SUP-004)
 *
 * Note: Users are automatically subscribed to their active support room on connect
 * via chat.handler.js autoJoinAllChannels(). No manual join event needed.
 */

const logger = require('../utils/logger');
const supportChatRepository = require('../repositories/supportChat.repository');
const supportChatService = require('../services/supportChat.service');
const notificationService = require('../services/notification.service');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');

// Track admin users online for support
const onlineSupportAdmins = new Map(); // socketId -> { userId, adminId }

/**
 * Register support chat socket handlers
 */
const registerSupportChatHandlers = (io, socket) => {
  const { userId, user } = socket;
  const isAdmin = user?.role === 'admin' || user?.role === 'support';

  // If admin, track them as available for support
  if (isAdmin) {
    onlineSupportAdmins.set(socket.id, { userId });
    socket.join('support:admins');
    logger.debug({ socketId: socket.id, userId }, 'Admin joined support');
  }

  /**
   * Send a message in support chat
   * @event support:message
   * Note: User must be auto-subscribed to the room on connect via chat:ready
   */
  socket.on('support:message', async (data) => {
    try {
      const { roomId, text } = data;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        socket.emit('support:error', { message: 'Message text is required' });
        return;
      }

      if (text.length > 5000) {
        socket.emit('support:error', { message: 'Message too long (max 5000 chars)' });
        return;
      }

      // Verify participant
      const isParticipant = await supportChatRepository.isParticipant(roomId, userId);
      if (!isParticipant) {
        socket.emit('support:error', { message: 'Unauthorized to message this room' });
        return;
      }

      const room = await supportChatRepository.findRoomById(roomId);
      if (!room || room.status === 'closed') {
        socket.emit('support:error', { message: 'Room is closed' });
        return;
      }

      // Save message via service
      const message = await supportChatService.sendMessage(roomId, userId, text.trim(), isAdmin);

      // Broadcast to room
      io.to(`support:room:${roomId}`).emit('support:message', message);

      // Send notification to other party if offline
      const recipientId = isAdmin ? room.user_id : room.assigned_admin_id;
      if (recipientId) {
        await notificationService.createNotification({
          userId: recipientId,
          type: NOTIFICATION_TYPES.SUPPORT_CHAT_MESSAGE,
          title: isAdmin ? 'Support Message' : 'User Message',
          message: text.trim().substring(0, 100),
          metadata: { roomId },
        });
      }

      logger.debug({ socketId: socket.id, roomId, messageId: message.id }, 'Support message sent');
    } catch (error) {
      logger.error({ err: error, event: 'support:message' }, 'Error sending support message');
      socket.emit('support:error', { message: 'Failed to send message' });
    }
  });

  /**
   * Typing indicator
   * @event support:typing
   */
  socket.on('support:typing', (data) => {
    const { roomId, isTyping } = data;
    socket.to(`support:room:${roomId}`).emit('support:typing', {
      roomId,
      userId,
      isAdmin,
      isTyping,
    });
  });

  /**
   * Admin accepts a waiting chat
   * @event support:admin:accept
   */
  socket.on('support:admin:accept', async (data) => {
    if (!isAdmin) {
      socket.emit('support:error', { message: 'Admin only' });
      return;
    }

    try {
      const { roomId } = data;
      const room = await supportChatRepository.assignAdmin(roomId, userId);

      // Join the room (admin auto-subscribes when accepting)
      socket.join(`support:room:${roomId}`);

      // Notify the waiting user room
      io.to(`support:room:${roomId}`).emit('support:admin:joined', {
        roomId,
        admin: {
          id: userId,
          firstName: user?.firstName || 'Support',
          lastName: user?.lastName || 'Agent',
        },
      });

      // Notify all admins about queue update
      const waitingCount = await supportChatRepository.countByStatus('waiting');
      io.to('support:admins').emit('support:queue:update', { waitingCount });

      logger.info({ roomId, adminId: userId }, 'Admin accepted support chat');
    } catch (error) {
      logger.error({ err: error, event: 'support:admin:accept' }, 'Error accepting chat');
      socket.emit('support:error', { message: 'Failed to accept chat' });
    }
  });

  /**
   * Handle disconnect
   */
  socket.on('disconnect', () => {
    if (isAdmin) {
      onlineSupportAdmins.delete(socket.id);
    }
    logger.debug({ socketId: socket.id, userId, isAdmin }, 'User disconnected from support');
  });
};

/**
 * Get count of online support admins
 */
const getOnlineSupportAdminCount = () => onlineSupportAdmins.size;

module.exports = {
  registerSupportChatHandlers,
  getOnlineSupportAdminCount,
};
