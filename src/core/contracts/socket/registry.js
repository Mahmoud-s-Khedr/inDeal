const { z } = require('zod');
const socketContracts = require('./events');

const byEventDirection = new Map();

for (const contract of socketContracts) {
  byEventDirection.set(`${contract.direction}:${contract.event}`, contract);
}

const getSocketContract = (direction, event) => byEventDirection.get(`${direction}:${event}`);

const validateSocketPayload = ({ direction, event, payload }) => {
  const contract = getSocketContract(direction, event);
  if (!contract) return { success: false, reason: 'missing_contract' };
  const parsed = contract.schema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, reason: 'validation_error', error: parsed.error };
  }
  return { success: true, data: parsed.data, contract };
};

const toJsonSchema = (schema) => {
  try {
    return z.toJSONSchema(schema);
  } catch {
    return { type: 'object' };
  }
};

const buildAsyncApiSpec = () => {
  const channels = {};

  for (const contract of socketContracts) {
    const channel = channels[contract.event] || {};
    const message = {
      name: contract.event,
      payload: toJsonSchema(contract.schema),
    };

    if (contract.direction === 'receive') {
      channel.subscribe = {
        summary: `Client publishes ${contract.event}`,
        message,
      };
    }

    if (contract.direction === 'send') {
      channel.publish = {
        summary: `Server publishes ${contract.event}`,
        message,
      };
    }

    channel.bindings = {
      socketio: {
        authRequired: contract.auth === true,
      },
    };

    channels[contract.event] = channel;
  }

  return {
    asyncapi: '2.6.0',
    info: {
      title: 'inDeal Realtime API',
      version: '1.0.0',
      description: 'AsyncAPI docs for Socket.IO events generated from Zod contracts.',
    },
    defaultContentType: 'application/json',
    servers: {
      production: {
        url: process.env.API_BASE_URL || 'http://localhost:3000',
        protocol: 'socket.io',
      },
    },
    channels,
  };
};

module.exports = {
  socketContracts,
  getSocketContract,
  validateSocketPayload,
  buildAsyncApiSpec,
};
