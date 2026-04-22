module.exports = {
  get router() {
    return require('./routes/deal.routes');
  },
  get service() {
    return require('./service/deal.service');
  },
  get repository() {
    return require('./repository');
  },
};
