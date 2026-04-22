const { TokenExpiredError, JsonWebTokenError, NotBeforeError } = require('jsonwebtoken');
const { verifyToken, signToken } = require('../../shared/utils/jwt');
const AppError = require('../errors/AppError');
const catchAsync = require('../http/catchAsync');
const config = require('../../infrastructure/config/env');
const logger = require('../../shared/utils/logger');
const companyModule = require('../../modules/company');
const userModule = require('../../modules/user');
const authModule = require('../../modules/auth');
const { companyRepository } = companyModule.repository;
const { userRepository } = userModule.repository;
const sessionService = authModule.sessionService;

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

  const currentUser = await userRepository.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  const sessionType = sessionService.inferSessionType(req.get('user-agent'));
  if (decoded.st && decoded.st !== sessionType) {
    return next(unauthorizedError());
  }

  const session = await sessionService.getSession(currentUser.id, sessionType);
  if (!session || !sessionService.isJtiAccepted(session, decoded.jti)) {
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
    shouldRotate,
    secondsToExpiry,
    expiredToken: tokenState.expired,
    rotateBeforeExpSeconds: config.jwt.rotateBeforeExpSeconds,
  });

  if (shouldRotate) {
    const newJti = sessionService.generateJti();

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
  } else {
    res.locals.accessToken = token;
  }

  req.user = currentUser;
  req.auth = {
    sid: null,
    sessionType,
    sessionLookupMode: 'single',
    isLegacyToken: true,
  };

  if (currentUser.role === 'agent') {
    const company = await companyRepository.findByAgentId(currentUser.id);
    req.user.company = company || null;
  }

  next();
});

protect.__requiresAuth = true;

module.exports = protect;
