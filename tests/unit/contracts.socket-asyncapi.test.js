const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAsyncApiSpec,
  validateSocketPayload,
  socketContracts,
} = require('../../src/core/contracts/socket/registry');

test('asyncapi spec contains all socket contracts as channels', () => {
  const spec = buildAsyncApiSpec();
  const channels = Object.keys(spec.channels || {});
  const uniqueEvents = [...new Set(socketContracts.map((c) => c.event))];

  for (const event of uniqueEvents) {
    assert.equal(channels.includes(event), true, `Missing channel for ${event}`);
  }
});

test('socket payload validator rejects invalid payload', () => {
  const result = validateSocketPayload({
    direction: 'receive',
    event: 'chat:typing',
    payload: { roomId: 'abc', isTyping: true },
  });

  assert.equal(result.success, false);
});
