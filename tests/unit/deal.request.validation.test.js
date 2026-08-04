require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createDealRequestSchema,
  createDirectRequestSchema,
  listMyDealsSchema,
  listDealRequestsSchema,
  listMyRequestsSchema,
  listMyApplicationsSchema,
  listMyDirectRequestsSchema,
  updateDealRequestSchema,
  sendDealEmailSchema,
} = require('../../src/modules/deal/validation/deal.validation');

const validSupplyDetails = {
  productServiceName: 'Steel bars',
  category: 'rawMaterial',
  quantityRequired: 10,
  deliveryLocation: 'Cairo',
  deliveryDate: '2026-09-01T00:00:00.000Z',
  targetPrice: 1250,
  currency: 'USD',
  keySpecifications: 'ASTM A36',
  maxLeadTimeAccepted: '10 days',
  deliveryMethodPreference: 'supplierDelivers',
};

const validDemandDetails = {
  productServiceName: 'Pump',
  availableQuantity: 10,
  offerValidityDays: 30,
  unitPrice: 120,
  currency: 'USD',
  moq: 5,
  availabilityType: 'inStock',
  specsMatchRfq: 'exact',
  materialOffered: 'Steel',
  dimensions: '20x10 cm',
  paymentTerms: 'Net 30',
  deliveryTerms: 'FOB',
};

const requiredSupplyDetailFields = [
  'quantityRequired',
  'deliveryLocation',
  'deliveryDate',
  'targetPrice',
  'currency',
  'keySpecifications',
  'maxLeadTimeAccepted',
  'deliveryMethodPreference',
];

const requiredDemandDetailFields = [
  'availableQuantity',
  'offerValidityDays',
  'unitPrice',
  'currency',
  'moq',
  'availabilityType',
  'specsMatchRfq',
  'materialOffered',
  'paymentTerms',
  'deliveryTerms',
];

test('request detail DTOs require every mandatory supply and demand field', () => {
  for (const field of requiredSupplyDetailFields) {
    const supplyDetails = { ...validSupplyDetails };
    delete supplyDetails[field];

    const result = createDealRequestSchema.safeParse({
      params: { id: 1 },
      body: { requestType: 'inSupply', supplyDetails },
    });
    assert.equal(result.success, false, `supplyDetails.${field} must be required`);
  }

  for (const field of requiredDemandDetailFields) {
    const demandDetails = { ...validDemandDetails };
    delete demandDetails[field];

    const result = createDealRequestSchema.safeParse({
      params: { id: 1 },
      body: { requestType: 'inDemand', demandDetails },
    });
    assert.equal(result.success, false, `demandDetails.${field} must be required`);
  }
});

test('request detail DTO accepts demand details without optional dimensions', () => {
  const demandDetails = { ...validDemandDetails };
  delete demandDetails.dimensions;

  const result = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: { requestType: 'inDemand', demandDetails },
  });

  assert.equal(result.success, true);
});

