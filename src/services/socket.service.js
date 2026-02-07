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
const subscribeUserToRoom = async (userId, roomIdOrRoom, maybeRoom) => {
  if (!io) {
    logger.warn('Socket.io not initialized, skipping room subscription');
    return;
  }

  const isRoomObject = roomIdOrRoom && typeof roomIdOrRoom === 'object';
  const roomIdRaw = isRoomObject ? roomIdOrRoom.id : roomIdOrRoom;
  const roomId = Number(roomIdRaw);
  if (!Number.isInteger(roomId) || roomId <= 0) {
    logger.warn({ userId, roomId: roomIdRaw }, 'Invalid roomId for room subscription');
    return;
  }

  const roomPayload =
    (isRoomObject ? roomIdOrRoom : maybeRoom) &&
    typeof (isRoomObject ? roomIdOrRoom : maybeRoom) === 'object'
      ? isRoomObject
        ? roomIdOrRoom
        : maybeRoom
      : { id: roomId };

  const userRoom = `user:${userId}`;
  const chatRoom = `room:${roomId}`;

  // Get all sockets in the user's personal room
  const sockets = await io.in(userRoom).fetchSockets();

  for (const socket of sockets) {
    socket.join(chatRoom);
    // `chat:room:new` payload is the room object (same schema as GET /chats/:roomId)
    socket.emit('chat:room:new', roomPayload);
    logger.debug({ socketId: socket.id, userId, roomId }, 'User subscribed to new room');
  }

  return sockets.length;
};

/**
 * Notify both parties when a new B2B chat room is created
 * Automatically subscribes both companies' connected users to the room
 */
const notifyRoomCreated = async (data) => {
  if (!io) {
    logger.warn('Socket.io not initialized, skipping room created notification');
    return;
  }

  // Supports both legacy input (single room object) and per-company payloads.
  const roomId = Number(data.roomId || data.id || data?.roomForCompanyA?.id || data?.room?.id);
  const companyAId = Number(
    data.companyAId ||
      data.company_a_id ||
      data?.roomForCompanyA?.companyAId ||
      data?.room?.companyAId
  );
  const companyBId = Number(
    data.companyBId ||
      data.company_b_id ||
      data?.roomForCompanyB?.companyBId ||
      data?.room?.companyBId
  );

  if (!Number.isInteger(roomId) || roomId <= 0) {
    logger.warn({ roomId }, 'Invalid roomId for room created notification');
    return;
  }
  if (
    !Number.isInteger(companyAId) ||
    companyAId <= 0 ||
    !Number.isInteger(companyBId) ||
    companyBId <= 0
  ) {
    logger.warn(
      { companyAId, companyBId, roomId },
      'Invalid company ids for room created notification'
    );
    return;
  }

  const roomForCompanyA =
    data.roomForCompanyA || data.room || (data && typeof data === 'object' ? data : { id: roomId });
  const roomForCompanyB =
    data.roomForCompanyB || data.room || (data && typeof data === 'object' ? data : { id: roomId });
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

  // Emit notification to both company rooms.
  // `chat:room:new` payload is the room object (same schema as GET /chats/:roomId).
  io.to(`company:${companyAId}`).emit('chat:room:new', roomForCompanyA);
  io.to(`company:${companyBId}`).emit('chat:room:new', roomForCompanyB);

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
