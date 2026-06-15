const AppError = require('../../../core/errors/AppError');
const { pool } = require('../../../infrastructure/config/db');
const config = require('../../../infrastructure/config/env');
const dealRepository = require('../repository/deal.repository');
const dealRequestRepository = require('../repository/dealRequest.repository');
const dealAttachmentRepository = require('../repository/dealAttachment.repository');
const dealRequestDetailsRepository = require('../repository/dealRequestDetails.repository');
const companyModule = require('../../company');
const fileModule = require('../../file');
const { publicUrl } = require('../../../infrastructure/config/storage');
const { sendMail } = require('../../../infrastructure/config/mailer');
const logger = require('../../../shared/utils/logger');
const { companyRepository } = companyModule.repository;
const { fileRepository } = fileModule.repository;
const ACTIVE_REQUEST_STATUSES = ['pending', 'paused', 'accepted'];
const ACTIVE_IN_SUPPLY_REQUEST_CONSTRAINT = 'uq_deal_requests_active_in_supply';

const buildPublicUrl = (filePath) => {
  if (!publicUrl || !filePath) return null;
  return `${publicUrl.replace(/\/$/, '')}/${filePath}`;
};

const buildPagination = ({ total, limit, offset, returnedCount }) => ({
  total,
  limit,
  offset,
  hasMore: offset + returnedCount < total,
});

const logListMetrics = (operation, startedAt, details = {}) => {
  logger.debug({
    operation,
    durationMs: Date.now() - startedAt,
    ...details,
  });
};

