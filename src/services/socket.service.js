let io = null;
const logger = require('../utils/logger');

const init = (ioInstance) => {
  io = ioInstance;
  logger.info('Socket service initialized');
};

const notifyUser = (userId, notification) => {
  if (!io) {
    logger.warn('Socket.io not initialized, skipping notification emit');
    return;
  }

  // notification object matches the DB structure or UI expectation
  io.to(`user:${userId}`).emit('notification:new', notification);
  logger.debug({ userId, type: notification.type }, 'Notification emitted to user');
};

module.exports = {
  init,
  notifyUser,
};
