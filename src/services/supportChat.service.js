/**
 * Support Chat Service
 * Handles live support chat functionality (FR-SUP-004)
 */

const AppError = require('../utils/AppError');
const supportChatRepository = require('../repositories/supportChat.repository');
const companyRepository = require('../repositories/company.repository');
const notificationService = require('./notification.service');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');
const logger = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const sanitizeRoom = (room) => ({
  id: room.id,
  status: room.status,
  startedAt: room.started_at,
  endedAt: room.ended_at,
  messageCount: room.message_count,
  user: {
    id: room.user_id,
    firstName: room.first_name,
    lastName: room.last_name,
    email: room.email,
  },
  company: room.company_id
    ? {
        id: room.company_id,
        name: room.company_name,
      }
    : null,
  assignedAdmin: room.assigned_admin_id
    ? {
        id: room.assigned_admin_id,
        firstName: room.admin_first_name,
        lastName: room.admin_last_name,
      }
    : null,
});

const sanitizeMessage = (msg) => ({
  id: msg.id,
  roomId: msg.room_id,
  messageText: msg.message_text,
  isFromSupport: msg.is_from_support,
  sentAt: msg.sent_at,
  agent: {
    id: msg.sender_id,
    firstName: msg.first_name,
    lastName: msg.last_name,
  },
});

// ═══════════════════════════════════════════════════════════════
// USER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Start a new support chat room
 */
const startChat = async (userId) => {
  // Check if user already has an active chat
  const existing = await supportChatRepository.findActiveRoomByUserId(userId);
  if (existing) {
    return sanitizeRoom(existing);
  }

  // Get company ID if user is an agent
  const company = await companyRepository.findByAgentId(userId);
  const room = await supportChatRepository.createRoom(userId, company?.id);

  logger.info({ userId, roomId: room.id }, 'Support chat started');
  return sanitizeRoom(room);
};

/**
 * Get active chat room for user
 */
const getActiveRoom = async (userId) => {
  const room = await supportChatRepository.findActiveRoomByUserId(userId);
  return room ? sanitizeRoom(room) : null;
};

/**
 * Send a message in support chat
 */
const sendMessage = async (roomId, senderId, messageText, isAdmin = false) => {
  // Verify sender is participant
  const isParticipant = await supportChatRepository.isParticipant(roomId, senderId);
  if (!isParticipant) {
    throw new AppError('You are not a participant in this chat', 403);
  }

  const room = await supportChatRepository.findRoomById(roomId);
  if (!room) {
    throw new AppError('Chat room not found', 404);
  }
  if (room.status === 'closed') {
    throw new AppError('This chat has been closed', 400);
  }

  const message = await supportChatRepository.createMessage(roomId, senderId, messageText, isAdmin);

  logger.debug({ roomId, senderId, isAdmin }, 'Support message sent');
  return sanitizeMessage(message);
};

/**
 * Get messages for a room
 */
const getMessages = async (roomId, userId, query = {}) => {
  // Verify user is participant
  const isParticipant = await supportChatRepository.isParticipant(roomId, userId);
  if (!isParticipant) {
    throw new AppError('You are not a participant in this chat', 403);
  }

  const limit = parseInt(query.limit, 10) || 100;
  const offset = parseInt(query.offset, 10) || 0;

  const messages = await supportChatRepository.getMessages(roomId, limit, offset);
  return messages.map(sanitizeMessage);
};

// ═══════════════════════════════════════════════════════════════
// ADMIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * List all chat rooms (admin)
 */
const adminListRooms = async (query = {}) => {
  const status = query.status || null;
  const limit = parseInt(query.limit, 10) || 50;
  const offset = parseInt(query.offset, 10) || 0;

  const rooms = await supportChatRepository.listRooms(status, limit, offset);
  const waitingCount = await supportChatRepository.countByStatus('waiting');
  const activeCount = await supportChatRepository.countByStatus('active');

  return {
    items: rooms.map(sanitizeRoom),
    waitingCount,
    activeCount,
  };
};

/**
 * Get waiting queue (admin)
 */
const adminGetWaitingQueue = async () => {
  const rooms = await supportChatRepository.listRooms('waiting', 100, 0);
  return rooms.map(sanitizeRoom);
};

/**
 * Assign admin to chat room
 */
const adminAssignChat = async (roomId, adminId) => {
  const room = await supportChatRepository.findRoomById(roomId);
  if (!room) {
    throw new AppError('Chat room not found', 404);
  }
  if (room.status === 'closed') {
    throw new AppError('This chat has been closed', 400);
  }

  const updated = await supportChatRepository.assignAdmin(roomId, adminId);

  // Notify user that admin has joined
  await notificationService.createNotification({
    userId: room.user_id,
    type: NOTIFICATION_TYPES.SUPPORT_CHAT_ASSIGNED,
    title: 'Support Agent Connected',
    message: 'A support agent has joined your chat.',
    metadata: { roomId },
  });

  logger.info({ roomId, adminId }, 'Admin assigned to support chat');
  return sanitizeRoom(updated);
};

/**
 * Close a chat room (admin)
 */
const adminCloseChat = async (roomId, adminId) => {
  const room = await supportChatRepository.findRoomById(roomId);
  if (!room) {
    throw new AppError('Chat room not found', 404);
  }

  const closed = await supportChatRepository.closeRoom(roomId);

  // Notify user that chat has been closed
  await notificationService.createNotification({
    userId: room.user_id,
    type: NOTIFICATION_TYPES.SUPPORT_CHAT_CLOSED,
    title: 'Support Chat Closed',
    message: 'Your support chat has been closed. Feel free to start a new one if you need help.',
    metadata: { roomId },
  });

  logger.info({ roomId, adminId }, 'Support chat closed');
  return sanitizeRoom(closed);
};

/**
 * Get room details (admin)
 */
const adminGetRoom = async (roomId) => {
  const room = await supportChatRepository.findRoomById(roomId);
  if (!room) {
    throw new AppError('Chat room not found', 404);
  }
  return sanitizeRoom(room);
};

module.exports = {
  // User
  startChat,
  getActiveRoom,
  sendMessage,
  getMessages,
  // Admin
  adminListRooms,
  adminGetWaitingQueue,
  adminAssignChat,
  adminCloseChat,
  adminGetRoom,
  // Helpers (for socket handlers)
  sanitizeMessage,
  sanitizeRoom,
};
