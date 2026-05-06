const AppError = require('../../../core/errors/AppError');
const { pool } = require('../../../infrastructure/config/db');
const config = require('../../../infrastructure/config/env');
const dealRepository = require('../repository/deal.repository');
const dealRequestRepository = require('../repository/dealRequest.repository');
const dealAttachmentRepository = require('../repository/dealAttachment.repository');
const dealRequestDetailsRepository = require('../repository/dealRequestDetails.repository');
const companyModule = require('../../company');
const fileModule = require('../../file');
const { sendMail } = require('../../../infrastructure/config/mailer');
const logger = require('../../../shared/utils/logger');
const { companyRepository } = companyModule.repository;
const { fileRepository } = fileModule.repository;
const fileService = fileModule.service;

const getFileUrl = async (fileId) => {
  if (!fileId) return null;
  try {
    const file = await fileService.getFileById(fileId);
    return file.publicUrl;
  } catch {
    return null;
  }
};

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
    applicationsCount:
      deal.applications_count !== undefined && deal.applications_count !== null
        ? Number(deal.applications_count)
        : 0,
    createdAt: deal.created_at,
    updatedAt: deal.updated_at,
    companyName: deal.company_name,
    companyLogo: deal.company_logo,
    companyType: deal.company_type,
    companyIndustry: deal.company_industry,
    companyAddress: deal.company_address,
    companyStatus: deal.company_status,
    attachments: [],
  };
};

const sanitizeRequest = (request) => {
  if (!request) return null;
  return {
    id: request.id,
    dealId: request.deal_id,
    applicantCompanyId: request.applicant_company_id,
    requestKind: request.request_kind,
    requestType: request.request_type,
    requestDetails: request.request_details,
    requestOffer: request.request_offer ? parseFloat(request.request_offer) : null,
    status: request.status,
    canceledAt: request.canceled_at,
    canceledByCompanyId: request.canceled_by_company_id,
    cancelReason: request.cancel_reason,
    pausedAt: request.paused_at,
    pausedByCompanyId: request.paused_by_company_id,
    createdAt: request.created_at,
    updatedAt: request.updated_at,
    dealName: request.deal_name,
    dealOwnerCompanyId: request.deal_owner_company_id,
    applicantCompanyName: request.applicant_company_name,
    applicantCompanyLogo: request.applicant_company_logo,
    applicantCompanyType: request.applicant_company_type,
    applicantIndustry: request.applicant_industry,
    dealType: request.deal_type,
    dealValue: request.deal_value ? parseFloat(request.deal_value) : null,
    dealStatus: request.deal_status,
    ownerCompanyName: request.owner_company_name,
    targetCompanyId: request.target_company_id,
    targetCompanyName: request.target_company_name,
    targetCompanyLogo: request.target_company_logo,
    targetCompanyType: request.target_company_type,
    targetCompanyIndustry: request.target_company_industry,
    supplyDetails: null,
    demandDetails: null,
    attachments: [],
  };
};

const sanitizeDealAttachment = (attachment, fileUrl = null) => ({
  id: attachment.id,
  fileId: attachment.file_id,
  kind: attachment.kind,
  sortOrder: attachment.sort_order,
  createdAt: attachment.created_at,
  fileUrl,
});

const sanitizeRequestAttachment = (attachment, fileUrl = null) => ({
  id: attachment.id,
  fileId: attachment.file_id,
  sortOrder: attachment.sort_order,
  createdAt: attachment.created_at,
  fileUrl,
});

const sanitizeSupplyDetails = (item) => {
  if (!item) return null;
  return {
    productServiceName: item.product_service_name,
    category: item.category,
    quantityRequired: item.quantity_required ? parseFloat(item.quantity_required) : null,
    deliveryLocation: item.delivery_location,
    deliveryDate: item.delivery_date,
    targetPriceMin: item.target_price_min ? parseFloat(item.target_price_min) : null,
    targetPriceMax: item.target_price_max ? parseFloat(item.target_price_max) : null,
    currency: item.currency,
    paymentTermsPreference: item.payment_terms_preference,
    incoterm: item.incoterm,
    bulkDiscountExpectation: item.bulk_discount_expectation,
    supplyType: item.supply_type,
    keySpecifications: item.key_specifications,
    material: item.material,
    dimensionsSize: item.dimensions_size,
    certificationsRequired: item.certifications_required || [],
    qualityLevel: item.quality_level,
    qualityLevelOtherText: item.quality_level_other_text,
    countryOfOrigin: item.country_of_origin,
    maxLeadTimeAccepted: item.max_lead_time_accepted,
    deliveryMethodPreference: item.delivery_method_preference,
    packagingRequirements: item.packaging_requirements,
    specialConditionsNotes: item.special_conditions_notes,
  };
};

