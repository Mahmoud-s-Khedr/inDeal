const AppError = require('../utils/AppError');
const config = require('../config/env');
const userRepository = require('../repositories/user.repository');

const sanitizeUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    status: user.status,
    updatedAt: user.updated_at,
  };
};

const ensureDevOnly = () => {
  if (config.app.env !== 'development') {
    throw new AppError('This action is only allowed in development', 403);
  }
};

const changeAgentEmail = async (agentId, email) => {
  ensureDevOnly();

  const user = await userRepository.findById(agentId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role !== 'agent') {
    throw new AppError('Only agent emails can be updated', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await userRepository.findByEmail(normalizedEmail);
  if (existing && existing.id !== user.id) {
    throw new AppError('Email already in use', 409);
  }

  const updated = await userRepository.updateById(user.id, {
    email: normalizedEmail,
  });

  return sanitizeUser(updated);
};

module.exports = {
  changeAgentEmail,
};
