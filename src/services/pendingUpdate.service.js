/**
 * Pending Update Service
 * Handles profile update review workflow (FR-ADMIN-003)
 */

const AppError = require('../utils/AppError');
const pendingUpdateRepository = require('../repositories/pendingUpdate.repository');
const companyRepository = require('../repositories/company.repository');
const notificationService = require('./notification.service');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');
const logger = require('../utils/logger');

/**
 * Sanitize pending update for API response
 */
const sanitizePendingUpdate = (update) => ({
    id: update.id,
    companyId: update.company_id,
    companyName: update.company_name,
    pendingData: update.pending_data,
    status: update.status,
    submittedAt: update.submitted_at,
    reviewedBy: update.reviewed_by,
    reviewedAt: update.reviewed_at,
    rejectionReason: update.rejection_reason,
    agentEmail: update.agent_email,
});

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
    return sanitizePendingUpdate(update);
};

/**
 * Get pending update for a company
 */
const getPendingUpdate = async (companyId) => {
    const update = await pendingUpdateRepository.findByCompanyId(companyId, 'pending');
    return update ? sanitizePendingUpdate(update) : null;
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
        items: updates.map(sanitizePendingUpdate),
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
    return sanitizePendingUpdate(update);
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
    return sanitizePendingUpdate(approved);
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

    logger.info({ updateId, adminId, companyId: update.company_id, reason }, 'Profile update rejected');
    return sanitizePendingUpdate(rejected);
};

module.exports = {
    submitForReview,
    getPendingUpdate,
    listPendingUpdates,
    getPendingUpdateById,
    approveUpdate,
    rejectUpdate,
};