const sanitizeDemandDetails = (item) => {
  if (!item) return null;
  return {
    productServiceName: item.product_service_name,
    availableQuantity: item.available_quantity ? parseFloat(item.available_quantity) : null,
    offerValidityDays: item.offer_validity_days,
    unitPrice: item.unit_price ? parseFloat(item.unit_price) : null,
    currency: item.currency,
    totalPrice: item.total_price ? parseFloat(item.total_price) : null,
    volumeDiscountTiers: item.volume_discount_tiers || [],
    moq: item.moq ? parseFloat(item.moq) : null,
    availabilityType: item.availability_type,
    quantityInStock: item.quantity_in_stock ? parseFloat(item.quantity_in_stock) : null,
    maxProduceQuantity: item.max_produce_quantity ? parseFloat(item.max_produce_quantity) : null,
    productionLeadTime: item.production_lead_time,
    specsMatchRfq: item.specs_match_rfq,
    differencesFromRfq: item.differences_from_rfq,
    materialOffered: item.material_offered,
    dimensions: item.dimensions,
    certificationsHeld: item.certifications_held || [],
    paymentTerms: item.payment_terms,
    deliveryTerms: item.delivery_terms,
    warrantyReturnPolicy: item.warranty_return_policy,
    exclusivityConfidentiality: item.exclusivity_confidentiality,
    additionalNotes: item.additional_notes,
  };
};

const ensureFilesExist = async (fileIds = []) => {
  if (!fileIds.length) return;
  const files = await fileRepository.findByIds(fileIds);
  if (files.length !== fileIds.length) {
    throw new AppError('One or more attachments reference invalid file IDs', 400);
  }
};

const attachDealAttachments = async (deals) => {
  if (!deals.length) return deals;

  const dealIds = deals.map((deal) => deal.id);
  const attachments = await dealAttachmentRepository.listByDealIds(dealIds);
  const attachmentByDealId = new Map();

  for (const attachment of attachments) {
    if (!attachmentByDealId.has(attachment.deal_id)) {
      attachmentByDealId.set(attachment.deal_id, []);
    }
    attachmentByDealId.get(attachment.deal_id).push(attachment);
  }

  for (const deal of deals) {
    const dealAttachments = attachmentByDealId.get(deal.id) || [];
    deal.attachments = await Promise.all(
      dealAttachments.map(async (attachment) => {
        const fileUrl = await getFileUrl(attachment.file_id);
        return sanitizeDealAttachment(attachment, fileUrl);
      })
    );
  }

  return deals;
};

const enrichRequests = async (requests) => {
  if (!requests.length) return requests;

  const requestIds = requests.map((request) => request.id);
  const [supplyDetailsRows, demandDetailsRows, requestAttachmentRows] = await Promise.all([
    dealRequestDetailsRepository.getSupplyDetailsByRequestIds(requestIds),
    dealRequestDetailsRepository.getDemandDetailsByRequestIds(requestIds),
    dealRequestDetailsRepository.getAttachmentsByRequestIds(requestIds),
  ]);

  const supplyByRequestId = new Map(supplyDetailsRows.map((row) => [row.request_id, row]));
  const demandByRequestId = new Map(demandDetailsRows.map((row) => [row.request_id, row]));
  const attachmentsByRequestId = new Map();

  for (const row of requestAttachmentRows) {
    if (!attachmentsByRequestId.has(row.request_id)) {
      attachmentsByRequestId.set(row.request_id, []);
    }
    attachmentsByRequestId.get(row.request_id).push(row);
  }

  for (const request of requests) {
    request.supplyDetails = sanitizeSupplyDetails(supplyByRequestId.get(request.id));
    request.demandDetails = sanitizeDemandDetails(demandByRequestId.get(request.id));

    const requestAttachments = attachmentsByRequestId.get(request.id) || [];
    request.attachments = await Promise.all(
      requestAttachments.map(async (attachment) => {
        const fileUrl = await getFileUrl(attachment.file_id);
        return sanitizeRequestAttachment(attachment, fileUrl);
      })
    );
  }

  return requests;
};

const inferRequestOffer = (payload) => {
  if (payload.requestKind === 'demand') {
    return payload.demandDetails?.unitPrice ?? null;
  }

  return payload.supplyDetails?.targetPriceMax ?? payload.supplyDetails?.targetPriceMin ?? null;
};

