const AppError = require('../utils/AppError');
const supportRepository = require('../repositories/support.repository');
const logger = require('../utils/logger');
const mailer = require('../config/mailer');
const config = require('../config/env');

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

const sanitizeTicket = (ticket) => {
  if (!ticket) return null;
  return {
    id: ticket.id,
    userId: ticket.user_id,
    companyId: ticket.company_id,
    subject: ticket.subject,
    message: ticket.message,
    email: ticket.email,
    priority: ticket.priority,
    status: ticket.status,
    adminNotes: ticket.admin_notes,
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
    // Joined fields
    userName:
      ticket.user_first_name && ticket.user_last_name
        ? `${ticket.user_first_name} ${ticket.user_last_name}`
        : null,
    userEmail: ticket.user_email,
    companyName: ticket.company_name,
  };
};

const sanitizeResponse = (response) => {
  if (!response) return null;
  return {
    id: response.id,
    ticketId: response.ticket_id,
    responderUserId: response.responder_user_id,
    responderName:
      response.responder_first_name && response.responder_last_name
        ? `${response.responder_first_name} ${response.responder_last_name}`
        : null,
    responderRole: response.responder_role,
    message: response.message,
    createdAt: response.created_at,
  };
};

// ─────────────────────────────────────────────────────────────
// SUPPORT INFO
// ─────────────────────────────────────────────────────────────

const getSupportInfo = () => {
  return {
    email: config.support?.email || 'support@indeal.com',
    phone: config.support?.phone || '+20 123 456 7890',
    hours: config.support?.hours || 'Sunday - Thursday, 9:00 AM - 5:00 PM (EET)',
    address: config.support?.address || 'Cairo, Egypt',
    responseTime: '24-48 hours',
  };
};

// ─────────────────────────────────────────────────────────────
// CREATE TICKET
// ─────────────────────────────────────────────────────────────

const createTicket = async (userId, companyId, data) => {
  const ticket = await supportRepository.createTicket(null, {
    userId,
    companyId,
    subject: data.subject,
    message: data.message,
    email: data.email,
    priority: data.priority || 'medium',
  });

  logger.info('Support ticket created', { ticketId: ticket.id, userId, priority: ticket.priority });

  // Send confirmation email to user
  try {
    await mailer.sendMail({
      to: data.email,
      subject: `Support Ticket #${ticket.id} - ${data.subject}`,
      html: `
                <h2>Thank you for contacting inDeal Support</h2>
                <p>We have received your support request and will respond within 24-48 hours.</p>
                <hr>
                <p><strong>Ticket ID:</strong> #${ticket.id}</p>
                <p><strong>Subject:</strong> ${data.subject}</p>
                <p><strong>Priority:</strong> ${ticket.priority}</p>
                <hr>
                <p>Best regards,<br>inDeal Support Team</p>
            `,
    });
  } catch (err) {
    logger.warn({ err, ticketId: ticket.id }, 'Failed to send ticket confirmation email');
  }

  return sanitizeTicket(await supportRepository.findById(ticket.id));
};

// ─────────────────────────────────────────────────────────────
// GET TICKETS (User)
// ─────────────────────────────────────────────────────────────

const getMyTickets = async (userId, filters = {}) => {
  const [tickets, total] = await Promise.all([
    supportRepository.findByUserId(userId, filters),
    supportRepository.countByUserId(userId, filters.status),
  ]);

  return {
    tickets: tickets.map(sanitizeTicket),
    pagination: {
      total,
      limit: filters.limit || 20,
      offset: filters.offset || 0,
      hasMore: (filters.offset || 0) + tickets.length < total,
    },
  };
};

const getTicketById = async (ticketId, userId = null) => {
  const ticket = await supportRepository.findById(ticketId);
  if (!ticket) {
    throw new AppError('Ticket not found', 404);
  }

  // If userId provided, verify ownership
  if (userId && ticket.user_id !== userId) {
    throw new AppError('Unauthorized to view this ticket', 403);
  }

  const responses = await supportRepository.getResponses(ticketId);

  return {
    ...sanitizeTicket(ticket),
    responses: responses.map(sanitizeResponse),
  };
};

// ─────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────

const adminListTickets = async (filters = {}) => {
  const [tickets, total] = await Promise.all([
    supportRepository.findAll(filters),
    supportRepository.countAll(filters),
  ]);

  return {
    tickets: tickets.map(sanitizeTicket),
    pagination: {
      total,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      hasMore: (filters.offset || 0) + tickets.length < total,
    },
  };
};

const adminUpdateTicket = async (ticketId, data, adminUserId) => {
  const ticket = await supportRepository.findById(ticketId);
  if (!ticket) {
    throw new AppError('Ticket not found', 404);
  }

  const updated = await supportRepository.updateStatus(
    ticketId,
    data.status || ticket.status,
    data.adminNotes
  );
  logger.info('Admin updated ticket', { ticketId, adminUserId, newStatus: updated.status });

  return sanitizeTicket(await supportRepository.findById(ticketId));
};

const adminAddResponse = async (ticketId, adminUserId, message) => {
  const ticket = await supportRepository.findById(ticketId);
  if (!ticket) {
    throw new AppError('Ticket not found', 404);
  }

  const response = await supportRepository.addResponse(ticketId, adminUserId, message);
  logger.info('Admin responded to ticket', { ticketId, adminUserId, responseId: response.id });

  // Send email notification to ticket creator
  try {
    await mailer.sendMail({
      to: ticket.email,
      subject: `Re: Support Ticket #${ticketId} - ${ticket.subject}`,
      html: `
                <h2>New Response to Your Support Ticket</h2>
                <p>Our support team has responded to your ticket.</p>
                <hr>
                <p><strong>Ticket ID:</strong> #${ticketId}</p>
                <p><strong>Subject:</strong> ${ticket.subject}</p>
                <hr>
                <p><strong>Response:</strong></p>
                <p>${message}</p>
                <hr>
                <p>Best regards,<br>inDeal Support Team</p>
            `,
    });
  } catch (err) {
    logger.warn({ err, ticketId }, 'Failed to send response notification email');
  }

  const updatedTicket = await supportRepository.findById(ticketId);
  const responses = await supportRepository.getResponses(ticketId);

  return {
    ...sanitizeTicket(updatedTicket),
    responses: responses.map(sanitizeResponse),
  };
};

module.exports = {
  getSupportInfo,
  createTicket,
  getMyTickets,
  getTicketById,
  adminListTickets,
  adminUpdateTicket,
  adminAddResponse,
};
