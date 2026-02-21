const crypto = require('crypto');
const redis = require('../config/redis');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const LEGACY_SESSION_PREFIX = 'auth:session:user:';
const SESSION_PREFIX = 'auth:session:';
const USER_SESSIONS_PREFIX = 'auth:user-sessions:';
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

const buildLegacySessionKey = (userId, sessionType) =>
  `${LEGACY_SESSION_PREFIX}${userId}:${sessionType}`;
const buildSessionKeyBySid = (sid) => `${SESSION_PREFIX}${sid}`;
const buildUserSessionsKey = (userId, sessionType) =>
  `${USER_SESSIONS_PREFIX}${userId}:${sessionType}`;

const inferSessionType = (userAgent = '') => {
  const value = String(userAgent).toLowerCase();
  return /(android|iphone|ipad|ipod|mobile)/.test(value) ? SESSION_TYPES.MOBILE : SESSION_TYPES.WEB;
};

const generateServerSessionToken = () => crypto.randomBytes(48).toString('hex');
const generateSessionId = () => crypto.randomBytes(16).toString('hex');
const generateJti = () => crypto.randomBytes(16).toString('hex');

const createSession = async ({ userId, sessionType, sid, jti, ipAddress, userAgent }) => {
  const now = new Date().toISOString();
  const payload = {
    sid,
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
    const pipeline = redis.pipeline();
    pipeline.set(buildSessionKeyBySid(sid), JSON.stringify(payload), 'EX', SESSION_TTL_SECONDS);
    pipeline.zadd(buildUserSessionsKey(userId, sessionType), Date.now(), sid);
    pipeline.expire(buildUserSessionsKey(userId, sessionType), SESSION_TTL_SECONDS);
    await pipeline.exec();
  } catch (error) {
    redisFailure(error);
  }

  return payload;
};

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
      buildLegacySessionKey(userId, sessionType),
      JSON.stringify(payload),
      'EX',
      SESSION_TTL_SECONDS
    );
  } catch (error) {
    redisFailure(error);
  }

  return payload;
};

const getSessionBySid = async (sid) => {
  try {
    const raw = await redis.get(buildSessionKeyBySid(sid));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    redisFailure(error);
  }
};

const getSession = async (userId, sessionType) => {
  try {
    const raw = await redis.get(buildLegacySessionKey(userId, sessionType));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    redisFailure(error);
  }
};

const rotatePayload = ({ currentSession, newJti, ipAddress, userAgent }) => {
  const nowMs = Date.now();
  const previousValidUntil = new Date(nowMs + ROTATE_LEEWAY_SECONDS * 1000).toISOString();
  return {
    ...currentSession,
    previousJti: currentSession.activeJti || null,
    previousJtiValidUntil: currentSession.activeJti ? previousValidUntil : null,
    activeJti: newJti,
    lastSeenAt: new Date().toISOString(),
    lastIp: ipAddress || null,
    lastUserAgent: userAgent || null,
  };
};

const rotateSessionBySid = async ({ sid, currentSession, newJti, ipAddress, userAgent }) => {
  const updatedSession = rotatePayload({ currentSession, newJti, ipAddress, userAgent });

  try {
    const pipeline = redis.pipeline();
    pipeline.set(
      buildSessionKeyBySid(sid),
      JSON.stringify(updatedSession),
      'EX',
      SESSION_TTL_SECONDS
    );
    pipeline.zadd(
      buildUserSessionsKey(updatedSession.userId, updatedSession.sessionType),
      Date.now(),
      sid
    );
    pipeline.expire(
      buildUserSessionsKey(updatedSession.userId, updatedSession.sessionType),
      SESSION_TTL_SECONDS
    );
    await pipeline.exec();
  } catch (error) {
    redisFailure(error);
  }

  return updatedSession;
};

const rotateSession = async ({
  userId,
  sessionType,
  currentSession,
  newJti,
  ipAddress,
  userAgent,
}) => {
  const updatedSession = rotatePayload({ currentSession, newJti, ipAddress, userAgent });

  try {
    await redis.set(
      buildLegacySessionKey(userId, sessionType),
      JSON.stringify(updatedSession),
      'EX',
      SESSION_TTL_SECONDS
    );
  } catch (error) {
    redisFailure(error);
  }

  return updatedSession;
};

const deleteSessionBySid = async (sid, userId, sessionType) => {
  try {
    const session = await getSessionBySid(sid);
    const resolvedUserId = userId || session?.userId;
    const resolvedSessionType = sessionType || session?.sessionType;

    const pipeline = redis.pipeline();
    pipeline.del(buildSessionKeyBySid(sid));
    if (resolvedUserId && resolvedSessionType) {
      pipeline.zrem(buildUserSessionsKey(resolvedUserId, resolvedSessionType), sid);
    }
    await pipeline.exec();

    logger.debug('Session revoked by sid', {
      sid,
      userId: resolvedUserId || null,
      sessionType: resolvedSessionType || null,
    });
  } catch (error) {
    redisFailure(error);
  }
};

const cleanupStaleSessionRefs = async (userId, sessionType) => {
  const key = buildUserSessionsKey(userId, sessionType);
  try {
    const sids = await redis.zrange(key, 0, -1);
    if (!sids.length) return;

    const stale = [];
    for (const sid of sids) {
      const exists = await redis.exists(buildSessionKeyBySid(sid));
      if (!exists) stale.push(sid);
    }

    if (stale.length) {
      await redis.zrem(key, ...stale);
    }
  } catch (error) {
    redisFailure(error);
  }
};

const listSessionIds = async (userId, sessionType) => {
  try {
    return await redis.zrange(buildUserSessionsKey(userId, sessionType), 0, -1);
  } catch (error) {
    redisFailure(error);
  }
};

const deleteAllSessionsForUser = async (userId) => {
  try {
    const allSids = [];
    for (const sessionType of Object.values(SESSION_TYPES)) {
      await cleanupStaleSessionRefs(userId, sessionType);
      const ids = await listSessionIds(userId, sessionType);
      if (ids?.length) {
        allSids.push(...ids);
      }
    }

    const pipeline = redis.pipeline();
    if (allSids.length) {
      allSids.forEach((sid) => pipeline.del(buildSessionKeyBySid(sid)));
    }

    pipeline.del(
      buildUserSessionsKey(userId, SESSION_TYPES.WEB),
      buildUserSessionsKey(userId, SESSION_TYPES.MOBILE),
      buildLegacySessionKey(userId, SESSION_TYPES.WEB),
      buildLegacySessionKey(userId, SESSION_TYPES.MOBILE)
    );
    await pipeline.exec();

    logger.info('All sessions revoked for user', {
      userId,
      revokedSessionCount: allSids.length,
    });
  } catch (error) {
    redisFailure(error);
  }
};

const isJtiAccepted = (session, tokenJti) => {
  if (!session || !tokenJti) return false;
  if (session.activeJti === tokenJti) return true;
  if (!session.previousJti || session.previousJti !== tokenJti || !session.previousJtiValidUntil) {
    return false;
  }
  return Date.now() <= new Date(session.previousJtiValidUntil).getTime();
};

const deleteAllSessions = async (userId) => {
  await deleteAllSessionsForUser(userId);
};

module.exports = {
  SESSION_TYPES,
  inferSessionType,
  generateSessionId,
  generateJti,
  createSession,
  createOrReplaceSession,
  getSessionBySid,
  getSession,
  rotateSessionBySid,
  rotateSession,
  deleteSessionBySid,
  deleteAllSessionsForUser,
  cleanupStaleSessionRefs,
  isJtiAccepted,
  deleteAllSessions,
};
