module.exports = {
  get router() {
    return require('./routes/company.routes');
  },
  get service() {
    return require('./service/company.service');
  },
  get repository() {
    return require('./repository');
  },
};
