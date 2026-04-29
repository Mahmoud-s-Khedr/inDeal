const { z } = require('zod');

const contracts = [
  {
    event: 'chat:message',
    direction: 'receive',
    auth: true,
    schema: z.object({
      roomId: z.coerce.number().int().positive(),
      text: z.string().max(5000).optional(),
      messageText: z.string().max(5000).optional(),
      attachmentFileId: z.coerce.number().int().positive().optional(),
    }),
  },
  {
    event: 'chat:message',
    direction: 'send',
    auth: true,
    schema: z.object({}).passthrough(),
  },
  {
    event: 'chat:read',
    direction: 'receive',
    auth: true,
    schema: z.object({
      roomId: z.coerce.number().int().positive(),
      messageId: z.coerce.number().int().positive().optional(),
    }),
  },
  {
    event: 'chat:read',
    direction: 'send',
    auth: true,
    schema: z
      .object({
        roomId: z.coerce.number().int().positive(),
        companyId: z.coerce.number().int().positive(),
        messageId: z.coerce.number().int().positive().nullable(),
        unreadCount: z.coerce.number().int().nonnegative(),
      })
      .passthrough(),
  },
  {
    event: 'chat:typing',
    direction: 'receive',
    auth: true,
    schema: z.object({
      roomId: z.coerce.number().int().positive(),
      isTyping: z.boolean(),
    }),
  },
  {
    event: 'chat:typing',
    direction: 'send',
    auth: true,
    schema: z
      .object({
        roomId: z.coerce.number().int().positive(),
        userId: z.coerce.number().int().positive(),
        companyId: z.coerce.number().int().positive().nullable().optional(),
        isTyping: z.boolean(),
      })
      .passthrough(),
  },
  {
    event: 'chat:ready',
    direction: 'send',
    auth: true,
    schema: z.object({
      b2bRoomIds: z.array(z.coerce.number().int().positive()),
      error: z.string().nullable(),
    }),
  },
  {
    event: 'chat:error',
    direction: 'send',
    auth: true,
    schema: z.object({
      message: z.string(),
      code: z.coerce.number().int(),
    }),
  },
  {
    event: 'chat:room:new',
    direction: 'send',
    auth: true,
    schema: z
      .object({
        id: z.coerce.number().int().positive(),
      })
      .passthrough(),
  },
  {
    event: 'notification:new',
    direction: 'send',
    auth: true,
    schema: z.object({}).passthrough(),
  },
  {
    event: 'support:room:new',
    direction: 'send',
    auth: true,
    schema: z.object({
      roomId: z.coerce.number().int().positive(),
    }),
  },
];

module.exports = contracts;
