const { z } = require('zod');

const searchTypeEnumValues = [
  'companies',
  'deals',
  'documents',
  'contributions',
  'myDeals',
  'myRequests',
  'chatRoomsMetadata',
];

const parseTypes = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const searchSchema = z.object({
  query: z.object({
    q: z.string().trim().min(2).max(200),
    types: z
      .preprocess(parseTypes, z.array(z.enum(searchTypeEnumValues)).min(1).optional())
      .optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

module.exports = {
  searchTypeEnumValues,
  searchSchema,
};
