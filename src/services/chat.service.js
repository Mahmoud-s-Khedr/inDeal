const AppError = require('../utils/AppError');
const chatRepository = require('../repositories/chat.repository');
const companyRepository = require('../repositories/company.repository');
const fileRepository = require('../repositories/file.repository');
const socketService = require('./socket.service');
const logger = require('../utils/logger');
const { publicUrl } = require('../config/storage');

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

function buildPublicUrl(filePath) {
  if (!publicUrl || !filePath) return null;
  return `${publicUrl.replace(/\/$/, '')}/${filePath}`;
}

const sanitizeRoom = (room, myCompanyId = null) => {
  if (!room) return null;

  // Determine the "other" company for this user (the one they're chatting with)
  let otherCompany = null;
  if (myCompanyId) {
    const isCompanyA = room.company_a_id === myCompanyId;
    otherCompany = {
      id: isCompanyA ? room.company_b_id : room.company_a_id,
      name: isCompanyA ? room.company_b_name : room.company_a_name,
      logo: isCompanyA ? room.company_b_logo : room.company_a_logo,
    };
  }

  const hasLastAttachment = !!room.last_attachment_file_id;
  const lastAttachment = hasLastAttachment
    ? {
        id: room.last_attachment_file_id,
        fileName: room.last_attachment_file_name,
        publicUrl: buildPublicUrl(room.last_attachment_file_path),
        mimeType: room.last_attachment_file_metadata?.mimeType || null,
        size: room.last_attachment_file_metadata?.size || null,
      }
    : null;

  const lastMessageObject = room.last_message_id
    ? {
        id: room.last_message_id,
        sentAt: room.last_message_at,
        messageText: room.last_message,
        attachment: lastAttachment,
      }
    : null;

  return {
    id: room.id,
    companyAId: room.company_a_id,
    companyBId: room.company_b_id,
    otherCompany,
    status: room.status,
    createdAt: room.created_at,
    lastMessage: room.last_message || room.last_attachment_file_name || null,
    lastMessageAt: room.last_message_at,
    lastMessageObject,
    unreadCount: room.unread_count !== undefined ? Number(room.unread_count) : 0,
  };
};

const sanitizeMessage = (message) => {
  if (!message) return null;

  // Build attachment object if file is present
  let attachment = null;
  if (message.attachment_file_id) {
    attachment = {
      id: message.attachment_file_id,
      fileName: message.attachment_file_name,
      publicUrl: buildPublicUrl(message.attachment_file_path),
      mimeType: message.attachment_file_metadata?.mimeType || null,
      size: message.attachment_file_metadata?.size || null,
    };
  }

  return {
    id: message.id,
    roomId: message.room_id,
    messageText: message.message_text,
    sentAt: message.sent_at,
    readAt: message.other_read_at || null,
    isRead: !!message.other_read_at,
    attachment,
    agent: {
      id: message.sender_user_id,
      firstName: message.sender_first_name,
      lastName: message.sender_last_name,
      profileImage: message.sender_profile_image,
    },
    company: {
      id: message.sender_company_id,
      name: message.sender_company_name,
      logo: message.sender_company_logo,
    },
  };
};

