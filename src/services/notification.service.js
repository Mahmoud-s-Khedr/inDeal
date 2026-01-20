const notificationRepository = require('../repositories/notification.repository');
const AppError = require('../utils/AppError');

const sanitizeNotification = (n) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  message: n.message,
  isRead: n.is_read,
  metadata: n.metadata,
  createdAt: n.created_at,
});

const getMyNotifications = async (userId, query) => {
  const limit = parseInt(query.limit, 10) || 50;
  const offset = parseInt(query.offset, 10) || 0;
  const notifications = await notificationRepository.listByUserId(userId, limit, offset);
  const unreadCount = await notificationRepository.countUnread(userId);

  return {
    items: notifications.map(sanitizeNotification),
    unreadCount,
  };
};

const markAsRead = async (userId, notificationId) => {
  const updated = await notificationRepository.markAsRead(notificationId, userId);
  if (!updated) {
    throw new AppError('Notification not found', 404);
  }
  return sanitizeNotification(updated);
};

const socketService = require('./socket.service');
const deviceTokenRepository = require('../repositories/deviceToken.repository');
const firebase = require('../config/firebase');
const logger = require('../utils/logger');

const createNotification = async (payload) => {
  const notification = await notificationRepository.createNotification(payload);

  // Notify via socket (in-app real-time)
  socketService.notifyUser(payload.userId, sanitizeNotification(notification));

  // Send push notification via FCM if user has registered devices
  try {
    const tokens = await deviceTokenRepository.findByUserId(payload.userId);
    if (tokens && tokens.length > 0) {
      const fcmTokens = tokens.map((t) => t.token);
      await firebase.sendMulticastNotification({
        tokens: fcmTokens,
        title: payload.title,
        body: payload.message,
        data: {
          type: payload.type,
          notificationId: String(notification.id),
          ...(payload.metadata || {}),
        },
      });
      logger.debug({ userId: payload.userId, tokenCount: fcmTokens.length }, 'Push notification sent');
    }
  } catch (err) {
    // Don't fail the notification creation if push fails
    logger.warn({ err, userId: payload.userId }, 'Failed to send push notification');
  }

  return sanitizeNotification(notification);
};

const markAllAsRead = async (userId) => {
  await notificationRepository.markAllAsRead(userId);
  return { success: true };
};

const deleteNotification = async (userId, notificationId) => {
  const deleted = await notificationRepository.deleteById(notificationId, userId);
  if (!deleted) {
    throw new AppError('Notification not found', 404);
  }
  return sanitizeNotification(deleted);
};

const deleteAllRead = async (userId) => {
  const count = await notificationRepository.deleteAllRead(userId);
  return { deleted: count };
};

module.exports = {
  getMyNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
};
