const { z } = require('zod');

// ─────────────────────────────────────────────────────────────
// Enum values
// ─────────────────────────────────────────────────────────────

const ticketStatusEnumValues = ['open', 'in_progress', 'resolved', 'closed'];
const ticketPriorityEnumValues = ['low', 'medium', 'high', 'urgent'];

// ─────────────────────────────────────────────────────────────
// Create Ticket Schema
// ─────────────────────────────────────────────────────────────

const createTicketSchema = z.object({
  body: z.object({
    subject: z.string().min(5).max(200),
    message: z.string().min(10).max(5000),
    email: z.string().email(),
    priority: z.enum(ticketPriorityEnumValues).optional().default('medium'),
  }),
});

// ─────────────────────────────────────────────────────────────
// Get / List Tickets Schemas
// ─────────────────────────────────────────────────────────────

const getTicketSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

const listMyTicketsSchema = z.object({
  query: z.object({
    status: z.enum(ticketStatusEnumValues).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

// ─────────────────────────────────────────────────────────────
// Admin Schemas
// ─────────────────────────────────────────────────────────────

const adminListTicketsSchema = z.object({
  query: z.object({
    status: z.enum(ticketStatusEnumValues).optional(),
    priority: z.enum(ticketPriorityEnumValues).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

const adminUpdateTicketSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      status: z.enum(ticketStatusEnumValues).optional(),
      adminNotes: z.string().max(2000).optional(),
    })
    .refine((data) => data.status || data.adminNotes, {
      message: 'At least one of status or adminNotes required',
    }),
});

const addResponseSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    message: z.string().min(1).max(5000),
  }),
});

module.exports = {
  ticketStatusEnumValues,
  ticketPriorityEnumValues,
  createTicketSchema,
  getTicketSchema,
  listMyTicketsSchema,
  adminListTicketsSchema,
  adminUpdateTicketSchema,
  addResponseSchema,
};
