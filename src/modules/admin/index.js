module.exports = {
  get router() {
    return require('./routes/admin.routes');
  },
  get service() {
    return require('./service/admin.service');
  },
};
