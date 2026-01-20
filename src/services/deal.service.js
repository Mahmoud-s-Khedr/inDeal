const AppError = require('../utils/AppError');
const dealRepository = require('../repositories/deal.repository');
const dealRequestRepository = require('../repositories/dealRequest.repository');
const companyRepository = require('../repositories/company.repository');
const { sendMail } = require('../config/mailer');
const logger = require('../utils/logger');
const notificationService = require('./notification.service');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

const sanitizeDeal = (deal) => {
  if (!deal) return null;
  return {
    id: deal.id,
    companyId: deal.company_id,
    dealName: deal.deal_name,
    dealDescription: deal.deal_description,
    dealValue: deal.deal_value ? parseFloat(deal.deal_value) : null,
    dealType: deal.deal_type,
    status: deal.status,
    createdAt: deal.created_at,
    updatedAt: deal.updated_at,
    // Joined company fields
    companyName: deal.company_name,
    companyLogo: deal.company_logo,
    companyType: deal.company_type,
    companyIndustry: deal.company_industry,
    companyAddress: deal.company_address,
    companyStatus: deal.company_status,
  };
};

const sanitizeRequest = (request) => {
  if (!request) return null;
  return {
    id: request.id,
    dealId: request.deal_id,
    applicantCompanyId: request.applicant_company_id,
    requestDetails: request.request_details,
    requestOffer: request.request_offer ? parseFloat(request.request_offer) : null,
    status: request.status,
    createdAt: request.created_at,
    updatedAt: request.updated_at,
    // Joined fields
    dealName: request.deal_name,
    dealOwnerCompanyId: request.deal_owner_company_id,
    applicantCompanyName: request.applicant_company_name,
    applicantCompanyLogo: request.applicant_company_logo,
    applicantCompanyType: request.applicant_company_type,
    applicantIndustry: request.applicant_industry,
    // From my requests query
    dealType: request.deal_type,
    dealValue: request.deal_value ? parseFloat(request.deal_value) : null,
    dealStatus: request.deal_status,
    ownerCompanyName: request.owner_company_name,
  };
};

// ─────────────────────────────────────────────────────────────
// DEAL OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Create a new deal
 */
const createDeal = async (companyId, payload) => {
  // Verify company is active
  const company = await companyRepository.findById(companyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }
  if (company.status !== 'active') {
    throw new AppError('Company must be active to create deals', 403);
  }

  const deal = await dealRepository.createDeal(null, {
    companyId,
    dealName: payload.dealName,
    dealDescription: payload.dealDescription,
    dealValue: payload.dealValue,
    dealType: payload.dealType,
    status: 'open',
  });

  logger.info('Deal created', { dealId: deal.id, companyId, dealType: payload.dealType });
  return sanitizeDeal(deal);
};

/**
 * Get deal by ID (public view)
 */
const getDealById = async (dealId) => {
  const deal = await dealRepository.findById(dealId);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }
  return sanitizeDeal(deal);
};

/**
 * Search deals with filters
 */
const searchDeals = async (filters, excludeCompanyId = null) => {
  const { keyword, dealType, status, industry, minValue, maxValue, limit, offset } = filters;

  const [deals, total] = await Promise.all([
    dealRepository.search({
      keyword,
      dealType,
      status: status || 'open', // Default to open deals
      companyIndustry: industry,
      minValue,
      maxValue,
      excludeCompanyId,
      limit,
      offset,
    }),
    dealRepository.countSearch({
      keyword,
      dealType,
      status: status || 'open',
      companyIndustry: industry,
      minValue,
      maxValue,
      excludeCompanyId,
    }),
  ]);

  return {
    deals: deals.map(sanitizeDeal),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + deals.length < total,
    },
  };
};

/**
 * Get my deals (as publisher)
 */
const getMyDeals = async (companyId, filters = {}) => {
  const deals = await dealRepository.findByCompanyId(companyId, filters);
  return deals.map(sanitizeDeal);
};

/**
 * Update own deal
 */
const updateDeal = async (dealId, companyId, updates) => {
  const deal = await dealRepository.findById(dealId);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }
  if (deal.company_id !== companyId) {
    throw new AppError('Unauthorized to update this deal', 403);
  }

  const updated = await dealRepository.updateById(dealId, updates);
  logger.info('Deal updated', { dealId, companyId, updates: Object.keys(updates) });
  return sanitizeDeal(updated);
};

/**
 * Archive/delete own deal
 */
const archiveDeal = async (dealId, companyId) => {
  const deal = await dealRepository.findById(dealId);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }
  if (deal.company_id !== companyId) {
    throw new AppError('Unauthorized to archive this deal', 403);
  }

  const archived = await dealRepository.archiveDeal(dealId);
  logger.info('Deal archived', { dealId, companyId });
  return sanitizeDeal(archived);
};