const inferRequestDetailsSummary = (payload) => {
  if (payload.requestKind === 'demand') {
    const name = payload.demandDetails?.productServiceName;
    return name ? `Demand offer: ${name}` : 'Demand offer';
  }

  const name = payload.supplyDetails?.productServiceName;
  return name ? `Supply request: ${name}` : 'Supply request';
};

const getOpenDealLimitErrorMessage = () =>
  `Open deal limit reached (${config.deals.maxOpenPerCompany}). Close existing deals before creating new ones.`;

const ensureCanTransitionToOpen = async ({ companyId, currentStatus, nextStatus }) => {
  if (nextStatus !== 'open' || currentStatus === 'open') return;

  const openDeals = await dealRepository.countOpenByCompanyId(companyId);
  if (openDeals >= config.deals.maxOpenPerCompany) {
    throw new AppError(getOpenDealLimitErrorMessage(), 400);
  }
};

const createDeal = async (companyId, payload) => {
  const company = await companyRepository.findById(companyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }
  if (company.status !== 'active') {
    throw new AppError('Company must be active to create deals', 403);
  }

  const openDeals = await dealRepository.countOpenByCompanyId(companyId);
  if (openDeals >= config.deals.maxOpenPerCompany) {
    throw new AppError(getOpenDealLimitErrorMessage(), 400);
  }

  const attachments = payload.attachments || [];
  await ensureFilesExist(attachments.map((item) => item.fileId));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const deal = await dealRepository.createDeal(client, {
      companyId,
      dealName: payload.dealName,
      dealDescription: payload.dealDescription,
      dealValue: payload.dealValue,
      dealType: payload.dealType,
      status: 'open',
    });

    await dealAttachmentRepository.replaceForDeal(client, deal.id, attachments);

    await client.query('COMMIT');

    const [sanitized] = await attachDealAttachments([sanitizeDeal(deal)]);
    logger.info('Deal created', { dealId: deal.id, companyId, dealType: payload.dealType });
    return sanitized;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const getDealById = async (dealId) => {
  const deal = await dealRepository.findById(dealId);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }
  const [enriched] = await attachDealAttachments([sanitizeDeal(deal)]);
  return enriched;
};

const searchDeals = async (filters, excludeCompanyId = null) => {
  const {
    keyword,
    dealType,
    status,
    industry,
    minValue,
    maxValue,
    createdFrom,
    createdTo,
    sortBy,
    sortOrder,
    limit,
    offset,
  } = filters;

  const [deals, total] = await Promise.all([
    dealRepository.search({
      keyword,
      dealType,
      status: status || 'open',
      companyIndustry: industry,
      minValue,
      maxValue,
      createdFrom,
      createdTo,
      sortBy,
      sortOrder,
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
      createdFrom,
      createdTo,
      excludeCompanyId,
    }),
  ]);

  const sanitized = deals.map(sanitizeDeal);
  await attachDealAttachments(sanitized);

  return {
    deals: sanitized,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + deals.length < total,
    },
  };
};

const getMyDeals = async (companyId, filters = {}) => {
  const deals = await dealRepository.findByCompanyId(companyId, filters);
  const sanitized = deals.map(sanitizeDeal);
  await attachDealAttachments(sanitized);
  return sanitized;
};

const updateDeal = async (dealId, companyId, updates) => {
  const deal = await dealRepository.findById(dealId);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }
  if (deal.company_id !== companyId) {
    throw new AppError('Unauthorized to update this deal', 403);
  }

  await ensureCanTransitionToOpen({
    companyId,
    currentStatus: deal.status,
    nextStatus: updates.status,
  });

  const attachments = updates.attachments;
  if (attachments) {
    await ensureFilesExist(attachments.map((item) => item.fileId));
  }

  const dbUpdates = { ...updates };
  delete dbUpdates.attachments;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updated = await dealRepository.updateById(dealId, dbUpdates, client);
    if (attachments) {
      await dealAttachmentRepository.replaceForDeal(client, dealId, attachments);
    }

    await client.query('COMMIT');

    const [enriched] = await attachDealAttachments([sanitizeDeal(updated)]);
    logger.info('Deal updated', { dealId, companyId, updates: Object.keys(updates) });
    return enriched;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

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
  const [enriched] = await attachDealAttachments([sanitizeDeal(archived)]);
  return enriched;
};

