const express = require('express');
const protect = require('../../middlewares/authMiddleware');
const validate = require('../../middlewares/validateMiddleware');
const chatController = require('../../controllers/chat.controller');
const {
  createRoomSchema,
  getRoomSchema,
  listRoomsSchema,
  sendMessageSchema,
  listMessagesSchema,
  markReadSchema,
} = require('../../validations/chat.validation');

const router = express.Router();

// All chat routes require authentication
router.use(protect);

// ─────────────────────────────────────────────────────────────
// CHAT ROOM ROUTES
// ─────────────────────────────────────────────────────────────

// List my chat rooms
router.get('/', validate(listRoomsSchema), chatController.listRooms);

// Create or get chat room with another company
router.post('/', validate(createRoomSchema), chatController.createRoom);

// Get specific room details
router.get('/:roomId', validate(getRoomSchema), chatController.getRoom);

// Archive a chat room
router.patch('/:roomId/archive', validate(getRoomSchema), chatController.archiveRoom);

// ─────────────────────────────────────────────────────────────
// CHAT MESSAGE ROUTES
// ─────────────────────────────────────────────────────────────

// Get messages in a room
router.get('/:roomId/messages', validate(listMessagesSchema), chatController.getMessages);

// Send message (REST fallback for when socket is unavailable)
router.post('/:roomId/messages', validate(sendMessageSchema), chatController.sendMessage);

// Mark messages as read
router.post('/:roomId/read', validate(markReadSchema), chatController.markRead);

module.exports = router;
