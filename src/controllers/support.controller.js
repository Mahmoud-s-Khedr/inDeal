const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const supportService = require('../services/support.service');

// ─────────────────────────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────────────────────────

const getSupportInfo = catchAsync(async (req, res) => {
  const info = supportService.getSupportInfo();
  sendResponse(res, 200, info, 'Support info fetched');
});

// ─────────────────────────────────────────────────────────────
// AUTHENTICATED USER
// ─────────────────────────────────────────────────────────────

const createTicket = catchAsync(async (req, res) => {
  const userId = req.user?.id || null;
  const companyId = req.user?.company?.id || null;

  const ticket = await supportService.createTicket(userId, companyId, req.body);
  sendResponse(res, 201, ticket, 'Support ticket submitted');
});

const getMyTickets = catchAsync(async (req, res) => {
  const result = await supportService.getMyTickets(req.user.id, req.query);
  sendResponse(res, 200, result, 'Tickets fetched');
});

const getTicket = catchAsync(async (req, res) => {
  const ticket = await supportService.getTicketById(req.params.id, req.user.id);
  sendResponse(res, 200, ticket, 'Ticket details fetched');
});

// ─────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────

const adminListTickets = catchAsync(async (req, res) => {
  const result = await supportService.adminListTickets(req.query);
  sendResponse(res, 200, result, 'All tickets fetched');
});

const adminGetTicket = catchAsync(async (req, res) => {
  const ticket = await supportService.getTicketById(req.params.id);
  sendResponse(res, 200, ticket, 'Ticket details fetched');
});

const adminUpdateTicket = catchAsync(async (req, res) => {
  const ticket = await supportService.adminUpdateTicket(req.params.id, req.body, req.user.id);
  sendResponse(res, 200, ticket, 'Ticket updated');
});

const adminAddResponse = catchAsync(async (req, res) => {
  const result = await supportService.adminAddResponse(
    req.params.id,
    req.user.id,
    req.body.message
  );
  sendResponse(res, 201, result, 'Response added');
});

module.exports = {
  getSupportInfo,
  createTicket,
  getMyTickets,
  getTicket,
  adminListTickets,
  adminGetTicket,
  adminUpdateTicket,
  adminAddResponse,
};
