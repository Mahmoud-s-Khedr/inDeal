module.exports = {
  get router() {
    return require('./routes/search.routes');
  },
  get service() {
    return require('./service/search.service');
  },
  get repository() {
    return require('./repository/search.repository');
  },
};
