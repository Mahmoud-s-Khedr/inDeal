require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createDealRequestSchema,
  createDirectRequestSchema,
  listMyRequestsSchema,
  sendDealEmailSchema,
} = require('../../src/modules/deal/validation/deal.validation');

test('createDealRequest validates new supplyType values and rejects legacy value', () => {
  const valid = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestKind: 'supply',
      supplyDetails: {
        productServiceName: 'Steel bars',
        category: 'rawMaterial',
        supplyType: 'assembleToOrder',
      },
    },
  });
  assert.equal(valid.success, true);

  const legacy = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestKind: 'supply',
      supplyDetails: {
        productServiceName: 'Steel bars',
        category: 'rawMaterial',
        supplyType: 'either',
      },
    },
  });
  assert.equal(legacy.success, false);
});

test('qualityLevel other requires qualityLevelOtherText', () => {
  const missingOtherText = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestKind: 'rfq',
      supplyDetails: {
        productServiceName: 'Custom valve',
        category: 'industrialEquipment',
        qualityLevel: 'other',
      },
    },
  });
  assert.equal(missingOtherText.success, false);

  const validOther = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestKind: 'rfq',
      supplyDetails: {
        productServiceName: 'Custom valve',
        category: 'industrialEquipment',
        qualityLevel: 'other',
        qualityLevelOtherText: 'Aerospace grade',
      },
    },
  });
  assert.equal(validOther.success, true);
});

test('removed fields are rejected from request detail payloads', () => {
  const withColorFinish = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestKind: 'supply',
      supplyDetails: {
        productServiceName: 'Pipe',
        category: 'industrialEquipment',
        colorFinish: 'Blue',
      },
    },
  });
  assert.equal(withColorFinish.success, false);

  const withStockDeliveryTime = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestKind: 'demand',
      demandDetails: {
        productServiceName: 'Pump',
        stockDeliveryTime: '2 days',
      },
    },
  });
  assert.equal(withStockDeliveryTime.success, false);
});

test('listMyRequests accepts requestType filter', () => {
  const parsed = listMyRequestsSchema.parse({
    query: {
      requestType: 'inSupply',
      limit: 10,
      offset: 0,
    },
  });

  assert.equal(parsed.query.requestType, 'inSupply');
});

test('createDealRequest accepts direct requestType and defaults to inSupply', () => {
  const directParsed = createDealRequestSchema.parse({
    params: { id: 1 },
    body: {
      requestKind: 'rfq',
      requestType: 'direct',
      supplyDetails: {
        productServiceName: 'Custom valve',
        category: 'industrialEquipment',
      },
    },
  });
  assert.equal(directParsed.body.requestType, 'direct');

  const defaultParsed = createDealRequestSchema.parse({
    params: { id: 1 },
    body: {
      requestKind: 'rfq',
      supplyDetails: {
        productServiceName: 'Custom valve',
        category: 'industrialEquipment',
      },
    },
  });
  assert.equal(defaultParsed.body.requestType, 'inSupply');
});

test('createDirectRequest enforces targetCompanyId and direct requestType', () => {
  const parsed = createDirectRequestSchema.parse({
    body: {
      targetCompanyId: 55,
      requestKind: 'rfq',
      requestType: 'direct',
      supplyDetails: {
        productServiceName: 'Copper wire',
        category: 'rawMaterial',
      },
    },
  });
  assert.equal(parsed.body.requestType, 'direct');

  const invalid = createDirectRequestSchema.safeParse({
    body: {
      requestKind: 'rfq',
      requestType: 'inSupply',
      supplyDetails: {
        productServiceName: 'Copper wire',
        category: 'rawMaterial',
      },
    },
  });
  assert.equal(invalid.success, false);
});

test('sendDealEmail validates required fields and rejects invalid payloads', () => {
  const valid = sendDealEmailSchema.safeParse({
    body: {
      dealId: 12,
      subject: 'RFQ inquiry',
      message: 'Please share current availability and terms.',
      contactInfo: 'procurement@example.com',
    },
  });
  assert.equal(valid.success, true);

  const missing = sendDealEmailSchema.safeParse({
    body: {
      dealId: 12,
      message: 'Hello',
    },
  });
  assert.equal(missing.success, false);

  const invalidDealId = sendDealEmailSchema.safeParse({
    body: {
      dealId: 0,
      subject: 'Valid subject',
      message: 'Valid message',
    },
  });
  assert.equal(invalidDealId.success, false);

  const whitespaceSubject = sendDealEmailSchema.safeParse({
    body: {
      dealId: 12,
      subject: '   ',
      message: 'Valid message',
    },
  });
  assert.equal(whitespaceSubject.success, false);
});
