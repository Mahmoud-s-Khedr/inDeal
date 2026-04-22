module.exports = {
  get router() {
    return require('./routes/file.routes');
  },
  get service() {
    return require('./service/file.service');
  },
  get repository() {
    return require('./repository');
  },
  get validation() {
    return require('./validation/file.validation');
  },
};
