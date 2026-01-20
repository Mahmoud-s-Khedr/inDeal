/**
 * Socket.io handlers index
 * Exports all socket handlers for easy access
 */

const chatHandler = require('./chat.handler');
const supportChatHandler = require('./supportChat.handler');

module.exports = {
  ...chatHandler,
  ...supportChatHandler,
};

