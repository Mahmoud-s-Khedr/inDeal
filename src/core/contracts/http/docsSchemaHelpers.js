const { z } = require('zod');

const docsDateTime = () => z.string().datetime();

module.exports = {
  docsDateTime,
};
