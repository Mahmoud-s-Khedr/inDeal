const AppError = require('../utils/AppError');
const chatRepository = require('../repositories/chat.repository');
const companyRepository = require('../repositories/company.repository');
const fileRepository = require('../repositories/file.repository');
const logger = require('../utils/logger');
const { publicUrl } = require('../config/storage');

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

const sanitizeRoom = (room, myCompanyId = null) => {
  if (!room) return null;

  // Determine the "other" company for this user
  let otherCompanyId, otherCompanyName, otherCompanyLogo;
  if (myCompanyId) {
    if (room.company_a_id === myCompanyId) {
      otherCompanyId = room.company_b_id;
      otherCompanyName = room.company_b_name;
      otherCompanyLogo = room.company_b_logo;
    } else {
      otherCompanyId = room.company_a_id;
      otherCompanyName = room.company_a_name;
      otherCompanyLogo = room.company_a_logo;
    }
  }

  return {
    id: room.id,
    companyAId: room.company_a_id,
    companyBId: room.company_b_id,
    companyAName: room.company_a_name,
    companyBName: room.company_b_name,
    companyALogo: room.company_a_logo,
    companyBLogo: room.company_b_logo,
    status: room.status,
    createdAt: room.created_at,
    lastMessage: room.last_message,
    lastMessageAt: room.last_message_at,
    // Convenience fields for UI
    otherCompanyId,
    otherCompanyName,
    otherCompanyLogo,
  };
};

const buildPublicUrl = (filePath) => {
  if (!publicUrl || !filePath) return null;
  return `${publicUrl.replace(/\/$/, '')}/${filePath}`;
};

const sanitizeMessage = (message) => {
  if (!message) return null;

  // Build attachment object if file is present
  let attachment = null;
  if (message.attachment_file_id) {
    attachment = {
      id: message.attachment_file_id,
      fileName: message.attachment_file_name,
      filePath: message.attachment_file_path,
      publicUrl: buildPublicUrl(message.attachment_file_path),
      mimeType: message.attachment_file_metadata?.mimeType,
      size: message.attachment_file_metadata?.size,
    };
  }

  return {
    id: message.id,
    roomId: message.room_id,
    senderUserId: message.sender_user_id,
    messageText: message.message_text,
    sentAt: message.sent_at,
    attachment,
    // Joined sender info
    senderFirstName: message.sender_first_name,
    senderLastName: message.sender_last_name,
    senderProfileImage: message.sender_profile_image,
    senderCompanyId: message.sender_company_id,
    senderCompanyName: message.sender_company_name,
  };
};

// ─────────────────────────────────────────────────────────────
// CHAT ROOM OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Create or get a chat room with another company
 */
const createOrGetRoom = async (myCompanyId, targetCompanyId) => {
  if (myCompanyId === targetCompanyId) {
    throw new AppError('Cannot create chat room with yourself', 400);
  }

  // Verify target company exists and is active
  const targetCompany = await companyRepository.findById(targetCompanyId);
  if (!targetCompany) {
    throw new AppError('Target company not found', 404);
  }
  if (targetCompany.status !== 'active') {
    throw new AppError('Cannot start chat with inactive company', 400);
  }

  const { room, created } = await chatRepository.findOrCreateRoom(
    null,
    myCompanyId,
    targetCompanyId
  );

  if (created) {
    logger.info('Chat room created', {
      roomId: room.id,
      companies: [myCompanyId, targetCompanyId],
    });
  }

  // Fetch full room details with company names
  const fullRoom = await chatRepository.findRoomById(room.id);
  return { room: sanitizeRoom(fullRoom, myCompanyId), created };
};

/**
 * Get a room by ID (with authorization check)
 */
const getRoomById = async (roomId, companyId) => {
  const room = await chatRepository.findRoomById(roomId);
  if (!room) {
    throw new AppError('Chat room not found', 404);
  }

  // Authorization check
  if (room.company_a_id !== companyId && room.company_b_id !== companyId) {
    throw new AppError('Unauthorized to access this chat room', 403);
  }

  return sanitizeRoom(room, companyId);
};

/**
 * List my chat rooms
 */
const getMyRooms = async (companyId, filters = {}) => {
  const rooms = await chatRepository.findRoomsByCompanyId(companyId, filters);
  return rooms.map((room) => sanitizeRoom(room, companyId));
};

/**
 * Archive a chat room
 */
const archiveRoom = async (roomId, companyId) => {
  const room = await chatRepository.findRoomById(roomId);
  if (!room) {
    throw new AppError('Chat room not found', 404);
  }
  if (room.company_a_id !== companyId && room.company_b_id !== companyId) {
    throw new AppError('Unauthorized to archive this chat room', 403);
  }

  const updated = await chatRepository.updateRoomStatus(roomId, 'archived');
  logger.info('Chat room archived', { roomId, companyId });
  return sanitizeRoom(updated, companyId);
};

// ─────────────────────────────────────────────────────────────
// CHAT MESSAGE OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Send a message to a room (REST fallback)
 */
const sendMessage = async (roomId, userId, companyId, { messageText, attachmentFileId }) => {
  // Verify room and authorization
  const isParticipant = await chatRepository.isRoomParticipant(roomId, companyId);
  if (!isParticipant) {
    throw new AppError('Unauthorized to send message to this room', 403);
  }

  // Validate that at least one of text or attachment is provided
  if (!messageText && !attachmentFileId) {
    throw new AppError('Message must have text or attachment', 400);
  }

  // Verify file ownership if attachment provided
  if (attachmentFileId) {
    const file = await fileRepository.findById(attachmentFileId);
    if (!file) {
      throw new AppError('Attachment file not found', 404);
    }
    // Optionally verify uploader matches user
    if (file.file_metadata?.uploaderId && file.file_metadata.uploaderId !== String(userId)) {
      throw new AppError('Unauthorized to use this file', 403);
    }
  }

  const message = await chatRepository.createMessage(null, {
    roomId,
    senderUserId: userId,
    messageText,
    attachmentFileId,
  });

  logger.info('Message sent', {
    messageId: message.id,
    roomId,
    userId,
    hasAttachment: !!attachmentFileId,
  });

  // Fetch full message with sender info
  const fullMessage = await chatRepository.findMessageById(message.id);
  return sanitizeMessage(fullMessage);
};

/**
 * Get messages for a room
 */
const getRoomMessages = async (roomId, companyId, filters = {}) => {
  // Verify authorization
  const isParticipant = await chatRepository.isRoomParticipant(roomId, companyId);
  if (!isParticipant) {
    throw new AppError('Unauthorized to view messages in this room', 403);
  }

  const [messages, total] = await Promise.all([
    chatRepository.findMessagesByRoomId(roomId, filters),
    chatRepository.countMessagesByRoomId(roomId),
  ]);

  return {
    messages: messages.map(sanitizeMessage),
    pagination: {
      total,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      hasMore: (filters.offset || 0) + messages.length < total,
    },
  };
};

module.exports = {
  createOrGetRoom,
  getRoomById,
  getMyRooms,
  archiveRoom,
  sendMessage,
  getRoomMessages,
};
