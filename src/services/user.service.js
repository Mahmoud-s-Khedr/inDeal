const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const userRepository = require('../repositories/user.repository');
const { pool } = require('../config/db');
const config = require('../config/env');

const sanitizeUser = (user) => {
    if (!user) return null;

    return {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        profileImageFileId: user.profile_image,
        preferences: user.preferences || null,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
    };
};

const getMe = async (userId) => {
    const user = await userRepository.findById(userId);
    if (!user) {
        throw new AppError('User not found', 404);
    }
    return sanitizeUser(user);
};

const mergePreferences = (existing, patch) => {
    const base = existing && typeof existing === 'object' ? existing : {};
    const next = { ...base };

    if (patch && typeof patch === 'object') {
        if (patch.language !== undefined) next.language = patch.language;
        if (patch.theme !== undefined) next.theme = patch.theme;
    }

    return next;
};

const updateMe = async (userId, payload) => {
    const existing = await userRepository.findById(userId);
    if (!existing) {
        throw new AppError('User not found', 404);
    }

    const preferences = payload.preferences ? mergePreferences(existing.preferences, payload.preferences) : undefined;

    const updated = await userRepository.updateById(userId, {
        first_name: payload.firstName,
        last_name: payload.lastName,
        preferences,
    });

    return sanitizeUser(updated);
};

const updatePassword = async (userId, payload) => {
    const existing = await userRepository.findById(userId);
    if (!existing) {
        throw new AppError('User not found', 404);
    }

    const isValid = await bcrypt.compare(payload.currentPassword, existing.password_hash);
    if (!isValid) {
        throw new AppError('Current password is incorrect', 400);
    }

    // Prevent using the current password or recent passwords from history.
    const depth = config.passwordHistory?.depth ?? 5;
    if (depth > 0) {
        const recentHistoryHashes = await userRepository.listRecentPasswordHistoryHashes(userId, depth);
        const blockedHashes = [existing.password_hash, ...recentHistoryHashes].filter(Boolean);
        for (const hash of blockedHashes) {
            // eslint-disable-next-line no-await-in-loop
            const matches = await bcrypt.compare(payload.newPassword, hash);
            if (matches) {
                throw new AppError(`Cannot reuse your last ${depth} passwords`, 400);
            }
        }
    }

    const passwordHash = await bcrypt.hash(payload.newPassword, 12);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await userRepository.insertPasswordHistory(userId, existing.password_hash, client);
        await userRepository.updatePasswordHash(userId, passwordHash, client);
        await userRepository.prunePasswordHistory(userId, config.passwordHistory?.pruneKeep ?? 10, client);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const updateProfileImage = async (userId, payload) => {
    const existing = await userRepository.findById(userId);
    if (!existing) {
        throw new AppError('User not found', 404);
    }

    const updated = await userRepository.updateById(userId, {
        profile_image: payload.profileImageFileId,
    });

    return sanitizeUser(updated);
};

module.exports = {
    getMe,
    updateMe,
    updatePassword,
    updateProfileImage,
};
