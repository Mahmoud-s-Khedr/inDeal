/**
 * Support Chat Controller
 * User and admin endpoints for live support chat (FR-SUP-004)
 */

const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const supportChatService = require('../services/supportChat.service');

// ═══════════════════════════════════════════════════════════════
// USER ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * Start a support chat
 * POST /api/v1/support/chat
 */
const startChat = catchAsync(async (req, res) => {
    const room = await supportChatService.startChat(req.user.id);
    sendResponse(res, 201, room, 'Support chat started');
});

/**
 * Get active support chat
 * GET /api/v1/support/chat
 */
const getActiveChat = catchAsync(async (req, res) => {
    const room = await supportChatService.getActiveRoom(req.user.id);
    sendResponse(res, 200, room, room ? 'Active chat found' : 'No active chat');
});

/**
 * Send a message in support chat
 * POST /api/v1/support/chat/:roomId/messages
 */
const sendMessage = catchAsync(async (req, res) => {
    const message = await supportChatService.sendMessage(
        parseInt(req.params.roomId, 10),
        req.user.id,
        req.body.message,
        req.user.role !== 'agent' // isAdmin if not an agent
    );
    sendResponse(res, 201, message, 'Message sent');
});

/**
 * Get messages for a support chat
 * GET /api/v1/support/chat/:roomId/messages
 */
const getMessages = catchAsync(async (req, res) => {
    const messages = await supportChatService.getMessages(
        parseInt(req.params.roomId, 10),
        req.user.id,
        req.query
    );
    sendResponse(res, 200, messages, 'Messages fetched');
});

// ═══════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * List all support chats (admin)
 * GET /api/v1/admin/support/chats
 */
const adminListChats = catchAsync(async (req, res) => {
    const result = await supportChatService.adminListRooms(req.query);
    sendResponse(res, 200, result, 'Support chats fetched');
});

/**
 * Get waiting queue (admin)
 * GET /api/v1/admin/support/chats/waiting
 */
const adminGetWaitingQueue = catchAsync(async (req, res) => {
    const queue = await supportChatService.adminGetWaitingQueue();
    sendResponse(res, 200, queue, 'Waiting queue fetched');
});

/**
 * Get chat details (admin)
 * GET /api/v1/admin/support/chats/:id
 */
const adminGetChat = catchAsync(async (req, res) => {
    const room = await supportChatService.adminGetRoom(parseInt(req.params.id, 10));
    sendResponse(res, 200, room, 'Chat details fetched');
});

/**
 * Assign admin to chat (admin)
 * POST /api/v1/admin/support/chats/:id/assign
 */
const adminAssignChat = catchAsync(async (req, res) => {
    const room = await supportChatService.adminAssignChat(
        parseInt(req.params.id, 10),
        req.user.id
    );
    sendResponse(res, 200, room, 'Chat assigned');
});

/**
 * Close a chat (admin)
 * POST /api/v1/admin/support/chats/:id/close
 */
const adminCloseChat = catchAsync(async (req, res) => {
    const room = await supportChatService.adminCloseChat(
        parseInt(req.params.id, 10),
        req.user.id
    );
    sendResponse(res, 200, room, 'Chat closed');
});

module.exports = {
    // User
    startChat,
    getActiveChat,
    sendMessage,
    getMessages,
    // Admin
    adminListChats,
    adminGetWaitingQueue,
    adminGetChat,
    adminAssignChat,
    adminCloseChat,
};
