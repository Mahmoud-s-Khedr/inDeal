const { TokenExpiredError, JsonWebTokenError, NotBeforeError } = require('jsonwebtoken');
const { verifyToken, signToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { pool } = require('../config/db');
const config = require('../config/env');
const logger = require('../utils/logger');
const companyRepository = require('../repositories/company.repository');
const sessionService = require('../services/session.service');

const unauthorizedError = () =>
  new AppError('You are not logged in! Please log in to get access.', 401);

const resolveDecodedToken = async (token) => {
  try {
    const decoded = await verifyToken(token);
    return { decoded, expired: false };
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      const decoded = await verifyToken(token, { ignoreExpiration: true });
      return { decoded, expired: true };
    }
    if (error instanceof JsonWebTokenError || error instanceof NotBeforeError) {
      throw unauthorizedError();
    }
    throw error;
  }
};

const resolveSessionForToken = async ({ userId, decoded, sessionType }) => {
  if (config.session.multiDeviceEnabled && decoded.sid) {
    const sidSession = await sessionService.getSessionBySid(decoded.sid);
    const isValidSidSession =
      sidSession &&
      Number(sidSession.userId) === Number(userId) &&
      sidSession.sessionType === sessionType &&
      sessionService.isJtiAccepted(sidSession, decoded.jti);

    if (isValidSidSession) {
      return { session: sidSession, mode: 'sid' };
    }

    logger.debug('SID session lookup failed', {
      userId,
      sessionType,
      sid: decoded.sid,
    });
  }

  if (!config.session.legacyFallbackEnabled) {
    return { session: null, mode: 'none' };
  }

  const legacySession = await sessionService.getSession(userId, sessionType);
  if (
    legacySession &&
    Number(legacySession.userId) === Number(userId) &&
    sessionService.isJtiAccepted(legacySession, decoded.jti)
  ) {
    logger.debug('Legacy session fallback used', {
      userId,
      sessionType,
      hasSid: !!decoded.sid,
    });
    return { session: legacySession, mode: 'legacy' };
  }

  return { session: null, mode: 'none' };
};

const protect = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(unauthorizedError());
  }

  let tokenState;
  try {
    tokenState = await resolveDecodedToken(token);
  } catch (error) {
    if (
      error instanceof AppError ||
      error instanceof TokenExpiredError ||
      error instanceof JsonWebTokenError ||
      error instanceof NotBeforeError
    ) {
      return next(unauthorizedError());
    }
    return next(error);
  }

  const { decoded } = tokenState;
  if (!decoded || !decoded.id || !decoded.jti) {
    return next(unauthorizedError());
  }

  const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
  const currentUser = result.rows[0];
  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  const sessionType = sessionService.inferSessionType(req.get('user-agent'));
  if (decoded.st && decoded.st !== sessionType) {
    return next(unauthorizedError());
  }

  const { session, mode: sessionLookupMode } = await resolveSessionForToken({
    userId: currentUser.id,
    decoded,
    sessionType,
  });
  if (!session) {
    return next(unauthorizedError());
  }

  if (session.lastIp && req.ip && session.lastIp !== req.ip) {
    logger.warn('Session IP changed', {
      userId: currentUser.id,
      sessionType,
      previousIp: session.lastIp,
      nextIp: req.ip,
    });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = Number(decoded.exp);
  const secondsToExpiry = Number.isFinite(expSec) ? expSec - nowSec : null;
  const shouldRotate =
    tokenState.expired ||
    !Number.isFinite(expSec) ||
    secondsToExpiry <= config.jwt.rotateBeforeExpSeconds;

  logger.debug('Auth token rotation decision', {
    userId: currentUser.id,
    sessionType,
    sessionLookupMode,
    hasSid: !!decoded.sid,
    shouldRotate,
    secondsToExpiry,
    expiredToken: tokenState.expired,
    rotateBeforeExpSeconds: config.jwt.rotateBeforeExpSeconds,
  });

  if (shouldRotate) {
    const newJti = sessionService.generateJti();
    if (sessionLookupMode === 'sid' && decoded.sid) {
      await sessionService.rotateSessionBySid({
        sid: decoded.sid,
        currentSession: session,
        newJti,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.locals.accessToken = signToken(currentUser.id, {
        jti: newJti,
        st: sessionType,
        sid: decoded.sid,
      });
    } else {
      await sessionService.rotateSession({
        userId: currentUser.id,
        sessionType,
        currentSession: session,
        newJti,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.locals.accessToken = signToken(currentUser.id, {
        jti: newJti,
        st: sessionType,
      });
    }
  } else {
    res.locals.accessToken = token;
  }

  req.user = currentUser;
  req.auth = {
    sid: decoded.sid || null,
    sessionType,
    sessionLookupMode,
    isLegacyToken: !decoded.sid,
  };
  if (currentUser.role === 'agent') {
    const company = await companyRepository.findByAgentId(currentUser.id);
    req.user.company = company || null;
  }

  next();
});

module.exports = protect;
