/**
 * Pending Update Service
 * Handles profile update review workflow (FR-ADMIN-003)
 */

const AppError = require('../utils/AppError');
const pendingUpdateRepository = require('../repositories/pendingUpdate.repository');
const companyRepository = require('../repositories/company.repository');
const userRepository = require('../repositories/user.repository');
const notificationService = require('./notification.service');
const fileService = require('./file.service');
const { sendMail } = require('../config/mailer');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');
const logger = require('../utils/logger');

/**
 * Sanitize pending update for API response
 */
/**
 * Helper to fetch file URL
 */
const getFileUrl = async (fileId) => {
  if (!fileId) return null;
  try {
    const file = await fileService.getFileById(fileId);
    return file.publicUrl;
  } catch (err) {
    return null;
  }
};

/**
 * Sanitize pending update for API response
 */
const sanitizePendingUpdate = async (update) => {
  const pendingData = update.pending_data || {};

  // Resolve logo URL if present
  let logoUrl = null;
  if (pendingData.logoFileId) {
    logoUrl = await getFileUrl(pendingData.logoFileId);
  } else if (pendingData.logo) {
    // Legacy support if stored as 'logo'
    logoUrl = await getFileUrl(pendingData.logo);
  }

  // Inject URLs into pendingData
  const enrichedPendingData = {
    ...pendingData,
    logoUrl,
  };

  return {
    id: update.id,
    companyId: update.company_id,
    companyName: update.company_name,
    pendingData: enrichedPendingData,
    status: update.status,
    submittedAt: update.submitted_at,
    reviewedBy: update.reviewed_by,
    reviewedAt: update.reviewed_at,
    rejectionReason: update.rejection_reason,
    agentEmail: update.agent_email,
  };
};

const normalizePendingData = (pendingData = {}) => ({
  name: pendingData.name,
  description: pendingData.description,
  address: pendingData.address,
  phone: pendingData.phone,
  email: pendingData.email,
  website: pendingData.website,
  company_type: pendingData.companyType,
  company_industry: pendingData.companyIndustry,
  manufacturing_strategy: pendingData.manufacturingStrategy,
  contacts: pendingData.contacts,
  locations: pendingData.locations,
  social_media_links: pendingData.socialMediaLinks,
});

/**
 * Submit profile update for review
 */
const submitForReview = async (companyId, pendingData) => {
  // Check if there's already a pending update
  const existing = await pendingUpdateRepository.findByCompanyId(companyId, 'pending');
  if (existing) {
    throw new AppError('You already have a pending update awaiting review', 409);
  }

  const update = await pendingUpdateRepository.create(companyId, pendingData);
  logger.info({ companyId, updateId: update.id }, 'Profile update submitted for review');
  return await sanitizePendingUpdate(update);
};

/**
 * Get pending update for a company
 */
const getPendingUpdate = async (companyId) => {
  const update = await pendingUpdateRepository.findByCompanyId(companyId, 'pending');
  return update ? await sanitizePendingUpdate(update) : null;
};

/**
 * List all pending updates (admin)
 */
const listPendingUpdates = async (query = {}) => {
  const limit = parseInt(query.limit, 10) || 50;
  const offset = parseInt(query.offset, 10) || 0;

  const [updates, count] = await Promise.all([
    pendingUpdateRepository.listPending(limit, offset),
    pendingUpdateRepository.countPending(),
  ]);

  return {
    items: await Promise.all(updates.map(sanitizePendingUpdate)),
    total: count,
    limit,
    offset,
  };
};

/**
 * Get pending update by ID (admin)
 */
const getPendingUpdateById = async (updateId) => {
  const update = await pendingUpdateRepository.findById(updateId);
  if (!update) {
    throw new AppError('Pending update not found', 404);
  }
  return await sanitizePendingUpdate(update);
};

/**
 * Approve a pending update (admin)
 */
const approveUpdate = async (updateId, adminId) => {
  const update = await pendingUpdateRepository.findById(updateId);
  if (!update) {
    throw new AppError('Pending update not found', 404);
  }
  if (update.status !== 'pending') {
    throw new AppError('This update has already been reviewed', 400);
  }

  // Apply the changes to the company
  const dbUpdates = normalizePendingData(update.pending_data);
  await companyRepository.updateCompanyById(update.company_id, dbUpdates);

  // Mark as approved
  const approved = await pendingUpdateRepository.approve(updateId, adminId);

  // Notify the company agent
  await notificationService.createNotification({
    userId: update.agent_id,
    type: NOTIFICATION_TYPES.PROFILE_UPDATE_APPROVED,
    title: 'Profile Update Approved',
    message: 'Your profile changes have been approved and are now live.',
    metadata: { updateId },
  });

  logger.info({ updateId, adminId, companyId: update.company_id }, 'Profile update approved');
  return await sanitizePendingUpdate(approved);
};

/**
 * Reject a pending update (admin)
 */
const rejectUpdate = async (updateId, adminId, reason) => {
  const update = await pendingUpdateRepository.findById(updateId);
  if (!update) {
    throw new AppError('Pending update not found', 404);
  }
  if (update.status !== 'pending') {
    throw new AppError('This update has already been reviewed', 400);
  }

  const rejected = await pendingUpdateRepository.reject(updateId, adminId, reason);

  // Notify the company agent
  await notificationService.createNotification({
    userId: update.agent_id,
    type: NOTIFICATION_TYPES.PROFILE_UPDATE_REJECTED,
    title: 'Profile Update Rejected',
    message: reason || 'Your profile changes have been rejected. Please review and resubmit.',
    metadata: { updateId, reason },
  });

  // Send rejection email to agent
  try {
    const agent = await userRepository.findById(update.agent_id);
    if (agent?.email) {
      const text = [
        'Your profile update request has been rejected.',
        `Company: ${update.company_name}`,
        reason ? `Reason: ${reason}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333;">Profile Update Rejected</h2>
          <p>Your profile update request for <strong>${update.company_name}</strong> has been rejected.</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          <p>Please review the feedback and resubmit your changes.</p>
        </div>
      `;

      await sendMail({
        to: agent.email,
        subject: 'Your profile update has been rejected',
        text,
        html,
      });
    }
  } catch (error) {
    logger.error('Failed to send profile update rejection email', { error, updateId });
  }

  logger.info(
    { updateId, adminId, companyId: update.company_id, reason },
    'Profile update rejected'
  );
  return await sanitizePendingUpdate(rejected);
};

module.exports = {
  submitForReview,
  getPendingUpdate,
  listPendingUpdates,
  getPendingUpdateById,
  approveUpdate,
  rejectUpdate,
};