// ─────────────────────────────────────────────────────────────
// DEAL REQUEST OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Submit a request/bid for a deal
 */
const createDealRequest = async (dealId, applicantCompanyId, payload) => {
  // Verify deal exists and is open
  const deal = await dealRepository.findById(dealId);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }
  if (deal.status !== 'open') {
    throw new AppError('Deal is not open for requests', 400);
  }

  // Cannot bid on own deal
  if (deal.company_id === applicantCompanyId) {
    throw new AppError('Cannot submit request on your own deal', 400);
  }

  // Verify applicant company is active
  const applicant = await companyRepository.findById(applicantCompanyId);
  if (!applicant || applicant.status !== 'active') {
    throw new AppError('Your company must be active to submit requests', 403);
  }

  // Check for existing request
  const existing = await dealRequestRepository.findExistingRequest(dealId, applicantCompanyId);
  if (existing) {
    throw new AppError('You already have a request on this deal', 400);
  }

  const request = await dealRequestRepository.createRequest(null, {
    dealId,
    applicantCompanyId,
    requestDetails: payload.requestDetails,
    requestOffer: payload.requestOffer,
    status: 'pending',
  });

  logger.info('Deal request created', { requestId: request.id, dealId, applicantCompanyId });

  // Send email notification to deal owner (fire-and-forget)
  notifyDealOwnerOfNewRequest(deal, applicant, request).catch((err) => {
    logger.error('Failed to send new request notification', { error: err.message });
  });

  return sanitizeRequest(request);
};

/**
 * Get requests for a deal (owner view)
 */
const getDealRequests = async (dealId, companyId, filters = {}) => {
  const deal = await dealRepository.findById(dealId);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }
  if (deal.company_id !== companyId) {
    throw new AppError('Unauthorized to view requests for this deal', 403);
  }

  const [requests, stats] = await Promise.all([
    dealRequestRepository.findByDealId(dealId, filters),
    dealRequestRepository.getRequestStats(dealId),
  ]);

  return {
    requests: requests.map(sanitizeRequest),
    stats: {
      total: parseInt(stats.total, 10),
      pending: parseInt(stats.pending, 10),
      accepted: parseInt(stats.accepted, 10),
      rejected: parseInt(stats.rejected, 10),
      withdrawn: parseInt(stats.withdrawn, 10),
      lowestOffer: stats.lowest_offer ? parseFloat(stats.lowest_offer) : null,
      highestOffer: stats.highest_offer ? parseFloat(stats.highest_offer) : null,
      averageOffer: stats.average_offer ? parseFloat(stats.average_offer) : null,
    },
  };
};

/**
 * Get my submitted requests (as applicant)
 */
const getMyRequests = async (companyId, filters = {}) => {
  const requests = await dealRequestRepository.findByApplicantCompanyId(companyId, filters);
  return requests.map(sanitizeRequest);
};

/**
 * Accept or reject a request (by deal owner)
 */
const updateRequestStatus = async (dealId, requestId, companyId, newStatus) => {
  const deal = await dealRepository.findById(dealId);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }
  if (deal.company_id !== companyId) {
    throw new AppError('Unauthorized to update requests for this deal', 403);
  }

  const request = await dealRequestRepository.findById(requestId);
  if (!request) {
    throw new AppError('Request not found', 404);
  }
  if (request.deal_id !== dealId) {
    throw new AppError('Request does not belong to this deal', 400);
  }
  if (request.status !== 'pending') {
    throw new AppError(`Request is already ${request.status}`, 400);
  }

  const updated = await dealRequestRepository.updateStatus(requestId, newStatus);
  logger.info('Deal request status updated', { requestId, dealId, newStatus });

  // If accepted, optionally close the deal or set to negotiating
  if (newStatus === 'accepted') {
    await dealRepository.updateStatus(dealId, 'negotiating');
    logger.info('Deal moved to negotiating', { dealId });
  }

  // Notify applicant (fire-and-forget)
  notifyApplicantOfStatusChange(request, newStatus).catch((err) => {
    logger.error('Failed to send status change notification', { error: err.message });
  });

  return sanitizeRequest(updated);
};

/**
 * Withdraw own request
 */
const withdrawRequest = async (requestId, companyId) => {
  const request = await dealRequestRepository.findById(requestId);
  if (!request) {
    throw new AppError('Request not found', 404);
  }
  if (request.applicant_company_id !== companyId) {
    throw new AppError('Unauthorized to withdraw this request', 403);
  }
  if (request.status !== 'pending') {
    throw new AppError(`Cannot withdraw a request that is ${request.status}`, 400);
  }

  const withdrawn = await dealRequestRepository.withdrawRequest(requestId);
  logger.info('Deal request withdrawn', { requestId, companyId });
  return sanitizeRequest(withdrawn);
};

// ─────────────────────────────────────────────────────────────
// ADMIN OPERATIONS
// ─────────────────────────────────────────────────────────────

