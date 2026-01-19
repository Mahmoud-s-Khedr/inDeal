const { storage } = require('../config/env');

const MAX_FILE_SIZE_BYTES = storage.maxUploadBytes;
const SIGNED_URL_TTL_SECONDS = storage.signedUrlTtlSeconds;

module.exports = {
  MAX_FILE_SIZE_BYTES,
  SIGNED_URL_TTL_SECONDS,
};
