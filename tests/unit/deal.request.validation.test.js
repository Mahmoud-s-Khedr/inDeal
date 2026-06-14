require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createDealRequestSchema,
  createDirectRequestSchema,
  listMyRequestsSchema,
  sendDealEmailSchema,
} = require('../../src/modules/deal/validation/deal.validation');

test('createDealRequest accepts camelCase supply enums and rejects removed values', () => {
  const valid = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inSupply',
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
      requestType: 'inSupply',
      supplyDetails: {
        productServiceName: 'Steel bars',
        category: 'rawMaterial',
        supplyType: 'assemble to order',
      },
    },
  });
  assert.equal(legacy.success, false);
});

test('createDealRequest accepts camelCase supply delivery and quality enums', () => {
  const parsed = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inSupply',
      supplyDetails: {
        productServiceName: 'Steel bars',
        category: 'rawMaterial',
        deliveryMethodPreference: 'supplierDelivers',
        qualityLevel: 'industrialGuide',
      },
    },
  });
  assert.equal(parsed.success, true);

  const legacy = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inSupply',
      supplyDetails: {
        productServiceName: 'Steel bars',
        category: 'rawMaterial',
        deliveryMethodPreference: 'supplier delivers',
      },
    },
  });
  assert.equal(legacy.success, false);
});

test('supply-side payload accepts targetPrice and string certificationsRequired', () => {
  const parsed = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inSupply',
      supplyDetails: {
        productServiceName: 'Custom valve',
        category: 'industrialEquipment',
        targetPrice: 1250,
        certificationsRequired: 'ISO 9001',
      },
    },
  });
  assert.equal(parsed.success, true);

  const legacy = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inSupply',
      supplyDetails: {
        productServiceName: 'Custom valve',
        category: 'industrialEquipment',
        targetPriceMin: 1200,
        certificationsRequired: ['ISO 9001'],
      },
    },
  });
  assert.equal(legacy.success, false);
});

test('demand-side payload accepts string certificationsHeld and split warranty fields', () => {
  const parsed = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inDemand',
      demandDetails: {
        productServiceName: 'Pump',
        certificationsHeld: 'FDA',
        warrantyPolicy: '1 year warranty',
        returnPolicy: 'Returns accepted within 15 days',
      },
    },
  });
  assert.equal(parsed.success, true);

  const legacy = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inDemand',
      demandDetails: {
        productServiceName: 'Pump',
        certificationsHeld: ['FDA'],
        warrantyReturnPolicy: 'Legacy combined text',
      },
    },
  });
  assert.equal(legacy.success, false);
});

test('demand-side payload accepts camelCase availability and specsMatchRfq values', () => {
  const parsed = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inDemand',
      demandDetails: {
        productServiceName: 'Pump',
        availabilityType: 'assembleToOrder',
        specsMatchRfq: 'exact',
      },
    },
  });
  assert.equal(parsed.success, true);

  const legacy = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inDemand',
      demandDetails: {
        productServiceName: 'Pump',
        availabilityType: 'assemble to order',
        specsMatchRfq: 'yes',
      },
    },
  });
  assert.equal(legacy.success, false);
});

test('demand-side payload rejects removed stockDeliveryTime field', () => {
  const parsed = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inDemand',
      demandDetails: {
        productServiceName: 'Pump',
        stockDeliveryTime: '2 days',
      },
    },
  });
  assert.equal(parsed.success, false);
});

test('qualityLevel other requires otherQualityLevelDescription', () => {
  const valid = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inSupply',
      supplyDetails: {
        productServiceName: 'Pipe',
        category: 'industrialEquipment',
        qualityLevel: 'other',
        otherQualityLevelDescription: 'Special grade',
      },
    },
  });
  assert.equal(valid.success, true);

  const missingDescription = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inSupply',
      supplyDetails: {
        productServiceName: 'Pipe',
        category: 'industrialEquipment',
        qualityLevel: 'other',
      },
    },
  });
  assert.equal(missingDescription.success, false);
});

test('removed backend-only fields are rejected from request detail payloads', () => {
  const withEngineerToOrder = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inSupply',
      supplyDetails: {
        productServiceName: 'Pump',
        category: 'industrialEquipment',
        supplyType: 'engineerToOrder',
      },
    },
  });
  assert.equal(withEngineerToOrder.success, false);

  const withRemovedFields = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inSupply',
      supplyDetails: {
        productServiceName: 'Pump',
        category: 'industrialEquipment',
        colorFinish: 'Brushed steel',
        countryOfOrigin: 'Egypt',
      },
    },
  });
  assert.equal(withRemovedFields.success, false);
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

test('createDealRequest requires requestType and routes by detail kind', () => {
  const validSupply = createDealRequestSchema.parse({
    params: { id: 1 },
    body: {
      requestType: 'inSupply',
      supplyDetails: {
        productServiceName: 'Custom valve',
        category: 'industrialEquipment',
      },
    },
  });
  assert.equal(validSupply.body.requestType, 'inSupply');

  const missingType = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      supplyDetails: {
        productServiceName: 'Custom valve',
        category: 'industrialEquipment',
      },
    },
  });
  assert.equal(missingType.success, false);

  const invalidMix = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inDemand',
      supplyDetails: {
        productServiceName: 'Custom valve',
        category: 'industrialEquipment',
      },
    },
  });
  assert.equal(invalidMix.success, false);
});

test('createDirectRequest enforces targetCompanyId and supply-only payload', () => {
  const parsed = createDirectRequestSchema.parse({
    body: {
      targetCompanyId: 55,
      supplyDetails: {
        productServiceName: 'Copper wire',
        category: 'rawMaterial',
      },
    },
  });
  assert.equal(parsed.body.targetCompanyId, 55);

  const invalid = createDirectRequestSchema.safeParse({
    body: {
      targetCompanyId: 55,
      demandDetails: {
        productServiceName: 'Copper wire',
      },
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
