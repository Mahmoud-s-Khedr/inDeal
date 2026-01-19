const { z } = require('zod');

// ─────────────────────────────────────────────────────────────
// Enum values
// ─────────────────────────────────────────────────────────────

const chatRoomStatusEnumValues = ['active', 'archived'];

// ─────────────────────────────────────────────────────────────
// Chat Room Schemas
// ─────────────────────────────────────────────────────────────

const createRoomSchema = z.object({
  body: z.object({
    targetCompanyId: z.coerce.number().int().positive(),
  }),
});

const getRoomSchema = z.object({
  params: z.object({
    roomId: z.coerce.number().int().positive(),
  }),
});

const listRoomsSchema = z.object({
  query: z.object({
    status: z.enum(chatRoomStatusEnumValues).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

const updateRoomStatusSchema = z.object({
  params: z.object({
    roomId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    status: z.enum(chatRoomStatusEnumValues),
  }),
});

// ─────────────────────────────────────────────────────────────
// Chat Message Schemas
// ─────────────────────────────────────────────────────────────

const sendMessageSchema = z.object({
  params: z.object({
    roomId: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      messageText: z.string().max(5000).optional(),
      attachmentFileId: z.coerce.number().int().positive().optional(),
    })
    .refine((data) => data.messageText || data.attachmentFileId, {
      message: 'Either messageText or attachmentFileId is required',
    }),
});

const listMessagesSchema = z.object({
  params: z.object({
    roomId: z.coerce.number().int().positive(),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    before: z.coerce.number().int().positive().optional(), // cursor: message ID
    after: z.coerce.number().int().positive().optional(),
  }),
});

module.exports = {
  chatRoomStatusEnumValues,
  createRoomSchema,
  getRoomSchema,
  listRoomsSchema,
  updateRoomStatusSchema,
  sendMessageSchema,
  listMessagesSchema,
};
