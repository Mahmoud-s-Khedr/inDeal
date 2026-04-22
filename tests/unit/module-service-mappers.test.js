require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');

const dealService = require('../../src/modules/deal/service/deal.service');
const companyService = require('../../src/modules/company/service/company.service');
const chatService = require('../../src/modules/chat/service/chat.service');

test('deal mapper infers request offer/details', () => {
  const { inferRequestOffer, inferRequestDetailsSummary } = dealService.__testables;

  assert.equal(
    inferRequestOffer({ requestKind: 'demand', demandDetails: { unitPrice: 120 } }),
    120
  );
  assert.equal(
    inferRequestDetailsSummary({
      requestKind: 'supply',
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
