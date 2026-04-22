const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../../infrastructure/config/env');

const signToken = (id, payload = {}) => {
  return jwt.sign({ id, ...payload }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });
};

const verifyToken = (token, options = {}) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, jwtConfig.secret, options, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
};

module.exports = { signToken, verifyToken };