test('createDealRequest accepts camelCase supply enums and rejects removed values', () => {
  const valid = createDealRequestSchema.safeParse({
    params: { id: 1 },
    body: {
      requestType: 'inSupply',
      supplyDetails: {
        ...validSupplyDetails,
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
        ...validSupplyDetails,
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
        ...validSupplyDetails,
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
        ...validSupplyDetails,
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
        ...validDemandDetails,
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
        ...validDemandDetails,
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
        ...validDemandDetails,
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
        ...validSupplyDetails,
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

test('listMyRequests accepts base filters and supported requestType values', () => {
  const parsed = listMyRequestsSchema.parse({
    query: {
      status: 'pending',
      canceled: 'false',
      sortBy: 'date',
      sortOrder: 'desc',
      limit: 10,
      offset: 0,
    },
  });

  assert.equal(parsed.query.status, 'pending');
  assert.equal(parsed.query.canceled, false);

  const direct = listMyRequestsSchema.safeParse({
    query: {
      type: 'direct',
      limit: 10,
      offset: 0,
    },
  });
  assert.equal(direct.success, true);

  const inSupply = listMyRequestsSchema.safeParse({
    query: {
      type: 'supply',
      limit: 10,
      offset: 0,
    },
  });
  assert.equal(inSupply.success, true);

  const invalid = listMyRequestsSchema.safeParse({
    query: {
      type: 'inDemand',
      limit: 10,
      offset: 0,
    },
  });
  assert.equal(invalid.success, false);
});

test('listMyDeals accepts type and search-aligned sorting', () => {
  const valid = listMyDealsSchema.safeParse({
    query: {
      type: 'supply',
      sortBy: 'applications',
      sortOrder: 'asc',
      limit: 10,
      offset: 0,
    },
  });
  assert.equal(valid.success, true);

  const invalid = listMyDealsSchema.safeParse({
    query: {
      type: 'rfq',
      sortBy: 'offers',
      limit: 10,
      offset: 0,
    },
  });
  assert.equal(invalid.success, false);
});

test('listDealRequests accepts inSupply and inDemand requestType filters only', () => {
  const inSupply = listDealRequestsSchema.safeParse({
    params: { id: 1 },
    query: {
      requestType: 'inSupply',
      canceled: true,
      sortBy: 'price',
      sortOrder: 'asc',
      limit: 10,
      offset: 0,
    },
  });
  assert.equal(inSupply.success, true);

  const inDemand = listDealRequestsSchema.safeParse({
    params: { id: 1 },
    query: {
      requestType: 'inDemand',
      limit: 10,
      offset: 0,
    },
  });
  assert.equal(inDemand.success, true);

  const invalid = listDealRequestsSchema.safeParse({
    params: { id: 1 },
    query: {
      requestType: 'direct',
      limit: 10,
      offset: 0,
    },
  });
  assert.equal(invalid.success, false);
});

test('request list schemas accept canceled filter and reject applications sorting', () => {
  const schemas = [listDealRequestsSchema, listMyApplicationsSchema, listMyDirectRequestsSchema];

  for (const schema of schemas) {
    const valid = schema.safeParse({
      ...(schema === listDealRequestsSchema ? { params: { id: 1 } } : {}),
      query: {
        canceled: 'false',
        sortBy: 'date',
        sortOrder: 'desc',
        limit: 10,
        offset: 0,
      },
    });
    assert.equal(valid.success, true);
    assert.equal(valid.data.query.canceled, false);

    const truthy = schema.safeParse({
      ...(schema === listDealRequestsSchema ? { params: { id: 1 } } : {}),
      query: {
        canceled: 'true',
        limit: 10,
        offset: 0,
      },
    });
    assert.equal(truthy.success, true);
    assert.equal(truthy.data.query.canceled, true);

    const zero = schema.safeParse({
      ...(schema === listDealRequestsSchema ? { params: { id: 1 } } : {}),
      query: {
        canceled: '0',
        limit: 10,
        offset: 0,
      },
    });
    assert.equal(zero.success, true);
    assert.equal(zero.data.query.canceled, false);

    const one = schema.safeParse({
      ...(schema === listDealRequestsSchema ? { params: { id: 1 } } : {}),
      query: {
        canceled: '1',
        limit: 10,
        offset: 0,
      },
    });
    assert.equal(one.success, true);
    assert.equal(one.data.query.canceled, true);

    const invalid = schema.safeParse({
      ...(schema === listDealRequestsSchema ? { params: { id: 1 } } : {}),
      query: {
        sortBy: 'applications',
        limit: 10,
        offset: 0,
      },
    });
    assert.equal(invalid.success, false);

    const invalidBoolean = schema.safeParse({
      ...(schema === listDealRequestsSchema ? { params: { id: 1 } } : {}),
      query: {
        canceled: 'nope',
        limit: 10,
        offset: 0,
      },
    });
    assert.equal(invalidBoolean.success, false);
  }
});

test('createDealRequest requires requestType and routes by detail kind', () => {
  const validSupply = createDealRequestSchema.parse({
    params: { id: 1 },
    body: {
      requestType: 'inSupply',
      supplyDetails: {
        ...validSupplyDetails,
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
        ...validSupplyDetails,
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
        ...validSupplyDetails,
        productServiceName: 'Copper wire',
        category: 'rawMaterial',
      },
    },
  });
  assert.equal(invalid.success, false);
});

test('updateDealRequest accepts supply-side replacement payload', () => {
  const parsed = updateDealRequestSchema.safeParse({
    params: { requestId: 55 },
    body: {
      supplyDetails: {
        ...validSupplyDetails,
        productServiceName: 'Copper wire',
        category: 'rawMaterial',
      },
      attachments: [{ fileId: 9, sortOrder: 0 }],
    },
  });
  assert.equal(parsed.success, true);
});

test('updateDealRequest accepts demand-side replacement payload', () => {
  const demandDetails = { ...validDemandDetails };
  delete demandDetails.dimensions;

  const parsed = updateDealRequestSchema.safeParse({
    params: { requestId: 55 },
    body: {
      demandDetails: {
        ...demandDetails,
        productServiceName: 'Copper wire',
      },
      attachments: [],
    },
  });
  assert.equal(parsed.success, true);
});

test('updateDealRequest rejects missing or mixed detail payloads', () => {
  const missing = updateDealRequestSchema.safeParse({
    params: { requestId: 55 },
    body: {
      attachments: [],
    },
  });
  assert.equal(missing.success, false);

  const mixed = updateDealRequestSchema.safeParse({
    params: { requestId: 55 },
    body: {
      supplyDetails: {
        productServiceName: 'Copper wire',
        category: 'rawMaterial',
      },
      demandDetails: {
        productServiceName: 'Pump',
      },
      attachments: [],
    },
  });
  assert.equal(mixed.success, false);
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
