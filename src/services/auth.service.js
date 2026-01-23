const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const { pool } = require('../config/db');
const { signToken } = require('../utils/jwt');
const config = require('../config/env');
const redis = require('../config/redis');
const { sendEmailSync } = require('./email.service');
const logger = require('../utils/logger');
const userRepository = require('../repositories/user.repository');
const companyRepository = require('../repositories/company.repository');
const companyDocumentRepository = require('../repositories/companyDocument.repository');
const fileRepository = require('../repositories/file.repository');

const fileService = require('./file.service');

const sanitizeUser = (user) => {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    jobTitle: user.job_title,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
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

const sanitizeDocument = (doc) => {
  if (!doc) return null;

  return {
    id: doc.id,
    companyId: doc.company_id,
    fileId: doc.file_id,
    docType: doc.doc_type,
    description: doc.description,
    uploadedAt: doc.uploaded_at,
  };
};

const OTP_KEY_PREFIX = 'fp:otp:';
const RATE_LIMIT_PREFIX = 'fp:rate:';
const otpSettings = config.forgotPassword;
const emailVerificationSettings = config.emailVerification;
const passwordHistorySettings = config.passwordHistory;
const EMAIL_VERIFICATION_KEY_PREFIX = 'email:verification:';

const requireForgotPasswordEnabled = () => {
  if (!otpSettings.enabled) {
    throw new AppError('Password reset is temporarily unavailable', 503);
  }
};

const normalizeEmail = (email) => email.trim().toLowerCase();

const buildOtpKey = (email) => `${OTP_KEY_PREFIX}${email}`;
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

const storeOtpPayload = async (email, payload) => {
  const ttlSeconds = otpSettings.otpTtlMinutes * 60;
  try {
    await redis.set(buildOtpKey(email), JSON.stringify(payload), 'EX', ttlSeconds);
  } catch (error) {
    redisFailure(error);
  }
};

const getOtpPayload = async (email) => {
  try {
    const raw = await redis.get(buildOtpKey(email));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    redisFailure(error);
  }
};

const deleteOtpPayload = async (email) => {
  try {
    await redis.del(buildOtpKey(email));
  } catch (error) {
    redisFailure(error);
  }
};

const buildEmailVerificationKey = (email) => `${EMAIL_VERIFICATION_KEY_PREFIX}${email}`;

const storeEmailVerificationPayload = async (email, payload) => {
  const ttlSeconds = emailVerificationSettings.tokenTtlMinutes * 60;
  try {
    await redis.set(buildEmailVerificationKey(email), JSON.stringify(payload), 'EX', ttlSeconds);
  } catch (error) {
    redisFailure(error);
  }
};

const getEmailVerificationPayload = async (email) => {
  try {
    const raw = await redis.get(buildEmailVerificationKey(email));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    redisFailure(error);
  }
};

const deleteEmailVerificationPayload = async (email) => {
  try {
    await redis.del(buildEmailVerificationKey(email));
  } catch (error) {
    redisFailure(error);
  }
};

const updateOtpAttempts = async (email, payload, attempts) => {
  try {
    const ttl = await redis.ttl(buildOtpKey(email));
    const nextPayload = { ...payload, attempts };
    if (ttl > 0) {
      await redis.set(buildOtpKey(email), JSON.stringify(nextPayload), 'EX', ttl);
    } else {
      await redis.set(buildOtpKey(email), JSON.stringify(nextPayload));
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

const createEmailVerificationToken = async (email, userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  await storeEmailVerificationPayload(email, {
    userId,
    token,
    issuedAt: new Date().toISOString(),
  });
  return token;
};

const buildEmailVerificationLink = (email, token) => {
  const baseUrl = (
    emailVerificationSettings.baseUrl || `http://localhost:${config.app.port || 3000}`
  ).replace(/\/$/, '');
  const rawRoute = emailVerificationSettings.route || '/api/v1/auth/verify-email';
  const sanitizedRoute = rawRoute.startsWith('/')
    ? rawRoute.replace(/\/+$/, '')
    : `/${rawRoute.replace(/\/+$/, '')}`;
  const route = `${baseUrl}${sanitizedRoute}`;
  const params = new URLSearchParams({ token, email });
  return `${route}?${params.toString()}`;
};

const sendVerificationEmail = async (user) => {
  const normalizedEmail = normalizeEmail(user.email);
  const token = await createEmailVerificationToken(normalizedEmail, user.id);
  const verificationLink = buildEmailVerificationLink(normalizedEmail, token);
  const expiresMinutes = emailVerificationSettings.tokenTtlMinutes;

  try {
    await sendEmailSync({
      to: normalizedEmail,
      subject: 'Verify your inDeal email',
      template: 'verifyEmail',
      variables: {
        verificationLink,
        expiresMinutes,
      },
    });
    logger.info(`Email verification link sent to ${normalizedEmail}`);
  } catch (error) {
    logger.error('Failed to dispatch verification email', error);
    throw new AppError('Unable to send verification email. Please try again later.', 503);
  }
};

const dispatchVerificationEmail = (user) => {
  process.nextTick(() => {
    sendVerificationEmail(user).catch((error) => {
      logger.error('Failed to dispatch verification email (async)', error);
    });
  });
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

const register = async (payload) => {
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
          docType: doc.docType,
          description: doc.description,
        }))
      );
    }

    // Store initial password in history
    await userRepository.insertPasswordHistory(newUser.id, passwordHash, client);

    await client.query('COMMIT');

    const token = signToken(newUser.id);
    const companyPayload = sanitizeCompany(newCompany);
    if (createdDocuments.length) {
      companyPayload.documents = createdDocuments.map(sanitizeDocument);
    }

    dispatchVerificationEmail(newUser);

    return {
      token,
      user: sanitizeUser(newUser),
      company: companyPayload,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    await deleteEmailVerificationPayload(email);
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
      updatedCompany = await companyRepository.updateCompanyById(
        company.id,
        payload.company
      );
    }

    // Set status to pending
    updatedCompany = await companyRepository.updateCompanyStatus(
      company.id,
      'pending'
    );

    // Add new documents
    let createdDocuments = [];
    if (documentsPayload.length) {
      createdDocuments = await companyDocumentRepository.bulkCreateDocuments(
        client,
        documentsPayload.map((doc) => ({
          companyId: company.id,
          fileId: doc.fileId,
          docType: doc.docType,
          description: doc.description,
        }))
      );
    }

    await client.query('COMMIT');

    const companyPayload = sanitizeCompany(updatedCompany);
    if (createdDocuments.length) {
      // We might want to return all documents or just the new ones.
      // For now, let's fetch all documents to return a complete state or just return what we have.
      // The register response returns proper structure. Let's return the complete object.
      // But fetching all docs might be extra. Let's return the new ones merged or just the company object with new docs.
      // Typically the UI will reload the profile.
      // Let's stick to returning the updated company object.
      // But to be consistent with register, we can attach documents.
      // However, we didn't fetch old documents here.
      // Let's just return the new documents in the response or let the repository handle listing if needed.
      // For simplicity and performance, let's return the updated company and the NEW documents.
      // The user can refetch if they want full list.
      companyPayload.documents = createdDocuments.map(sanitizeDocument);
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

const login = async (payload) => {
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
    throw new AppError('Please verify your email before logging in', 403);
  }

  const company = await companyRepository.findByAgentId(user.id);
  const token = signToken(user.id);

  return {
    token,
    user: sanitizeUser(user),
    company: sanitizeCompany(company),
  };
};

const adminLogin = async (payload) => {
  const email = payload.email.toLowerCase();
  const user = await userRepository.findByEmail(email);

  if (!user || user.role !== 'admin') {
    throw new AppError('Invalid credentials', 401);
  }

  const isPasswordValid = await bcrypt.compare(payload.password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401);
  }

  if (user.status !== 'verified') {
    throw new AppError('Please verify your email before logging in', 403);
  }

  const token = signToken(user.id);

  return {
    token,
    user: sanitizeUser(user),
  };
};

