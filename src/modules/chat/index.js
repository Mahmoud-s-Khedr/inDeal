module.exports = {
  get router() {
    return require('./routes/chat.routes');
  },
  get service() {
    return require('./service/chat.service');
  },
};
