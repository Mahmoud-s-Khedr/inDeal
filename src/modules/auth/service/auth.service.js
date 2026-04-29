const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const AppError = require('../../../core/errors/AppError');
const { pool } = require('../../../infrastructure/config/db');
const { signToken } = require('../../../shared/utils/jwt');
const config = require('../../../infrastructure/config/env');
const redis = require('../../../infrastructure/config/redis');
const { sendEmailSync } = require('../../../infrastructure/email.service');
const logger = require('../../../shared/utils/logger');
const userModule = require('../../user');
const companyModule = require('../../company');
const fileModule = require('../../file');
const sessionService = require('./session.service');
const {
  toRegistrationDocType,
  toExternalDocType,
  sanitizeUser,
} = require('../mappers/auth.mapper');
const fileService = fileModule.service;
const { userRepository } = userModule.repository;
const { companyRepository, companyDocumentRepository } = companyModule.repository;
const { fileRepository } = fileModule.repository;

const getFileUrl = async (fileId) => {
  if (!fileId) return null;
  try {
    const file = await fileService.getFileById(fileId);
    return file.publicUrl;
  } catch {
    return null;
  }
};

const sanitizeCompany = (company) => {
  if (!company) return null;

  return {
    id: company.id,
    agentId: company.agent_id,
    name: company.name,
    description: company.description,
    address: company.address,
    phone: company.phone,
    website: company.website,
    companyType: company.company_type,
    companyIndustry: company.company_industry,
    manufacturingStrategy: company.manufacturing_strategy,
    status: company.status,
    contacts: company.contacts,
    locations: company.locations,
    createdAt: company.created_at,
    updatedAt: company.updated_at,
  };
};

const sanitizeDocument = (doc, fileUrl = null) => {
  if (!doc) return null;

  return {
    id: doc.id,
    companyId: doc.company_id,
    fileId: doc.file_id,
    fileUrl,
    docType: toExternalDocType(doc.doc_type),
    description: doc.description,
    uploadedAt: doc.uploaded_at,
  };
};

const FORGOT_OTP_KEY_PREFIX = 'fp:otp:';
const REGISTRATION_OTP_KEY_PREFIX = 'reg:otp:';
const RATE_LIMIT_PREFIX = 'fp:rate:';
const otpSettings = config.forgotPassword;
const passwordHistorySettings = config.passwordHistory;

const requireForgotPasswordEnabled = () => {
  if (!otpSettings.enabled) {
    throw new AppError('Password reset is temporarily unavailable', 503);
  }
};

const normalizeEmail = (email) => email.trim().toLowerCase();

const buildForgotOtpKey = (email) => `${FORGOT_OTP_KEY_PREFIX}${email}`;
const buildRegistrationOtpKey = (email) => `${REGISTRATION_OTP_KEY_PREFIX}${email}`;
const buildRateKey = (type, scope, value) => `${RATE_LIMIT_PREFIX}${type}:${scope}:${value}`;

const redisFailure = (error) => {
  logger.error('Valkey operation failed', error);
  throw new AppError('Password reset is temporarily unavailable. Please try again later.', 503);
};

const incrementAndCheckLimit = async (key, limit, windowSeconds) => {
  if (!limit || limit <= 0) return;
  let current = 0;
  try {
    current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
  } catch (error) {
    redisFailure(error);
  }

  if (current > limit) {
    throw new AppError('Too many requests. Please try again later.', 429);
  }
};

