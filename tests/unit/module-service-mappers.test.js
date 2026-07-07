require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');

const dealService = require('../../src/modules/deal/service/deal.service');
const companyService = require('../../src/modules/company/service/company.service');
const chatService = require('../../src/modules/chat/service/chat.service');

test('deal mapper infers request offer/details', () => {
  const { inferRequestOffer, inferRequestDetailsSummary } = dealService.__testables;

  assert.equal(
    inferRequestOffer({ requestType: 'inDemand', demandDetails: { unitPrice: 120 } }),
    120
  );
  assert.equal(
    inferRequestDetailsSummary({
      requestType: 'inSupply',
      supplyDetails: { productServiceName: 'Steel' },
    }),
    'Supply request: Steel'
  );
});

test('company mapper normalizes document type', () => {
  const { toExternalDocType } = companyService.__testables;
  assert.equal(toExternalDocType('registration:commercial-register'), 'commercial-register');
  assert.equal(toExternalDocType('license'), 'license');
});

test('company mapper returns nested partner object and legacy aliases from resolved partner', () => {
  const { sanitizeContribution } = companyService.__testables;

  const contribution = sanitizeContribution(
    {
      id: 7,
      company_id: 42,
      media_file_id: null,
      media_type: null,
      type: 'partnership',
      title: 'Joint Venture',
      description: 'Strategic supply agreement.',
      details: {
        partnerId: 123,
        locations: ['Riyadh'],
      },
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
    },
    null,
    {
      companyId: 123,
      companyName: 'Saudi Aramco',
      logoFileId: 45,
      logoUrl: 'https://cdn.example.com/aramco.png',
    }
  );

  assert.deepEqual(contribution.partner, {
    id: 123,
    name: 'Saudi Aramco',
    logoFileId: 45,
    logoUrl: 'https://cdn.example.com/aramco.png',
  });
  assert.equal(contribution.partnerId, 123);
  assert.equal(contribution.partnerName, 'Saudi Aramco');
  assert.equal(contribution.partnerLogoFileId, 45);
  assert.equal(contribution.partnerLogoUrl, 'https://cdn.example.com/aramco.png');
});

test('company mapper returns partner null for non-partnership contributions', () => {
  const { sanitizeContribution } = companyService.__testables;

  const contribution = sanitizeContribution({
    id: 8,
    company_id: 42,
    media_file_id: null,
    media_type: null,
    type: 'product',
    title: 'Pump Series X',
    description: 'High-pressure pumps.',
    details: {},
    created_at: '2026-01-01',
    updated_at: '2026-01-02',
  });

  assert.equal(contribution.partner, null);
  assert.equal(contribution.partnerId, null);
  assert.equal(contribution.partnerName, null);
  assert.equal(contribution.partnerLogoFileId, null);
  assert.equal(contribution.partnerLogoUrl, null);
});

test('chat mapper sanitizes room basic shape', () => {
  const { sanitizeRoom } = chatService.__testables;
  const room = sanitizeRoom(
    {
      id: 1,
      room_key: 'r1',
      company_a_id: 10,
      company_b_id: 20,
      company_a_name: 'A',
      company_b_name: 'B',
      company_a_logo_path: null,
      company_b_logo_path: null,
      last_message_at: null,
      unread_count: 0,
      archived_by_company_a: false,
      archived_by_company_b: false,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    10
  );

  assert.equal(room.otherCompany.id, 20);
  assert.equal(room.otherCompany.name, 'B');
});
