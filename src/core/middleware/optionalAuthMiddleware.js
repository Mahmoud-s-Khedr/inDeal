const { verifyToken } = require('../../shared/utils/jwt');
const userModule = require('../../modules/user');
const companyModule = require('../../modules/company');
const { userRepository } = userModule.repository;
const { companyRepository } = companyModule.repository;

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No token, continue without auth
    }

    const token = authHeader.split(' ')[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return next(); // Invalid token, continue without auth
    }

    const user = await userRepository.findById(decoded.id);
    if (user) {
      const company = await companyRepository.findByAgentId(user.id);
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        company: company ? { id: company.id, name: company.name, status: company.status } : null,
      };
    }

    next();
  } catch {
    // Any error, just continue without auth
    next();
  }
};

module.exports = optionalAuth;
