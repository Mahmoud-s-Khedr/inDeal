const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const chatService = require('../services/chat.service');

// ─────────────────────────────────────────────────────────────
// CHAT ROOM CONTROLLERS
// ─────────────────────────────────────────────────────────────

const createRoom = catchAsync(async (req, res) => {
  const { room, created } = await chatService.createOrGetRoom(
    req.user.company.id,
    req.body.targetCompanyId
  );
  const statusCode = created ? 201 : 200;
  const message = created ? 'Chat room created' : 'Chat room retrieved';
  sendResponse(res, statusCode, room, message);
});

const getRoom = catchAsync(async (req, res) => {
  const room = await chatService.getRoomById(req.params.roomId, req.user.company.id);
  sendResponse(res, 200, room, 'Chat room details fetched');
});

const listRooms = catchAsync(async (req, res) => {
  const rooms = await chatService.getMyRooms(req.user.company.id, req.query);
  sendResponse(res, 200, rooms, 'Chat rooms fetched');
});

const archiveRoom = catchAsync(async (req, res) => {
  const room = await chatService.archiveRoom(req.params.roomId, req.user.company.id);
  sendResponse(res, 200, room, 'Chat room archived');
});

// ─────────────────────────────────────────────────────────────
// CHAT MESSAGE CONTROLLERS
// ─────────────────────────────────────────────────────────────

const sendMessage = catchAsync(async (req, res) => {
  const message = await chatService.sendMessage(
    req.params.roomId,
    req.user.id,
    req.user.company.id,
    {
      messageText: req.body.messageText,
      attachmentFileId: req.body.attachmentFileId,
    }
  );
  sendResponse(res, 201, message, 'Message sent');
});

const getMessages = catchAsync(async (req, res) => {
  const result = await chatService.getRoomMessages(
    req.params.roomId,
    req.user.company.id,
    req.query
  );
  sendResponse(res, 200, result, 'Messages fetched');
});

module.exports = {
  createRoom,
  getRoom,
  listRooms,
  archiveRoom,
  sendMessage,
  getMessages,
};
