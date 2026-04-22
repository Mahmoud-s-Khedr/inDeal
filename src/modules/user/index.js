module.exports = {
  get router() {
    return require('./routes/user.routes');
  },
  get service() {
    return require('./service/user.service');
  },
  get repository() {
    return require('./repository');
  },
};
