module.exports = {
  get router() {
    return require('./routes/auth.routes');
  },
  get service() {
    return require('./service/auth.service');
  },
  get sessionService() {
    return require('./service/session.service');
  },
};
