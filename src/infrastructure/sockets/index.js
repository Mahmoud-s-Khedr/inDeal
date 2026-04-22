/**
 * Socket.io handlers index
 * Exports all socket handlers for easy access
 */

const chatHandler = require('./chat.handler');

module.exports = {
  ...chatHandler,
};