const createDealRequest = async (dealId, applicantCompanyId, payload) => {
  const deal = await dealRepository.findById(dealId);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }
  if (!['open', 'negotiating'].includes(deal.status)) {
    throw new AppError('Deal is not open for requests', 400);
  }

  if (deal.company_id === applicantCompanyId) {
    throw new AppError('Cannot submit request on your own deal', 400);
  }

  const applicant = await companyRepository.findById(applicantCompanyId);
  if (!applicant || applicant.status !== 'active') {
    throw new AppError('Your company must be active to submit requests', 403);
  }

  const existing = await dealRequestRepository.findExistingRequest(dealId, applicantCompanyId);
  if (existing) {
    throw new AppError('You already have a request on this deal', 400);
  }

  const attachments = payload.attachments || [];
  await ensureFilesExist(attachments.map((item) => item.fileId));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const request = await dealRequestRepository.createRequest(client, {
      dealId,
      applicantCompanyId,
      requestKind: payload.requestKind,
      requestType: 'inSupply',
      requestDetails: inferRequestDetailsSummary(payload),
      requestOffer: inferRequestOffer(payload),
      status: 'pending',
    });

    if (payload.requestKind === 'demand') {
      await dealRequestDetailsRepository.upsertDemandDetails(
        client,
        request.id,
        payload.demandDetails
      );
    } else {
      await dealRequestDetailsRepository.upsertSupplyDetails(
        client,
        request.id,
        payload.supplyDetails
      );
    }

    await dealRequestDetailsRepository.replaceRequestAttachments(client, request.id, attachments);

    await client.query('COMMIT');

    logger.info('Deal request created', {
      requestId: request.id,
      dealId,
      applicantCompanyId,
      requestKind: payload.requestKind,
    });

    notifyDealOwnerOfNewRequest(deal, applicant, request).catch((err) => {
      logger.error('Failed to send new request notification', { error: err.message });
    });

    const [enriched] = await enrichRequests([sanitizeRequest(request)]);
    return enriched;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const createDirectRequest = async (applicantCompanyId, payload) => {
  const targetCompany = await companyRepository.findById(payload.targetCompanyId);
  if (!targetCompany) {
    throw new AppError('Target company not found', 404);
  }
  if (targetCompany.status !== 'active') {
    throw new AppError('Target company must be active to receive direct requests', 400);
  }
  if (targetCompany.id === applicantCompanyId) {
    throw new AppError('Cannot send direct request to your own company', 400);
  }

  const applicant = await companyRepository.findById(applicantCompanyId);
  if (!applicant || applicant.status !== 'active') {
    throw new AppError('Your company must be active to submit requests', 403);
  }

  const existing = await dealRequestRepository.findExistingDirectRequest(
    applicantCompanyId,
    payload.targetCompanyId
  );
  if (existing) {
    throw new AppError('You already have an active direct request for this company', 400);
  }

  const attachments = payload.attachments || [];
  await ensureFilesExist(attachments.map((item) => item.fileId));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const request = await dealRequestRepository.createRequest(client, {
      dealId: null,
      applicantCompanyId,
      targetCompanyId: payload.targetCompanyId,
      requestKind: payload.requestKind,
      requestType: 'direct',
      requestDetails: inferRequestDetailsSummary(payload),
      requestOffer: inferRequestOffer(payload),
      status: 'pending',
    });

    if (payload.requestKind === 'demand') {
      await dealRequestDetailsRepository.upsertDemandDetails(
        client,
        request.id,
        payload.demandDetails
      );
    } else {
      await dealRequestDetailsRepository.upsertSupplyDetails(
        client,
        request.id,
        payload.supplyDetails
      );
    }

    await dealRequestDetailsRepository.replaceRequestAttachments(client, request.id, attachments);
    await client.query('COMMIT');

    logger.info('Direct request created', {
      requestId: request.id,
      applicantCompanyId,
      targetCompanyId: payload.targetCompanyId,
      requestKind: payload.requestKind,
    });

    const [enriched] = await enrichRequests([sanitizeRequest(request)]);
    return enriched;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

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

  const sanitizedRequests = requests.map(sanitizeRequest);
  await enrichRequests(sanitizedRequests);

  return {
    requests: sanitizedRequests,
    stats: {
      total: parseInt(stats.total, 10),
      pending: parseInt(stats.pending, 10),
      paused: parseInt(stats.paused, 10),
      accepted: parseInt(stats.accepted, 10),
      rejected: parseInt(stats.rejected, 10),
      canceled: parseInt(stats.canceled, 10),
      lowestOffer: stats.lowest_offer ? parseFloat(stats.lowest_offer) : null,
      highestOffer: stats.highest_offer ? parseFloat(stats.highest_offer) : null,
      averageOffer: stats.average_offer ? parseFloat(stats.average_offer) : null,
    },
  };
};

