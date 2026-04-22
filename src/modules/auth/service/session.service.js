const crypto = require('crypto');
const redis = require('../../../infrastructure/config/redis');
const config = require('../../../infrastructure/config/env');
const AppError = require('../../../core/errors/AppError');
const logger = require('../../../shared/utils/logger');

const LEGACY_SESSION_PREFIX = 'auth:session:user:';
const SESSION_TTL_SECONDS = config.session.refreshTtlDays * 24 * 60 * 60;
const ROTATE_LEEWAY_SECONDS = config.session.rotateLeewaySeconds;
const SESSION_TYPES = Object.freeze({
  WEB: 'web',
  MOBILE: 'mobile',
});

const redisFailure = (error) => {
  logger.error('Valkey session operation failed', error);
  throw new AppError('Authentication is temporarily unavailable. Please try again later.', 503);
};

const buildSessionKey = (userId, sessionType) => `${LEGACY_SESSION_PREFIX}${userId}:${sessionType}`;

const inferSessionType = (userAgent = '') => {
  const value = String(userAgent).toLowerCase();
  return /(android|iphone|ipad|ipod|mobile)/.test(value) ? SESSION_TYPES.MOBILE : SESSION_TYPES.WEB;
};

const generateServerSessionToken = () => crypto.randomBytes(48).toString('hex');
const generateJti = () => crypto.randomBytes(16).toString('hex');

const createOrReplaceSession = async ({ userId, sessionType, jti, ipAddress, userAgent }) => {
  const now = new Date().toISOString();
  const payload = {
    userId: Number(userId),
    sessionType,
    serverSessionToken: generateServerSessionToken(),
    activeJti: jti,
    previousJti: null,
    previousJtiValidUntil: null,
    createdAt: now,
    lastSeenAt: now,
    lastIp: ipAddress || null,
    lastUserAgent: userAgent || null,
  };

  try {
    await redis.set(
      buildSessionKey(userId, sessionType),
      JSON.stringify(payload),
      'EX',
      SESSION_TTL_SECONDS
    );
  } catch (error) {
    redisFailure(error);
  }

  return payload;
};

const getSession = async (userId, sessionType) => {
  try {
    const raw = await redis.get(buildSessionKey(userId, sessionType));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    redisFailure(error);
  }
};

const rotateSession = async ({
  userId,
  sessionType,
  currentSession,
  newJti,
  ipAddress,
  userAgent,
}) => {
  const nowMs = Date.now();
  const previousValidUntil = new Date(nowMs + ROTATE_LEEWAY_SECONDS * 1000).toISOString();
  const updatedSession = {
    ...currentSession,
    previousJti: currentSession.activeJti || null,
    previousJtiValidUntil: currentSession.activeJti ? previousValidUntil : null,
    activeJti: newJti,
    lastSeenAt: new Date().toISOString(),
    lastIp: ipAddress || null,
    lastUserAgent: userAgent || null,
  };

  try {
    await redis.set(
      buildSessionKey(userId, sessionType),
      JSON.stringify(updatedSession),
      'EX',
      SESSION_TTL_SECONDS
    );
  } catch (error) {
    redisFailure(error);
  }

  return updatedSession;
};

const isJtiAccepted = (session, candidateJti) => {
  if (!session || !candidateJti) return false;
  if (session.activeJti === candidateJti) return true;
  if (!session.previousJti || session.previousJti !== candidateJti) return false;
  if (!session.previousJtiValidUntil) return false;
  return Date.now() <= new Date(session.previousJtiValidUntil).getTime();
};

const deleteSession = async (userId, sessionType) => {
  try {
    await redis.del(buildSessionKey(userId, sessionType));
    logger.debug('Session revoked', { userId, sessionType });
  } catch (error) {
    redisFailure(error);
  }
};

const deleteAllSessionsForUser = async (userId) => {
  try {
    await redis.del(
      buildSessionKey(userId, SESSION_TYPES.WEB),
      buildSessionKey(userId, SESSION_TYPES.MOBILE)
    );

    logger.info('All sessions revoked for user', { userId });
  } catch (error) {
    redisFailure(error);
  }
};

module.exports = {
  inferSessionType,
  generateJti,
  createOrReplaceSession,
  getSession,
  rotateSession,
  isJtiAccepted,
  deleteSession,
  deleteAllSessionsForUser,
  SESSION_TYPES,
};