const loadFileUrlsByIds = async (fileIds = []) => {
  const uniqueFileIds = [...new Set(fileIds.filter(Boolean))];
  if (!uniqueFileIds.length) return new Map();

  const files = await fileRepository.findByIds(uniqueFileIds);
  const fileUrlById = new Map();

  for (const file of files) {
    if (file.deletedAt) continue;
    fileUrlById.set(file.id, buildPublicUrl(file.filePath));
  }

  return fileUrlById;
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

const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const sanitizeSupplyDetails = (item) => {
  if (!item) return null;
  return {
    productServiceName: item.product_service_name,
    category: item.category,
    quantityRequired: item.quantity_required ? parseFloat(item.quantity_required) : null,
    deliveryLocation: item.delivery_location,
    deliveryDate: item.delivery_date,
    targetPrice: item.target_price ? parseFloat(item.target_price) : null,
    currency: item.currency,
    paymentTermsPreference: item.payment_terms_preference,
    incoterm: item.incoterm,
    bulkDiscountExpectation: item.bulk_discount_expectation,
    supplyType: item.supply_type,
    keySpecifications: item.key_specifications,
    material: item.material,
    dimensionsSize: item.dimensions_size,
    certificationsRequired: item.certifications_required,
    qualityLevel: item.quality_level,
    otherQualityLevelDescription: item.other_quality_level_description,
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
    certificationsHeld: item.certifications_held,
    paymentTerms: item.payment_terms,
    deliveryTerms: item.delivery_terms,
    warrantyPolicy: item.warranty_policy,
    returnPolicy: item.return_policy,
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
  const fileUrlById = await loadFileUrlsByIds(attachments.map((attachment) => attachment.file_id));
  const attachmentByDealId = new Map();

  for (const attachment of attachments) {
    if (!attachmentByDealId.has(attachment.deal_id)) {
      attachmentByDealId.set(attachment.deal_id, []);
    }
    attachmentByDealId.get(attachment.deal_id).push(attachment);
  }

  for (const deal of deals) {
    const dealAttachments = attachmentByDealId.get(deal.id) || [];
    deal.attachments = dealAttachments.map((attachment) =>
      sanitizeDealAttachment(attachment, fileUrlById.get(attachment.file_id) || null)
    );
  }

  logger.debug({
    operation: 'attachDealAttachments',
    dealCount: deals.length,
    attachmentCount: attachments.length,
    fileLookupCount: fileUrlById.size,
  });

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
  const fileUrlById = await loadFileUrlsByIds(requestAttachmentRows.map((row) => row.file_id));

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
    request.attachments = requestAttachments.map((attachment) =>
      sanitizeRequestAttachment(attachment, fileUrlById.get(attachment.file_id) || null)
    );
  }

  logger.debug({
    operation: 'enrichRequests',
    requestCount: requests.length,
    attachmentCount: requestAttachmentRows.length,
    fileLookupCount: fileUrlById.size,
  });

  return requests;
};

const inferRequestOffer = (payload) => {
  if (payload.requestType === 'inDemand') {
    return payload.demandDetails?.unitPrice ?? null;
  }

  return payload.supplyDetails?.targetPrice ?? null;
};

const inferRequestDetailsSummary = (payload, options = {}) => {
  if (payload.requestType === 'inDemand') {
    const name = payload.demandDetails?.productServiceName;
    return name ? `Demand offer: ${name}` : 'Demand offer';
  }

  if (options.isDirect) {
    const name = payload.supplyDetails?.productServiceName;
    return name ? `Direct request: ${name}` : 'Direct request';
  }

  const name = payload.supplyDetails?.productServiceName;
  return name ? `Supply request: ${name}` : 'Supply request';
};

const ensureFilesForRequestPayload = async (payload) => {
  const attachments = payload.attachments || [];
  await ensureFilesExist(attachments.map((item) => item.fileId));
  return attachments;
};

const validateReplacementPayloadForRequestType = (requestType, payload) => {
  if (requestType === 'direct') {
    if (!payload.supplyDetails) {
      throw new AppError('supplyDetails is required for direct requests', 400);
    }
    if (payload.demandDetails) {
      throw new AppError('demandDetails is not allowed for direct requests', 400);
    }
    return;
  }

  if (requestType === 'inDemand') {
    if (!payload.demandDetails) {
      throw new AppError('demandDetails is required for inDemand requests', 400);
    }
    if (payload.supplyDetails) {
      throw new AppError('supplyDetails is not allowed for inDemand requests', 400);
    }
    return;
  }

  if (!payload.supplyDetails) {
    throw new AppError('supplyDetails is required for inSupply requests', 400);
  }
  if (payload.demandDetails) {
    throw new AppError('demandDetails is not allowed for inSupply requests', 400);
  }
};

const isUniqueConstraintViolation = (error, constraintName) =>
  error?.code === '23505' && error?.constraint === constraintName;

const lockCompanyDeals = async (client, companyId) => {
  await client.query('SELECT pg_advisory_xact_lock($1)', [Number(companyId)]);
};

const getOpenDealLimitErrorMessage = () =>
  `Open deal limit reached (${config.deals.maxOpenPerCompany}). Close existing deals before creating new ones.`;

const ensureCanTransitionToOpen = async ({ companyId, currentStatus, nextStatus, client }) => {
  if (nextStatus !== 'open' || currentStatus === 'open') return;

  await lockCompanyDeals(client, companyId);
  const openDeals = await dealRepository.countOpenByCompanyId(companyId, client);
  if (openDeals >= config.deals.maxOpenPerCompany) {
    logger.warn({ companyId, openDeals }, 'Open deal cap prevented reopening deal');
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

  const attachments = payload.attachments || [];
  await ensureFilesExist(attachments.map((item) => item.fileId));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockCompanyDeals(client, companyId);

    const openDeals = await dealRepository.countOpenByCompanyId(companyId, client);
    if (openDeals >= config.deals.maxOpenPerCompany) {
      logger.warn({ companyId, openDeals }, 'Open deal cap prevented deal creation');
      throw new AppError(getOpenDealLimitErrorMessage(), 400);
    }

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
  const startedAt = Date.now();
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
  logListMetrics('searchDeals', startedAt, {
    total,
    returnedCount: sanitized.length,
    excludeCompanyId,
  });

  return {
    items: sanitized,
    pagination: buildPagination({
      total,
      limit,
      offset,
      returnedCount: deals.length,
    }),
  };
};

const getMyDeals = async (companyId, filters = {}) => {
  const startedAt = Date.now();
  const { limit = 50, offset = 0 } = filters;
  const [deals, total] = await Promise.all([
    dealRepository.findByCompanyId(companyId, filters),
    dealRepository.countByCompanyId(companyId, filters),
  ]);
  const sanitized = deals.map(sanitizeDeal);
  await attachDealAttachments(sanitized);
  logListMetrics('getMyDeals', startedAt, {
    companyId,
    total,
    returnedCount: sanitized.length,
  });
  return {
    items: sanitized,
    pagination: buildPagination({ total, limit, offset, returnedCount: sanitized.length }),
  };
};

const updateDeal = async (dealId, companyId, updates) => {
  const deal = await dealRepository.findById(dealId);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }
  if (deal.company_id !== companyId) {
    throw new AppError('Unauthorized to update this deal', 403);
  }

  const attachments = updates.attachments;
  if (attachments) {
    await ensureFilesExist(attachments.map((item) => item.fileId));
  }

  const dbUpdates = { ...updates };
  delete dbUpdates.attachments;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureCanTransitionToOpen({
      companyId,
      currentStatus: deal.status,
      nextStatus: updates.status,
      client,
    });

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
  if (deal.status !== 'open') {
    throw new AppError('Deal is not open for requests', 400);
  }

  if (deal.company_id === applicantCompanyId) {
    throw new AppError('Cannot submit request on your own deal', 400);
  }

  const applicant = await companyRepository.findById(applicantCompanyId);
  if (!applicant || applicant.status !== 'active') {
    throw new AppError('Your company must be active to submit requests', 403);
  }

  const existing = await dealRequestRepository.findExistingRequest(
    dealId,
    applicantCompanyId,
    ACTIVE_REQUEST_STATUSES
  );
  if (existing) {
    logger.warn({ dealId, applicantCompanyId }, 'Duplicate active in-supply request rejected');
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
      requestType: payload.requestType,
      requestDetails: inferRequestDetailsSummary(payload),
      requestOffer: inferRequestOffer(payload),
      status: 'pending',
    });

    if (payload.requestType === 'inDemand') {
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
      requestType: payload.requestType,
    });

    const [enriched] = await enrichRequests([sanitizeRequest(request)]);
    return enriched;
  } catch (error) {
    await client.query('ROLLBACK');
    if (isUniqueConstraintViolation(error, ACTIVE_IN_SUPPLY_REQUEST_CONSTRAINT)) {
      logger.warn(
        { dealId, applicantCompanyId, constraint: ACTIVE_IN_SUPPLY_REQUEST_CONSTRAINT },
        'DB unique protection rejected duplicate active in-supply request'
      );
      throw new AppError('You already have a request on this deal', 400);
    }
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

  const attachments = payload.attachments || [];
  await ensureFilesExist(attachments.map((item) => item.fileId));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const request = await dealRequestRepository.createRequest(client, {
      dealId: null,
      applicantCompanyId,
      targetCompanyId: payload.targetCompanyId,
      requestType: 'direct',
      requestDetails: inferRequestDetailsSummary(payload, { isDirect: true }),
      requestOffer: inferRequestOffer(payload),
      status: 'pending',
    });

    await dealRequestDetailsRepository.upsertSupplyDetails(
      client,
      request.id,
      payload.supplyDetails
    );

    await dealRequestDetailsRepository.replaceRequestAttachments(client, request.id, attachments);
    await client.query('COMMIT');

    logger.info('Direct request created', {
      requestId: request.id,
      applicantCompanyId,
      targetCompanyId: payload.targetCompanyId,
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
  const startedAt = Date.now();
  const { limit = 50, offset = 0 } = filters;
  const deal = await dealRepository.findById(dealId);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }
  if (deal.company_id !== companyId) {
    throw new AppError('Unauthorized to view requests for this deal', 403);
  }

  const [requests, total, stats] = await Promise.all([
    dealRequestRepository.findByDealId(dealId, filters),
    dealRequestRepository.countByDealId(dealId, filters),
    dealRequestRepository.getRequestStats(dealId, filters),
  ]);

  const sanitizedRequests = requests.map(sanitizeRequest);
  await enrichRequests(sanitizedRequests);
  logListMetrics('getDealRequests', startedAt, {
    companyId,
    dealId,
    total,
    returnedCount: sanitizedRequests.length,
  });

  return {
    items: sanitizedRequests,
    pagination: buildPagination({
      total,
      limit,
      offset,
      returnedCount: sanitizedRequests.length,
    }),
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

const listOutgoingRequests = async (companyId, filters = {}, overrides = {}) => {
  const startedAt = Date.now();
  const mergedFilters = { ...filters, ...overrides };
  const { limit = 50, offset = 0 } = mergedFilters;
  const [requests, total] = await Promise.all([
    dealRequestRepository.findByApplicantCompanyId(companyId, mergedFilters),
    dealRequestRepository.countByApplicantCompanyId(companyId, mergedFilters),
  ]);
  const sanitized = requests.map(sanitizeRequest);
  await enrichRequests(sanitized);
  logListMetrics('listOutgoingRequests', startedAt, {
    companyId,
    total,
    returnedCount: sanitized.length,
    requestType: mergedFilters.requestType || null,
    requestTypes: mergedFilters.requestTypes || null,
  });
  return {
    items: sanitized,
    pagination: buildPagination({ total, limit, offset, returnedCount: sanitized.length }),
  };
};

const getMyRequests = async (companyId, filters = {}) => {
  return listOutgoingRequests(companyId, filters, {
    requestTypes: ['direct', 'inSupply'],
  });
};

const getMyApplications = async (companyId, filters = {}) => {
  return listOutgoingRequests(companyId, filters, {
    requestType: 'inDemand',
  });
};

const getMyDirectRequests = async (companyId, filters = {}) => {
  const startedAt = Date.now();
  const { limit = 50, offset = 0 } = filters;
  const [requests, total] = await Promise.all([
    dealRequestRepository.findIncomingDirectRequestsByTargetCompanyId(companyId, filters),
    dealRequestRepository.countIncomingDirectRequestsByTargetCompanyId(companyId, filters),
  ]);
  const sanitized = requests.map(sanitizeRequest);
  await enrichRequests(sanitized);
  logListMetrics('getMyDirectRequests', startedAt, {
    companyId,
    total,
    returnedCount: sanitized.length,
  });

  return {
    items: sanitized,
    pagination: buildPagination({ total, limit, offset, returnedCount: sanitized.length }),
  };
};

const updateRequest = async (requestId, companyId, payload) => {
  const request = await dealRequestRepository.findById(requestId);
  if (!request) {
    throw new AppError('Request not found', 404);
  }
  if (request.applicant_company_id !== companyId) {
    throw new AppError('Unauthorized to update this request', 403);
  }
  if (!['pending', 'paused'].includes(request.status)) {
    throw new AppError(
      `Only pending or paused requests can be updated. Current status: ${request.status}`,
      400
    );
  }

  validateReplacementPayloadForRequestType(request.request_type, payload);
  const attachments = await ensureFilesForRequestPayload(payload);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updated = await dealRequestRepository.updateRequest(
      requestId,
      {
        requestDetails: inferRequestDetailsSummary(payload, {
          isDirect: request.request_type === 'direct',
        }),
        requestOffer: inferRequestOffer({
          requestType: request.request_type === 'direct' ? 'inSupply' : request.request_type,
          supplyDetails: payload.supplyDetails,
          demandDetails: payload.demandDetails,
        }),
      },
      client
    );

    if (request.request_type === 'inDemand') {
      await dealRequestDetailsRepository.upsertDemandDetails(
        client,
        requestId,
        payload.demandDetails
      );
    } else {
      await dealRequestDetailsRepository.upsertSupplyDetails(
        client,
        requestId,
        payload.supplyDetails
      );
    }

    await dealRequestDetailsRepository.replaceRequestAttachments(client, requestId, attachments);
    await client.query('COMMIT');

    logger.info('Request updated', {
      requestId,
      companyId,
      requestType: request.request_type,
    });

    const [enriched] = await enrichRequests([sanitizeRequest(updated)]);
    return enriched;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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

const sendDealEmail = async (senderCompanyId, payload) => {
  const deal = await dealRepository.findById(payload.dealId);
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }

  if (deal.company_id === senderCompanyId) {
    throw new AppError('Cannot send email to your own deal', 400);
  }

  const [senderCompany, ownerCompany] = await Promise.all([
    companyRepository.findById(senderCompanyId),
    companyRepository.findByIdWithAgentEmail(deal.company_id),
  ]);

  if (!senderCompany) {
    throw new AppError('Sender company not found', 404);
  }
  if (!ownerCompany) {
    throw new AppError('Deal owner company not found', 404);
  }
  if (!ownerCompany.agent_email) {
    throw new AppError('Deal owner agent does not have an email configured', 400);
  }

  const normalizedContactInfo = payload.contactInfo?.trim();
  const safeSubject = escapeHtml(payload.subject);
  const safeMessage = escapeHtml(payload.message);
  const safeContactInfo = normalizedContactInfo ? escapeHtml(normalizedContactInfo) : null;
  const safeSenderCompanyName = escapeHtml(senderCompany.name || `Company ${senderCompany.id}`);
  const safeDealName = escapeHtml(deal.deal_name || `Deal #${deal.id}`);

  await sendMail({
    to: ownerCompany.agent_email,
    subject: `${payload.subject} - ${deal.deal_name}`,
    text: [
      `New message about your deal "${deal.deal_name}".`,
      `From: ${senderCompany.name || `Company ${senderCompany.id}`}`,
      `Subject: ${payload.subject}`,
      '',
      payload.message,
      normalizedContactInfo ? `\nContact info: ${normalizedContactInfo}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    html: `
      <div style="margin:0;padding:24px;background:#f3f7fb;font-family:Arial,sans-serif;color:#12304a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dbe7f3;">
          <tr>
            <td style="padding:22px 24px;background:linear-gradient(135deg,#0d5fc1 0%,#12cfc8 100%);">
              <div style="font-size:28px;line-height:1;font-weight:700;color:#ffffff;letter-spacing:0.3px;">InDeal</div>
              <div style="margin-top:8px;font-size:14px;color:#eaf6ff;">New message on your deal</div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 24px 10px 24px;">
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;">
                You received a new message regarding your deal
                "<strong>${safeDealName}</strong>".
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7fbff;border:1px solid #d8e8f7;border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0 0 8px 0;font-size:14px;"><strong>From:</strong> ${safeSenderCompanyName}</p>
                    <p style="margin:0 0 8px 0;font-size:14px;"><strong>Subject:</strong> ${safeSubject}</p>
                    ${safeContactInfo ? `<p style="margin:0;font-size:14px;"><strong>Contact info:</strong> ${safeContactInfo}</p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 24px 24px;">
              <p style="margin:0 0 8px 0;font-size:14px;font-weight:700;color:#0d5fc1;">Message</p>
              <div style="padding:14px 16px;background:#ffffff;border:1px solid #d8e8f7;border-radius:10px;font-size:14px;line-height:1.7;color:#1b3e5b;">
                ${safeMessage.replaceAll('\n', '<br/>')}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px;background:#f7fbff;border-top:1px solid #dbe7f3;font-size:12px;color:#5b7793;">
              This notification was sent by InDeal.
            </td>
          </tr>
        </table>
      </div>
    `,
  });

  logger.info('Deal owner email sent', {
    dealId: payload.dealId,
    senderCompanyId,
    recipientCompanyId: ownerCompany.id,
    recipientEmail: ownerCompany.agent_email,
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
  getMyDirectRequests,
  updateRequest,
  updateRequestStatus,
  pauseRequest,
  cancelRequest,
  withdrawRequest,
  sendDealEmail,
  __testables: {
    sanitizeDeal,
    sanitizeRequest,
    inferRequestOffer,
    inferRequestDetailsSummary,
    getOpenDealLimitErrorMessage,
    ensureCanTransitionToOpen,
    escapeHtml,
  },
};
