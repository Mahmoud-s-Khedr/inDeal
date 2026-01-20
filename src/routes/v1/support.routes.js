const express = require('express');
const protect = require('../../middlewares/authMiddleware');
const optionalAuth = require('../../middlewares/optionalAuthMiddleware');
const validate = require('../../middlewares/validateMiddleware');
const supportController = require('../../controllers/support.controller');
const {
  createTicketSchema,
  getTicketSchema,
  listMyTicketsSchema,
} = require('../../validations/support.validation');

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────

// Get support contact info
router.get('/info', supportController.getSupportInfo);

// Submit support ticket (works with or without auth)
router.post('/tickets', optionalAuth, validate(createTicketSchema), supportController.createTicket);

// ─────────────────────────────────────────────────────────────
// AUTHENTICATED ROUTES
// ─────────────────────────────────────────────────────────────

router.use(protect);

// My tickets
router.get('/tickets', validate(listMyTicketsSchema), supportController.getMyTickets);
router.get('/tickets/:id', validate(getTicketSchema), supportController.getTicket);

// ─────────────────────────────────────────────────────────────
// LIVE SUPPORT CHAT (FR-SUP-004)
// ─────────────────────────────────────────────────────────────
const supportChatController = require('../../controllers/supportChat.controller');

router.post('/chat', supportChatController.startChat);
router.get('/chat', supportChatController.getActiveChat);
router.get('/chat/:roomId/messages', supportChatController.getMessages);
router.post('/chat/:roomId/messages', supportChatController.sendMessage);

module.exports = router;