const applyRateLimits = async (type, email, ipAddress) => {
  const windowSeconds = otpSettings.rateLimits.windowSeconds;
  const limiterPromises = [];

  if (type === 'forgot') {
    limiterPromises.push(
      incrementAndCheckLimit(
        buildRateKey(type, 'email', email),
        otpSettings.rateLimits.forgotPerEmail,
        windowSeconds
      )
    );
    if (ipAddress) {
      limiterPromises.push(
        incrementAndCheckLimit(
          buildRateKey(type, 'ip', ipAddress),
          otpSettings.rateLimits.forgotPerIp,
          windowSeconds
        )
      );
    }
  } else if (type === 'reset') {
    limiterPromises.push(
      incrementAndCheckLimit(
        buildRateKey(type, 'email', email),
        otpSettings.rateLimits.resetPerEmail,
        windowSeconds
      )
    );
    if (ipAddress) {
      limiterPromises.push(
        incrementAndCheckLimit(
          buildRateKey(type, 'ip', ipAddress),
          otpSettings.rateLimits.resetPerIp,
          windowSeconds
        )
      );
    }
  }

  await Promise.all(limiterPromises);
};

const generateOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
const shouldExposeDebugOtp = () => Boolean(config.auth?.debugOtpEnabled);
const buildDebugOtpPayload = (purpose, otp) => {
  if (!shouldExposeDebugOtp() || !otp) return null;
  return {
    purpose,
    otp,
    ttlMinutes: otpSettings.otpTtlMinutes,
    env: config.app.env,
  };
};

const storeOtpPayload = async (key, payload) => {
  const ttlSeconds = otpSettings.otpTtlMinutes * 60;
  try {
    await redis.set(key, JSON.stringify(payload), 'EX', ttlSeconds);
  } catch (error) {
    redisFailure(error);
  }
};

const getOtpPayload = async (key) => {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    redisFailure(error);
  }
};

const deleteOtpPayload = async (key) => {
  try {
    await redis.del(key);
  } catch (error) {
    redisFailure(error);
  }
};

const updateOtpAttempts = async (key, payload, attempts) => {
  try {
    const ttl = await redis.ttl(key);
    const nextPayload = { ...payload, attempts };
    if (ttl > 0) {
      await redis.set(key, JSON.stringify(nextPayload), 'EX', ttl);
    } else {
      await redis.set(key, JSON.stringify(nextPayload));
    }
  } catch (error) {
    redisFailure(error);
  }
};

const sendOtpEmail = async ({ to, otp, ttlMinutes, userAgent, ipAddress }) => {
  try {
    await sendEmailSync({
      to,
      subject: 'Reset your inDeal password',
      template: 'passwordReset',
      variables: {
        otp,
        ttlMinutes,
        userAgent,
        ipAddress,
      },
    });
    logger.info(`Forgot password OTP sent to ${to}`);
  } catch (error) {
    logger.error('Failed to dispatch forgot password email', error);
    if (config.app.env !== 'production') {
      logger.warn('Skipping forgot password email failure in non-production environment');
      return;
    }
    throw new AppError('Unable to send password reset email. Please try again later.', 503);
  }
};

const sendRegistrationVerificationEmail = async ({ to, otp, ttlMinutes }) => {
  const verificationLink = `${config.forgotPassword.frontendUrl.replace(/\/$/, '')}/verify-email?email=${encodeURIComponent(to)}&otp=${encodeURIComponent(otp)}`;
  try {
    await sendEmailSync({
      to,
      subject: 'Verify your inDeal email',
      template: 'verifyEmail',
      variables: {
        verificationLink,
        expiresMinutes: ttlMinutes,
      },
    });
    logger.info(`Registration verification email sent to ${to}`);
  } catch (error) {
    logger.error('Failed to dispatch registration verification email', error);
    if (config.app.env !== 'production') {
      logger.warn('Skipping registration verification email failure in non-production environment');
      return;
    }
    throw new AppError('Unable to send verification email. Please try again later.', 503);
  }
};

const issueAccessToken = async ({ userId, ipAddress, userAgent }) => {
  const sessionType = sessionService.inferSessionType(userAgent);
  const jti = sessionService.generateJti();
  await sessionService.createOrReplaceSession({
    userId,
    sessionType,
    jti,
    ipAddress,
    userAgent,
  });
  return signToken(userId, { jti, st: sessionType });
};