const adminGetAllDeals = async (filters = {}) => {
  const deals = await dealRepository.listAll(filters);
  return deals.map(sanitizeDeal);
};

const adminGetDealDetails = async (dealId) => {
  const deal = await dealRepository.findById(dealId);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }

  const [requests, stats] = await Promise.all([
    dealRequestRepository.findByDealId(dealId),
    dealRequestRepository.getRequestStats(dealId),
  ]);

  return {
    deal: sanitizeDeal(deal),
    requests: requests.map(sanitizeRequest),
    stats: {
      total: parseInt(stats.total, 10),
      pending: parseInt(stats.pending, 10),
      accepted: parseInt(stats.accepted, 10),
      rejected: parseInt(stats.rejected, 10),
    },
  };
};

const adminUpdateDealStatus = async (dealId, status) => {
  const deal = await dealRepository.findById(dealId);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }

  const updated = await dealRepository.updateStatus(dealId, status);
  logger.info('Admin updated deal status', { dealId, status });
  return sanitizeDeal(updated);
};

// ─────────────────────────────────────────────────────────────
// EMAIL NOTIFICATIONS
// ─────────────────────────────────────────────────────────────

const notifyDealOwnerOfNewRequest = async (deal, applicant, request) => {
  // Get deal owner's user info
  const ownerCompany = await companyRepository.findById(deal.company_id);
  if (!ownerCompany) return;

  // Create in-app notification
  try {
    await notificationService.createNotification({
      userId: ownerCompany.agent_id,
      type: NOTIFICATION_TYPES.DEAL_REQUEST_RECEIVED,
      title: 'New Request on Your Deal',
      message: `${applicant.name} has submitted a request on "${deal.deal_name}"`,
      metadata: {
        dealId: deal.id,
        dealName: deal.deal_name,
        requestId: request.id,
        applicantCompanyId: applicant.id,
        applicantCompanyName: applicant.name,
        offer: request.request_offer,
      },
    });
  } catch (err) {
    logger.error({ err, dealId: deal.id }, 'Failed to create in-app notification for new request');
  }

  // Send email notification
  if (!ownerCompany.email) return;

  await sendMail({
    to: ownerCompany.email,
    subject: `New request on "${deal.deal_name}"`,
    text: `You have a new request from ${applicant.name} on your deal "${deal.deal_name}".${request.request_offer ? ` Offer: ${request.request_offer}` : ''}`,
    html: `
            <h2>New Request on Your Deal</h2>
            <p>You have a new request from <strong>${applicant.name}</strong> on your deal "<strong>${deal.deal_name}</strong>".</p>
            ${request.request_offer ? `<p><strong>Offer Amount:</strong> ${request.request_offer}</p>` : ''}
            ${request.request_details ? `<p><strong>Details:</strong> ${request.request_details}</p>` : ''}
            <p>Log in to view and respond to this request.</p>
        `,
  });
};

const notifyApplicantOfStatusChange = async (request, newStatus) => {
  const applicant = await companyRepository.findById(request.applicant_company_id);
  if (!applicant) return;

  const isAccepted = newStatus === 'accepted';
  const statusText = isAccepted ? 'accepted' : 'declined';
  const notificationType = isAccepted
    ? NOTIFICATION_TYPES.DEAL_REQUEST_ACCEPTED
    : NOTIFICATION_TYPES.DEAL_REQUEST_REJECTED;

  // Create in-app notification
  try {
    await notificationService.createNotification({
      userId: applicant.agent_id,
      type: notificationType,
      title: `Request ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
      message: `Your request on "${request.deal_name}" has been ${statusText}`,
      metadata: {
        dealId: request.deal_id,
        dealName: request.deal_name,
        requestId: request.id,
        status: newStatus,
      },
    });
  } catch (err) {
    logger.error({ err, requestId: request.id }, 'Failed to create in-app notification for status change');
  }

  // Send email notification
  if (!applicant.email) return;

  await sendMail({
    to: applicant.email,
    subject: `Your request on "${request.deal_name}" has been ${statusText}`,
    text: `Your request on "${request.deal_name}" has been ${statusText}.`,
    html: `
            <h2>Request Update</h2>
            <p>Your request on "<strong>${request.deal_name}</strong>" has been <strong>${statusText}</strong>.</p>
            ${isAccepted ? '<p>You can now message the deal owner to discuss next steps.</p>' : ''}
        `,
  });
};

module.exports = {
  // Deal operations
  createDeal,
  getDealById,
  searchDeals,
  getMyDeals,
  updateDeal,
  archiveDeal,
  // Request operations
  createDealRequest,
  getDealRequests,
  getMyRequests,
  updateRequestStatus,
  withdrawRequest,
  // Admin
  adminGetAllDeals,
  adminGetDealDetails,
  adminUpdateDealStatus,
};
