const AppError = require('../../../core/errors/AppError');
const userModule = require('../../user');
const { userAdminRepository } = require('../repository');
const { mapPaginated, mapUserSummary, mapUserDetail } = require('../mappers/admin.mappers');

const { userRepository } = userModule.repository;

const listUsers = async (query) => {
  const page = query.page;
  const limit = query.limit;
  const offset = (page - 1) * limit;

  const [items, total] = await Promise.all([
    userAdminRepository.listUsers({ ...query, limit, offset }),
    userAdminRepository.countUsers(query),
  ]);

  return mapPaginated({
    items: items.map(mapUserSummary),
    total,
    page,
    limit,
  });
};

const getUserById = async (userId) => {
  const user = await userAdminRepository.findUserDetailById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  return mapUserDetail(user);
};

const ensureNotRemovingLastAdmin = async (user, nextRole, nextStatus) => {
  const roleWillStayAdmin = nextRole ? nextRole === 'admin' : user.role === 'admin';
  const statusWillRemainActive = nextStatus
    ? nextStatus !== 'suspended'
    : user.status !== 'suspended';

  if (roleWillStayAdmin && statusWillRemainActive) return;
  if (user.role !== 'admin' || user.status === 'suspended') return;

  const remainingAdmins = await userAdminRepository.countActiveAdminsExcludingUser(user.id);
  if (remainingAdmins < 1) {
    throw new AppError('At least one active admin must remain', 400);
  }
};

const updateUserStatus = async (_actorUserId, userId, payload) => {
  const existing = await userRepository.findById(userId);
  if (!existing) {
    throw new AppError('User not found', 404);
  }

  await ensureNotRemovingLastAdmin(existing, null, payload.status);
  const updated = await userRepository.updateById(userId, { status: payload.status });
  return getUserById(updated.id);
};

const updateUserRole = async (actorUserId, userId, payload) => {
  const existing = await userRepository.findById(userId);
  if (!existing) {
    throw new AppError('User not found', 404);
  }

  if (actorUserId === userId && existing.role === 'admin' && payload.role !== 'admin') {
    throw new AppError('You cannot remove your own admin role', 400);
  }

  await ensureNotRemovingLastAdmin(existing, payload.role, null);
  const updated = await userRepository.updateById(userId, { role: payload.role });
  return getUserById(updated.id);
};

module.exports = {
  listUsers,
  getUserById,
  updateUserStatus,
  updateUserRole,
};
