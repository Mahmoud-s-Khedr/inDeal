const { pool } = require('../../../infrastructure/config/db');
const prisma = require('../../../infrastructure/config/prisma');

const run = (client) => client || pool;

const statusToPrisma = {
  pending: 'PENDING',
  verified: 'VERIFIED',
  suspended: 'SUSPENDED',
};

const statusFromPrisma = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  SUSPENDED: 'suspended',
};

const roleFromPrisma = {
  AGENT: 'agent',
  ADMIN: 'admin',
  SUPPORT: 'support',
};

const roleToPrisma = {
  agent: 'AGENT',
  admin: 'ADMIN',
  support: 'SUPPORT',
};

const normalizeUser = (user) => {
  if (!user) return user;
  return {
    ...user,
    role: roleFromPrisma[user.role] || user.role,
    status: statusFromPrisma[user.status] || user.status,
  };
};

const normalizeUserUpdateData = (updates = {}) => {
  const normalized = {};
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) return;

    if (key === 'status') {
      normalized.status = statusToPrisma[value] || value;
      return;
    }

    if (key === 'role') {
      normalized.role = roleToPrisma[value] || value;
      return;
    }

    normalized[key] = value;
  });
  return normalized;
};

const createUser = async (client, user) => {
  // Kept as raw SQL to support caller-owned PG transactions.
  const executor = run(client);
  const result = await executor.query(
    `
        INSERT INTO users (
            username,
            email,
            password_hash,
            first_name,
            last_name,
            job_title
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, username, email, first_name, last_name, job_title, role, created_at, updated_at
        `,
    [
      user.username,
      user.email,
      user.passwordHash,
      user.firstName,
      user.lastName,
      user.jobTitle || null,
    ]
  );

  return result.rows[0];
};

const findByEmail = async (email) => {
  const user = await prisma.user.findFirst({ where: { email } });
  return normalizeUser(user);
};

const findByUsername = async (username) => {
  const user = await prisma.user.findFirst({ where: { username } });
  return normalizeUser(user);
};

const findById = async (id) => {
  const user = await prisma.user.findUnique({ where: { id } });
  return normalizeUser(user);
};

const updateById = async (userId, updates) => {
  const data = normalizeUserUpdateData(updates);

  if (!Object.keys(data).length) {
    return await findById(userId);
  }

  let updated;
  try {
    updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
  } catch (error) {
    if (error && error.code === 'P2025') {
      return null;
    }
    throw error;
  }

  return normalizeUser(updated) || null;
};

const updatePasswordHash = async (userId, passwordHash, client) => {
  if (!client) {
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          password_hash: passwordHash,
          updated_at: new Date(),
        },
      });
      return normalizeUser(updated);
    } catch (error) {
      if (error && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }

  const executor = run(client);
  const result = await executor.query(
    `
        UPDATE users
        SET password_hash = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
    [userId, passwordHash]
  );
  return result.rows[0];
};

const listRecentPasswordHistoryHashes = async (userId, limit = 2, client) => {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 2;

  // Kept as raw SQL when a transaction client is passed.
  if (!client) {
    const rows = await prisma.userPasswordHistory.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: safeLimit,
      select: { password_hash: true },
    });
    return rows.map((r) => r.password_hash);
  }

  const executor = run(client);
  const result = await executor.query(
    `
        SELECT password_hash
        FROM user_password_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        `,
    [userId, safeLimit]
  );
  return result.rows.map((r) => r.password_hash);
};

const insertPasswordHistory = async (userId, passwordHash, client) => {
  // Kept as raw SQL when a transaction client is passed.
  if (!client) {
    return await prisma.userPasswordHistory.create({
      data: {
        user_id: userId,
        password_hash: passwordHash,
      },
    });
  }

  const executor = run(client);
  const result = await executor.query(
    `
        INSERT INTO user_password_history (user_id, password_hash)
        VALUES ($1, $2)
        RETURNING id, user_id, password_hash, created_at
        `,
    [userId, passwordHash]
  );
  return result.rows[0];
};

const prunePasswordHistory = async (userId, keep = 10, client) => {
  const safeKeep = Number.isInteger(keep) && keep >= 0 ? keep : 10;

  // Kept as raw SQL when a transaction client is passed.
  if (!client) {
    const keepRows = await prisma.userPasswordHistory.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: safeKeep,
      select: { id: true },
    });

    await prisma.userPasswordHistory.deleteMany({
      where: {
        user_id: userId,
        id: {
          notIn: keepRows.map((row) => row.id),
        },
      },
    });

    return;
  }

  const executor = run(client);

  await executor.query(
    `
        DELETE FROM user_password_history
        WHERE user_id = $1
          AND id NOT IN (
              SELECT id
              FROM user_password_history
              WHERE user_id = $1
              ORDER BY created_at DESC
              LIMIT $2
          )
        `,
    [userId, safeKeep]
  );
};

const updateStatus = async (userId, status, client) => {
  const normalizedStatus = statusToPrisma[status] || status;
  const dbStatus = statusFromPrisma[status] || status;

  // Keep raw SQL path for transaction-scoped updates.
  if (client) {
    const executor = run(client);
    const result = await executor.query(
      `
          UPDATE users
          SET status = $2,
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
          `,
      [userId, dbStatus]
    );
    return normalizeUser(result.rows[0] || null);
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        status: normalizedStatus,
        updated_at: new Date(),
      },
    });
    return normalizeUser(updated);
  } catch (error) {
    if (error && error.code === 'P2025') {
      return null;
    }
    throw error;
  }
};

module.exports = {
  createUser,
  findByEmail,
  findByUsername,
  findById,
  updateById,
  updatePasswordHash,
  listRecentPasswordHistoryHashes,
  insertPasswordHistory,
  prunePasswordHistory,
  updateStatus,
};