const forgotPassword = async ({ email, ipAddress, userAgent }) => {
  requireForgotPasswordEnabled();
  const normalizedEmail = normalizeEmail(email);

  await applyRateLimits('forgot', normalizedEmail, ipAddress);

  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    return;
  }

  const otp = generateOtp();
  await storeOtpPayload(normalizedEmail, {
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
};

const resendForgotPasswordOtp = async ({ email, ipAddress, userAgent }) => {
  await forgotPassword({ email, ipAddress, userAgent });
  return { message: 'If the email exists, instructions were sent.' };
};

const resetPassword = async ({ email, otp, password, ipAddress }) => {
  requireForgotPasswordEnabled();
  const normalizedEmail = normalizeEmail(email);

  await applyRateLimits('reset', normalizedEmail, ipAddress);

  const storedPayload = await getOtpPayload(normalizedEmail);
  if (!storedPayload) {
    throw new AppError('Invalid or expired code', 400);
  }

  if (storedPayload.otp !== otp) {
    const nextAttempts = (storedPayload.attempts || 0) + 1;
    await updateOtpAttempts(normalizedEmail, storedPayload, nextAttempts);
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

  await deleteOtpPayload(normalizedEmail);
};

const verifyOtp = async ({ email, otp, ipAddress }) => {
  requireForgotPasswordEnabled();
  const normalizedEmail = normalizeEmail(email);

  await applyRateLimits('reset', normalizedEmail, ipAddress);

  const storedPayload = await getOtpPayload(normalizedEmail);
  if (!storedPayload) {
    throw new AppError('Invalid or expired code', 400);
  }

  if (storedPayload.otp !== otp) {
    const nextAttempts = (storedPayload.attempts || 0) + 1;
    await updateOtpAttempts(normalizedEmail, storedPayload, nextAttempts);
    throw new AppError('Invalid or expired code', 400);
  }

  return { message: 'OTP verified successfully' };
};

const verifyEmail = async ({ email, token }) => {
  if (!emailVerificationSettings.baseUrl) {
    throw new AppError('Email verification is not configured', 503);
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    throw new AppError('Invalid or expired verification link', 400);
  }

  if (user.status === 'verified') {
    await deleteEmailVerificationPayload(normalizedEmail);
    return { message: 'Email already verified' };
  }

  const storedPayload = await getEmailVerificationPayload(normalizedEmail);
  if (!storedPayload || storedPayload.token !== token || storedPayload.userId !== user.id) {
    throw new AppError('Invalid or expired verification link', 400);
  }

  await userRepository.updateStatus(user.id, 'verified');
  await deleteEmailVerificationPayload(normalizedEmail);

  return { message: 'Email verified successfully' };
};

const resendVerificationEmail = async ({ email }) => {
  if (!emailVerificationSettings.baseUrl) {
    throw new AppError('Email verification is not configured', 503);
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    return { message: 'If the email exists, a verification link was sent.' };
  }

  if (user.status === 'verified') {
    return { message: 'Email already verified' };
  }

  dispatchVerificationEmail(user);
  return { message: 'Verification email sent' };
};

module.exports = {
  createRegistrationUploadUrl,
  register,
  resubmit,
  login,
  adminLogin,
  forgotPassword,
  resendForgotPasswordOtp,
  verifyOtp,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
};