const getMyRequests = async (companyId, filters = {}) => {
  const requestType = filters.requestType;
  const includeDirect = !requestType || requestType === 'direct';
  const includeInSupply = !requestType || requestType === 'inSupply';
  const requestKinds = includeInSupply ? ['supply', 'rfq'] : undefined;

  const requests = await dealRequestRepository.findByApplicantCompanyId(companyId, {
    ...filters,
    requestKinds,
    includeDirect,
  });
  const sanitized = requests.map(sanitizeRequest);
  await enrichRequests(sanitized);
  return sanitized;
};

const getMyApplications = async (companyId, filters = {}) => {
  const requests = await dealRequestRepository.findByApplicantCompanyId(companyId, {
    ...filters,
    requestType: 'inSupply',
    requestKinds: ['demand'],
    includeDirect: false,
  });
  const sanitized = requests.map(sanitizeRequest);
  await enrichRequests(sanitized);
  return sanitized;
};

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
  if (request.deal_id !== Number(dealId)) {
    throw new AppError('Request does not belong to this deal', 400);
  }
  if (request.status !== 'pending') {
    throw new AppError(`Request is ${request.status} and cannot be accepted/rejected`, 400);
  }

  const updated = await dealRequestRepository.updateStatus(requestId, newStatus);
  logger.info('Deal request status updated', { requestId, dealId, newStatus });

  if (newStatus === 'accepted') {
    await dealRepository.updateStatus(dealId, 'negotiating');
    logger.info('Deal moved to negotiating', { dealId });
  }

  notifyApplicantOfStatusChange(request, newStatus).catch((err) => {
    logger.error('Failed to send status change notification', { error: err.message });
  });

  const [enriched] = await enrichRequests([sanitizeRequest(updated)]);
  return enriched;
};

const pauseRequest = async (requestId, companyId) => {
  const request = await dealRequestRepository.findById(requestId);
  if (!request) {
    throw new AppError('Request not found', 404);
  }
  if (request.applicant_company_id !== companyId) {
    throw new AppError('Unauthorized to pause this request', 403);
  }
  if (request.status !== 'pending') {
    throw new AppError(
      `Only pending requests can be paused. Current status: ${request.status}`,
      400
    );
  }

  const paused = await dealRequestRepository.pauseRequest(requestId, companyId);
  logger.info('Deal request paused', { requestId, companyId });
  const [enriched] = await enrichRequests([sanitizeRequest(paused)]);
  return enriched;
};

const cancelRequest = async (requestId, companyId, cancelReason) => {
  if (!cancelReason || !cancelReason.trim()) {
    throw new AppError('cancelReason is required', 400);
  }

  const request = await dealRequestRepository.findById(requestId);
  if (!request) {
    throw new AppError('Request not found', 404);
  }
  if (request.applicant_company_id !== companyId) {
    throw new AppError('Unauthorized to cancel this request', 403);
  }
  if (!['pending', 'paused'].includes(request.status)) {
    throw new AppError(
      `Only pending or paused requests can be canceled. Current status: ${request.status}`,
      400
    );
  }

  const canceled = await dealRequestRepository.cancelRequest(
    requestId,
    companyId,
    cancelReason.trim()
  );
  logger.info('Deal request canceled', { requestId, companyId });
  const [enriched] = await enrichRequests([sanitizeRequest(canceled)]);
  return enriched;
};

const withdrawRequest = async (requestId, companyId, cancelReason) => {
  return cancelRequest(requestId, companyId, cancelReason);
};

const notifyDealOwnerOfNewRequest = async (deal, applicant, request) => {
  const ownerCompany = await companyRepository.findById(deal.company_id);
  if (!ownerCompany || !ownerCompany.email) return;

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
  if (!applicant || !applicant.email) return;

  const isAccepted = newStatus === 'accepted';
  const statusText = isAccepted ? 'accepted' : 'declined';

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
  createDeal,
  getDealById,
  searchDeals,
  getMyDeals,
  updateDeal,
  archiveDeal,
  createDirectRequest,
  createDealRequest,
  getDealRequests,
  getMyRequests,
  getMyApplications,
  updateRequestStatus,
  pauseRequest,
  cancelRequest,
  withdrawRequest,
  __testables: {
    sanitizeDeal,
    sanitizeRequest,
    inferRequestOffer,
    inferRequestDetailsSummary,
    getOpenDealLimitErrorMessage,
    ensureCanTransitionToOpen,
  },
};
