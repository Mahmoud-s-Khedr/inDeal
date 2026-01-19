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

const createNotification = async (payload) => {
  const notification = await notificationRepository.create(payload);

  // Notify via socket
  socketService.notifyUser(payload.userId, sanitizeNotification(notification));

  return sanitizeNotification(notification);
};

const markAllAsRead = async (userId) => {
  await notificationRepository.markAllAsRead(userId);
  return { success: true };
};

module.exports = {
  getMyNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
};
