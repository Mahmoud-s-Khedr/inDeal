require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createDealRequestSchema,
  createDirectRequestSchema,
  listMyRequestsSchema,
  sendDealEmailSchema,
} = require('../../src/modules/deal/validation/deal.validation');

test('createDealRequest accepts SRS-aligned supplyType values and rejects removed values', () => {
  const valid = createDealRequestSchema.safeParse({
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
  assert.equal(valid.success, true);

  const legacy = createDealRequestSchema.safeParse({
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
  assert.equal(legacy.success, false);
});

test('supply-side payload accepts SRS-required colorFinish field', () => {
  const parsed = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestKind: 'rfq',
      supplyDetails: {
        productServiceName: 'Custom valve',
        category: 'industrialEquipment',
        colorFinish: 'Brushed steel',
      },
    },
  });
  assert.equal(parsed.success, true);
});

test('demand-side payload accepts SRS-required stockDeliveryTime field', () => {
  const parsed = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestKind: 'demand',
      demandDetails: {
        productServiceName: 'Pump',
        stockDeliveryTime: '2 days',
      },
    },
  });
  assert.equal(parsed.success, true);
});

test('removed backend-only fields are rejected from request detail payloads', () => {
  const withQualityLevelOtherText = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestKind: 'supply',
      supplyDetails: {
        productServiceName: 'Pipe',
        category: 'industrialEquipment',
        qualityLevelOtherText: 'Special grade',
      },
    },
  });
  assert.equal(withQualityLevelOtherText.success, false);

  const withEngineerToOrder = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestKind: 'rfq',
      supplyDetails: {
        productServiceName: 'Pump',
        category: 'industrialEquipment',
        supplyType: 'engineerToOrder',
      },
    },
  });
  assert.equal(withEngineerToOrder.success, false);
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

test('createDealRequest defaults requestType to inSupply and rejects direct requestType', () => {
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

  const directParsed = createDealRequestSchema.safeParse({
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
  assert.equal(directParsed.success, false);
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
