module.exports = {
  get router() {
    return require('./routes/support.routes');
  },
  get service() {
    return require('./service/support.service');
  },
};