const normalizeMessageText = (messageText) => {
  if (typeof messageText !== 'string') return null;
  const trimmed = messageText.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeAttachmentId = (attachmentFileId) => {
  if (attachmentFileId === null || attachmentFileId === undefined) return null;
  const parsed = Number(attachmentFileId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError('Invalid attachmentFileId', 400);
  }
  return parsed;
};

const ensureRoomActive = async (roomId, companyId) => {
  const room = await chatRepository.findRoomById(roomId);
  if (!room) {
    throw new AppError('Chat room not found', 404);
  }

  if (room.company_a_id !== companyId && room.company_b_id !== companyId) {
    throw new AppError('Unauthorized to access this chat room', 403);
  }

  if (room.status !== 'active') {
    throw new AppError('Chat room is not active', 400);
  }

  return room;
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

  let fullRoomForMe = null;

  if (created) {
    logger.info('Chat room created', {
      roomId: room.id,
      companies: [myCompanyId, targetCompanyId],
    });

    const [fullRoomForCreator, fullRoomForTarget] = await Promise.all([
      chatRepository.findRoomByIdForCompany(room.id, myCompanyId),
      chatRepository.findRoomByIdForCompany(room.id, targetCompanyId),
    ]);

    fullRoomForMe = fullRoomForCreator;

    // Notify both companies about the new room so they auto-subscribe.
    // Payload must match GET /chats/:roomId schema (per-company otherCompany + unreadCount).
    socketService.notifyRoomCreated({
      roomId: room.id,
      companyAId: myCompanyId,
      companyBId: targetCompanyId,
      roomForCompanyA: sanitizeRoom(fullRoomForCreator, myCompanyId),
      roomForCompanyB: sanitizeRoom(fullRoomForTarget, targetCompanyId),
    });
  }

  // Fetch full room details with company names (if not already fetched)
  if (!fullRoomForMe) {
    fullRoomForMe = await chatRepository.findRoomByIdForCompany(room.id, myCompanyId);
  }
  return { room: sanitizeRoom(fullRoomForMe, myCompanyId), created };
};

/**
 * Get a room by ID (with authorization check)
 */
const getRoomById = async (roomId, companyId) => {
  const room = await chatRepository.findRoomByIdForCompany(roomId, companyId);
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
  await ensureRoomActive(roomId, companyId);

  const normalizedText = normalizeMessageText(messageText);
  const normalizedAttachmentId = normalizeAttachmentId(attachmentFileId);

  // Validate that at least one of text or attachment is provided
  if (!normalizedText && !normalizedAttachmentId) {
    throw new AppError('Message must have text or attachment', 400);
  }

  if (normalizedText && normalizedText.length > 5000) {
    throw new AppError('Message too long (max 5000 chars)', 400);
  }

  // Verify file ownership if attachment provided
  if (normalizedAttachmentId) {
    const file = await fileRepository.findById(normalizedAttachmentId);
    if (!file) {
      throw new AppError('Attachment file not found', 404);
    }
    if (file.deletedAt) {
      throw new AppError('Attachment file not available', 400);
    }
    // Optionally verify uploader matches user
    if (file.fileMetadata?.uploaderId && file.fileMetadata.uploaderId !== String(userId)) {
      throw new AppError('Unauthorized to use this file', 403);
    }
  }

  const message = await chatRepository.createMessage(null, {
    roomId,
    senderUserId: userId,
    messageText: normalizedText,
    attachmentFileId: normalizedAttachmentId,
  });

  // Mark the message as read by the sender's company so recipients see "other read" immediately
  await chatRepository.markMessageReadForCompany(message.id, companyId);

  logger.info('Message sent', {
    messageId: message.id,
    roomId,
    userId,
    hasAttachment: !!normalizedAttachmentId,
  });

  // Fetch full message with sender info
  const fullMessage = await chatRepository.findMessageByIdForCompany(message.id, companyId);
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

  const useCursor = !!(filters.before || filters.after);
  if (filters.before && filters.after) {
    throw new AppError('Use either before or after cursor, not both', 400);
  }

  const normalizedFilters = {
    ...filters,
    offset: useCursor ? 0 : filters.offset || 0,
  };

  const [messages, total] = await Promise.all([
    chatRepository.findMessagesByRoomIdForCompany(roomId, companyId, normalizedFilters),
    chatRepository.countMessagesByRoomId(roomId),
  ]);

  const lastMessage = messages[messages.length - 1];
  const nextCursor = useCursor && lastMessage ? lastMessage.id : null;
  const hasMore = useCursor
    ? messages.length === (normalizedFilters.limit || 50)
    : (normalizedFilters.offset || 0) + messages.length < total;

  return {
    messages: messages.map(sanitizeMessage),
    pagination: {
      mode: useCursor ? 'cursor' : 'offset',
      total,
      limit: normalizedFilters.limit || 50,
      offset: normalizedFilters.offset || 0,
      hasMore,
      nextCursor,
    },
  };
};

/**
 * Join a chat room (validates room exists, user is participant, and room is active)
 * Used by socket handlers for the chat:join event
 */
const joinRoom = async (roomId, companyId) => {
  const room = await chatRepository.findRoomById(roomId);
  if (!room) {
    throw new AppError('Chat room not found', 404);
  }

  // Verify user is participant in room
  if (room.company_a_id !== companyId && room.company_b_id !== companyId) {
    throw new AppError('Unauthorized to join this room', 403);
  }

  if (room.status !== 'active') {
    throw new AppError('Chat room is not active', 400);
  }

  return { roomId: room.id, status: room.status };
};

/**
 * Mark messages in a room as read for a company
 */
const markRoomRead = async (roomId, companyId, { messageId } = {}) => {
  // Verify room exists and participant
  const isParticipant = await chatRepository.isRoomParticipant(roomId, companyId);
  if (!isParticipant) {
    throw new AppError('Unauthorized to access this chat room', 403);
  }

  const normalizedMessageId = messageId ? Number(messageId) : null;
  if (normalizedMessageId && (!Number.isInteger(normalizedMessageId) || normalizedMessageId <= 0)) {
    throw new AppError('Invalid messageId', 400);
  }

  const readRows = await chatRepository.markMessagesRead(roomId, companyId, {
    messageId: normalizedMessageId,
  });

  const unreadCount = await chatRepository.countUnreadMessagesByRoomId(roomId, companyId);

  return {
    roomId: Number(roomId),
    messageId: normalizedMessageId || null,
    readCount: readRows.length,
    unreadCount,
  };
};

/**
 * Get all active room IDs for a company (for socket auto-join)
 */
const getActiveRoomIds = async (companyId) => {
  return chatRepository.findActiveRoomIdsByCompanyId(companyId);
};

/**
 * Fetch a single message scoped to the viewer company (used for per-company payloads)
 */
const getMessageById = async (messageId, companyId) => {
  const message = await chatRepository.findMessageByIdForCompany(messageId, companyId);
  if (!message) {
    throw new AppError('Message not found', 404);
  }
  return sanitizeMessage(message);
};

module.exports = {
  createOrGetRoom,
  getRoomById,
  getMyRooms,
  archiveRoom,
  joinRoom,
  getActiveRoomIds,
  sendMessage,
  getRoomMessages,
  markRoomRead,
  sanitizeMessage,
  getMessageById,
};
