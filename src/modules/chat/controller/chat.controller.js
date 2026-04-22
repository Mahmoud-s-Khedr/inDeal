const sendResponse = require('../../../core/http/response');
const catchAsync = require('../../../core/http/catchAsync');
const chatService = require('../service/chat.service');
const AppError = require('../../../core/errors/AppError');

const getCompanyId = (req) => {
  const companyId = req.user?.company?.id;
  if (!companyId) {
    throw new AppError('Company context required', 403);
  }
  return companyId;
};

// ─────────────────────────────────────────────────────────────
// CHAT ROOM CONTROLLERS
// ─────────────────────────────────────────────────────────────

const createRoom = catchAsync(async (req, res) => {
  const { room, created } = await chatService.createOrGetRoom(
    getCompanyId(req),
    req.body.targetCompanyId
  );
  const statusCode = created ? 201 : 200;
  const message = created ? 'Chat room created' : 'Chat room retrieved';
  sendResponse(res, statusCode, room, message);
});

const getRoom = catchAsync(async (req, res) => {
  const room = await chatService.getRoomById(req.params.roomId, getCompanyId(req));
  sendResponse(res, 200, room, 'Chat room details fetched');
});

const listRooms = catchAsync(async (req, res) => {
  const rooms = await chatService.getMyRooms(getCompanyId(req), req.query);
  sendResponse(res, 200, rooms, 'Chat rooms fetched');
});

const archiveRoom = catchAsync(async (req, res) => {
  const room = await chatService.archiveRoom(req.params.roomId, getCompanyId(req));
  sendResponse(res, 200, room, 'Chat room archived');
});

// ─────────────────────────────────────────────────────────────
// CHAT MESSAGE CONTROLLERS
// ─────────────────────────────────────────────────────────────

const sendMessage = catchAsync(async (req, res) => {
  const message = await chatService.sendMessage(req.params.roomId, req.user.id, getCompanyId(req), {
    messageText: req.body.messageText,
    attachmentFileId: req.body.attachmentFileId,
  });
  sendResponse(res, 201, message, 'Message sent');
});

const getMessages = catchAsync(async (req, res) => {
  const result = await chatService.getRoomMessages(req.params.roomId, getCompanyId(req), req.query);
  sendResponse(res, 200, result, 'Messages fetched');
});

const markRead = catchAsync(async (req, res) => {
  const result = await chatService.markRoomRead(req.params.roomId, getCompanyId(req), {
    messageId: req.body?.messageId,
  });
  sendResponse(res, 200, result, 'Messages marked as read');
});

module.exports = {
  createRoom,
  getRoom,
  listRooms,
  archiveRoom,
  sendMessage,
  getMessages,
  markRead,
};
