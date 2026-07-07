module.exports = {
  get router() {
    return require('./routes/admin.routes');
  },
  get service() {
    return require('./service');
  },
  get repository() {
    return require('./repository');
  },
  get validation() {
    return require('./validation/admin.validation');
  },
};