const checkPasswordAgainstHistory = async (userId, newPassword, currentPasswordHash = null) => {
  const depth = passwordHistorySettings?.depth ?? 5;
  if (depth <= 0) return; // Password history check disabled

  const recentHashes = await userRepository.listRecentPasswordHistoryHashes(userId, depth);
  const blockedHashes = currentPasswordHash ? [currentPasswordHash, ...recentHashes] : recentHashes;

  for (const hash of blockedHashes.filter(Boolean)) {
    const matches = await bcrypt.compare(newPassword, hash);
    if (matches) {
      throw new AppError(`Cannot reuse your last ${depth} passwords`, 400);
    }
  }
};

const createRegistrationUploadUrl = async ({ fileName, fileType, fileSize }) => {
  return fileService.createUploadUrl({
    fileName,
    fileType,
    fileSize,
    uploaderId: null,
  });
};

const register = async (payload, { ipAddress: _ipAddress, userAgent: _userAgent } = {}) => {
  const email = payload.user.email.toLowerCase();
  const username = payload.user.username.trim();
  const documentsPayload = payload.company.documents || [];

  const existingByEmail = await userRepository.findByEmail(email);
  if (existingByEmail) {
    throw new AppError('Email already registered', 400);
  }

  const existingByUsername = await userRepository.findByUsername(username);
  if (existingByUsername) {
    throw new AppError('Username already taken', 400);
  }

  if (documentsPayload.length) {
    const documentFileIds = documentsPayload.map((doc) => doc.fileId);
    const existingFiles = await fileRepository.findByIds(documentFileIds);
    if (existingFiles.length !== documentFileIds.length) {
      throw new AppError('One or more company document files are invalid', 400);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash(payload.user.password, 12);

    const newUser = await userRepository.createUser(client, {
      username,
      email,
      passwordHash,
      firstName: payload.user.firstName,
      lastName: payload.user.lastName,
      jobTitle: payload.user.jobTitle,
    });
    await userRepository.updateStatus(newUser.id, 'pending', client);
    newUser.status = 'pending';

    const newCompany = await companyRepository.createCompany(client, {
      agentId: newUser.id,
      name: payload.company.name,
      description: payload.company.description,
      address: payload.company.address,
      phone: payload.company.phone,
      website: payload.company.website,
      companyType: payload.company.companyType,
      companyIndustry: payload.company.companyIndustry,
      manufacturingStrategy: payload.company.manufacturingStrategy,
      contacts: payload.company.contacts,
      locations: payload.company.locations,
    });

    let createdDocuments = [];
    if (documentsPayload.length) {
      createdDocuments = await companyDocumentRepository.bulkCreateDocuments(
        client,
        documentsPayload.map((doc) => ({
          companyId: newCompany.id,
          fileId: doc.fileId,
          docType: toRegistrationDocType(doc.docType),
          description: doc.description,
          expiryDate: doc.expiryDate,
        }))
      );
    }

    // Store initial password in history
    await userRepository.insertPasswordHistory(newUser.id, passwordHash, client);

    await client.query('COMMIT');

    const registrationOtp = generateOtp();
    await storeOtpPayload(buildRegistrationOtpKey(email), {
      userId: newUser.id,
      otp: registrationOtp,
      attempts: 0,
      issuedAt: new Date().toISOString(),
    });

    await sendRegistrationVerificationEmail({
      to: email,
      otp: registrationOtp,
      ttlMinutes: otpSettings.otpTtlMinutes,
    });
    const companyPayload = sanitizeCompany(newCompany);
    if (createdDocuments.length) {
      companyPayload.documents = await Promise.all(
        createdDocuments.map(async (doc) => {
          const fileUrl = await getFileUrl(doc.file_id);
          return sanitizeDocument(doc, fileUrl);
        })
      );
    }

    const registrationDebugOtp = buildDebugOtpPayload('registration', generateOtp());

    const result = {
      message: 'Registration submitted. Please verify your email before login.',
      user: sanitizeUser(newUser),
      company: companyPayload,
    };
    if (registrationDebugOtp && shouldExposeDebugOtp()) {
      registrationDebugOtp.otp = registrationOtp;
      result.debugOtp = registrationDebugOtp;
    }

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const resubmit = async (userId, payload) => {
  const company = await companyRepository.findByAgentId(userId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  if (company.status !== 'rejected') {
    throw new AppError('Only rejected companies can resubmit', 400);
  }

  const documentsPayload = payload.documents || [];
  if (documentsPayload.length) {
    const documentFileIds = documentsPayload.map((doc) => doc.fileId);
    const existingFiles = await fileRepository.findByIds(documentFileIds);
    if (existingFiles.length !== documentFileIds.length) {
      throw new AppError('One or more company document files are invalid', 400);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update company details if provided
    let updatedCompany = company;
    if (payload.company) {
      updatedCompany = await companyRepository.updateCompanyById(company.id, payload.company);
    }

    // Set status to pending
    updatedCompany = await companyRepository.updateCompanyStatus(company.id, 'underReview');

    // Add new documents
    let createdDocuments = [];
    if (documentsPayload.length) {
      createdDocuments = await companyDocumentRepository.bulkCreateDocuments(
        client,
        documentsPayload.map((doc) => ({
          companyId: company.id,
          fileId: doc.fileId,
          docType: toRegistrationDocType(doc.docType),
          description: doc.description,
          expiryDate: doc.expiryDate,
        }))
      );
    }

    await client.query('COMMIT');

    const companyPayload = sanitizeCompany(updatedCompany);
    if (createdDocuments.length) {
      companyPayload.documents = await Promise.all(
        createdDocuments.map(async (doc) => {
          const fileUrl = await getFileUrl(doc.file_id);
          return sanitizeDocument(doc, fileUrl);
        })
      );
    }

    return {
      company: companyPayload,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const login = async (payload, { ipAddress, userAgent } = {}) => {
  const email = payload.email.toLowerCase();
  const user = await userRepository.findByEmail(email);

  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  const isPasswordValid = await bcrypt.compare(payload.password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401);
  }

  if (user.status !== 'verified') {
    throw new AppError('Email verification required before login', 403);
  }

  const company = await companyRepository.findByAgentId(user.id);
  const token = await issueAccessToken({
    userId: user.id,
    ipAddress,
    userAgent,
  });

  return {
    token,
    user: sanitizeUser(user),
    company: sanitizeCompany(company),
  };
};

const forgotPassword = async ({ email, ipAddress, userAgent }) => {
  requireForgotPasswordEnabled();
  const normalizedEmail = normalizeEmail(email);

  await applyRateLimits('forgot', normalizedEmail, ipAddress);

  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    return { message: 'If the email exists, instructions were sent.' };
  }

  const otp = generateOtp();
  await storeOtpPayload(buildForgotOtpKey(normalizedEmail), {
    userId: user.id,
    otp,
    attempts: 0,
    issuedAt: new Date().toISOString(),
  });

  await sendOtpEmail({
    to: normalizedEmail,
    otp,
    ttlMinutes: otpSettings.otpTtlMinutes,
    userAgent,
    ipAddress,
  });

  const result = { message: 'If the email exists, instructions were sent.' };
  const debugOtp = buildDebugOtpPayload('forgot-password', otp);
  if (debugOtp) {
    result.debugOtp = debugOtp;
  }
  return result;
};

const resendForgotPasswordOtp = async ({ email, ipAddress, userAgent }) => {
  const result = await forgotPassword({ email, ipAddress, userAgent });
  return result || { message: 'If the email exists, instructions were sent.' };
};

const resetPassword = async ({ email, otp, password, ipAddress }) => {
  requireForgotPasswordEnabled();
  const normalizedEmail = normalizeEmail(email);

  await applyRateLimits('reset', normalizedEmail, ipAddress);

  const otpKey = buildForgotOtpKey(normalizedEmail);
  const storedPayload = await getOtpPayload(otpKey);
  if (!storedPayload) {
    throw new AppError('Invalid or expired code', 400);
  }

  if (storedPayload.otp !== otp) {
    const nextAttempts = (storedPayload.attempts || 0) + 1;
    await updateOtpAttempts(otpKey, storedPayload, nextAttempts);
    throw new AppError('Invalid or expired code', 400);
  }

  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user || user.id !== storedPayload.userId) {
    throw new AppError('Invalid or expired code', 400);
  }

  // Check new password against history before updating
  await checkPasswordAgainstHistory(user.id, password, user.password_hash);

  const passwordHash = await bcrypt.hash(password, 12);
  const pruneKeep = passwordHistorySettings?.pruneKeep ?? 10;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await userRepository.insertPasswordHistory(user.id, user.password_hash, client);
    await userRepository.updatePasswordHash(user.id, passwordHash, client);
    await userRepository.prunePasswordHistory(user.id, pruneKeep, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await deleteOtpPayload(otpKey);
};

const verifyOtp = async ({ email, otp, ipAddress }) => {
  requireForgotPasswordEnabled();
  const normalizedEmail = normalizeEmail(email);

  await applyRateLimits('reset', normalizedEmail, ipAddress);

  const otpKey = buildForgotOtpKey(normalizedEmail);
  const storedPayload = await getOtpPayload(otpKey);
  if (!storedPayload) {
    throw new AppError('Invalid or expired code', 400);
  }

  if (storedPayload.otp !== otp) {
    const nextAttempts = (storedPayload.attempts || 0) + 1;
    await updateOtpAttempts(otpKey, storedPayload, nextAttempts);
    throw new AppError('Invalid or expired code', 400);
  }

  return { message: 'OTP verified successfully' };
};

const resendVerification = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    return { message: 'If the email exists, verification instructions were sent.' };
  }
  if (user.status === 'verified') {
    return { message: 'Email is already verified.' };
  }

  const otp = generateOtp();
  await storeOtpPayload(buildRegistrationOtpKey(normalizedEmail), {
    userId: user.id,
    otp,
    attempts: 0,
    issuedAt: new Date().toISOString(),
  });

  await sendRegistrationVerificationEmail({
    to: normalizedEmail,
    otp,
    ttlMinutes: otpSettings.otpTtlMinutes,
  });

  const result = { message: 'If the email exists, verification instructions were sent.' };
  const debugOtp = buildDebugOtpPayload('registration', otp);
  if (debugOtp) {
    result.debugOtp = debugOtp;
  }
  return result;
};

const verifyEmail = async ({ email, otp }) => {
  const normalizedEmail = normalizeEmail(email);
  const otpKey = buildRegistrationOtpKey(normalizedEmail);
  const storedPayload = await getOtpPayload(otpKey);
  if (!storedPayload) {
    throw new AppError('Invalid or expired verification code', 400);
  }

  if (storedPayload.otp !== otp) {
    const nextAttempts = (storedPayload.attempts || 0) + 1;
    await updateOtpAttempts(otpKey, storedPayload, nextAttempts);
    throw new AppError('Invalid or expired verification code', 400);
  }

  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user || user.id !== storedPayload.userId) {
    throw new AppError('Invalid or expired verification code', 400);
  }

  if (user.status !== 'verified') {
    await userRepository.updateStatus(user.id, 'verified');
  }
  await deleteOtpPayload(otpKey);
  return { message: 'Email verified successfully' };
};

const logoutCurrentSession = async ({ userId, sessionType }) => {
  await sessionService.deleteSession(userId, sessionType);
  return { message: 'Logged out current session successfully' };
};

const logoutAllSessions = async (userId) => {
  await sessionService.deleteAllSessionsForUser(userId);
  return { message: 'Logged out from all sessions successfully' };
};

module.exports = {
  createRegistrationUploadUrl,
  register,
  resubmit,
  login,
  forgotPassword,
  resendForgotPasswordOtp,
  verifyOtp,
  resendVerification,
  verifyEmail,
  resetPassword,
  logoutCurrentSession,
  logoutAllSessions,
  __testables: {
    toRegistrationDocType,
    toExternalDocType,
    sanitizeUser,
    buildDebugOtpPayload,
  },
};
