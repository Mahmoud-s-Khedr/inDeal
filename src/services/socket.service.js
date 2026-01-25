let io = null;
const logger = require('../utils/logger');

const init = (ioInstance) => {
  io = ioInstance;
  logger.info('Socket service initialized');
};

/**
 * Get the socket.io instance
 */
const getIO = () => io;

/**
 * Notify a user with a new notification
 */
const notifyUser = (userId, notification) => {
  if (!io) {
    logger.warn('Socket.io not initialized, skipping notification emit');
    return;
  }

  // notification object matches the DB structure or UI expectation
  io.to(`user:${userId}`).emit('notification:new', notification);
  logger.debug({ userId, type: notification.type }, 'Notification emitted to user');
};

/**
 * Subscribe a user to a new B2B chat room (called when room is created mid-session)
 * Finds all sockets for the user and joins them to the room
 */
const subscribeUserToRoom = async (userId, roomId) => {
  if (!io) {
    logger.warn('Socket.io not initialized, skipping room subscription');
    return;
  }

  const userRoom = `user:${userId}`;
  const chatRoom = `room:${roomId}`;

  // Get all sockets in the user's personal room
  const sockets = await io.in(userRoom).fetchSockets();

  for (const socket of sockets) {
    socket.join(chatRoom);
    socket.emit('chat:room:new', { roomId });
    logger.debug({ socketId: socket.id, userId, roomId }, 'User subscribed to new room');
  }

  return sockets.length;
};

/**
 * Notify both parties when a new B2B chat room is created
 * Automatically subscribes both companies' connected users to the room
 */
const notifyRoomCreated = async (room) => {
  if (!io) {
    logger.warn('Socket.io not initialized, skipping room created notification');
    return;
  }

  // Support both snake_case (from DB) and camelCase
  const companyAId = room.company_a_id || room.companyAId;
  const companyBId = room.company_b_id || room.companyBId;
  const roomId = room.id;
  const chatRoom = `room:${roomId}`;

  // Subscribe all sockets from both companies to the new room
  const companyARoomSockets = await io.in(`company:${companyAId}`).fetchSockets();
  const companyBRoomSockets = await io.in(`company:${companyBId}`).fetchSockets();

  for (const socket of companyARoomSockets) {
    socket.join(chatRoom);
  }
  for (const socket of companyBRoomSockets) {
    socket.join(chatRoom);
  }

  // Emit notification to both company rooms
  io.to(`company:${companyAId}`).emit('chat:room:new', { roomId, room });
  io.to(`company:${companyBId}`).emit('chat:room:new', { roomId, room });

  logger.info(
    {
      roomId,
      companyAId,
      companyBId,
      subscribedSockets: companyARoomSockets.length + companyBRoomSockets.length,
    },
    'Room created notification sent and sockets subscribed'
  );
};

/**
 * Subscribe a user to their support chat room
 */
const subscribeUserToSupportRoom = async (userId, roomId) => {
  if (!io) {
    logger.warn('Socket.io not initialized, skipping support room subscription');
    return;
  }

  const userRoom = `user:${userId}`;
  const supportRoom = `support:room:${roomId}`;

  const sockets = await io.in(userRoom).fetchSockets();

  for (const socket of sockets) {
    socket.join(supportRoom);
    socket.emit('support:room:new', { roomId });
    logger.debug({ socketId: socket.id, userId, roomId }, 'User subscribed to support room');
  }

  return sockets.length;
};

module.exports = {
  init,
  getIO,
  notifyUser,
  subscribeUserToRoom,
  notifyRoomCreated,
  subscribeUserToSupportRoom,
};
