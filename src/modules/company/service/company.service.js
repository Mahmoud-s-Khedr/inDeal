const AppError = require('../../../core/errors/AppError');
const companyRepository = require('../repository/company.repository');
const galleryRepository = require('../repository/companyGallery.repository');
const reviewRepository = require('../repository/companyReview.repository');
const companyDocumentRepository = require('../repository/companyDocument.repository');
const contributionRepository = require('../repository/companyContribution.repository');
const contributionMediaRepository = require('../repository/companyContributionMedia.repository');
const dealModule = require('../../deal');
const fileModule = require('../../file');
const config = require('../../../infrastructure/config/env');
const logger = require('../../../shared/utils/logger');
const { sendMail } = require('../../../infrastructure/config/mailer');
const { dealRequestRepository } = dealModule.repository;
const fileService = fileModule.service;

const REGISTRATION_DOC_PREFIX = 'registration:';
const isRegistrationDocType = (docType) =>
  typeof docType === 'string' && docType.startsWith(REGISTRATION_DOC_PREFIX);
const toExternalDocType = (docType) =>
  isRegistrationDocType(docType)
    ? docType.slice(REGISTRATION_DOC_PREFIX.length) || 'other'
    : docType;

const getFileUrl = async (fileId) => {
  if (!fileId) return null;
  try {
    const file = await fileService.getFileById(fileId);
    return file.publicUrl;
  } catch {
    return null;
  }
};

const sanitizeCompany = (company, logoUrl = null) => {
  if (!company) return null;

  const result = {
    id: company.id,
    agentId: company.agent_id,
    name: company.name,
    description: company.description,
    address: company.address,
    phone: company.phone,
    email: company.email,
    website: company.website,
    logoFileId: company.logo || null,
    logoUrl,
    companyType: company.company_type,
    companyIndustry: company.company_industry,
    manufacturingStrategy: company.manufacturing_strategy,
    status: company.status,
    rejectionReason: company.rejection_reason,
    contacts: company.contacts,
    locations: company.locations,
    socialMediaLinks: company.social_media_links || [],
    createdAt: company.created_at,
    updatedAt: company.updated_at,
  };

  if (company.first_name) {
    result.agent = {
      id: company.agent_id_user || company.agent_id,
      firstName: company.first_name,
      lastName: company.last_name,
      email: company.agent_email,
      jobTitle: company.job_title,
      username: company.username,
      profileImageFileId: company.profile_image || null,
      preferences: company.preferences || {},
    };
  }

  return result;
};

const sanitizeGalleryItem = (item, imageUrl = null) => ({
  id: item.id,
  companyId: item.company_id,
  imageFileId: item.image_file_id,
  imageUrl,
  description: item.description,
  uploadedAt: item.uploaded_at,
});

const sanitizeReview = (review) => ({
  id: review.id,
  companyId: review.company_id,
  reviewerCompanyId: review.reviewer_company_id,
  dealId: review.deal_id,
  reviewerCompanyName: review.reviewer_name || null,
  reviewText: review.review_text,
  rating: review.rating,
  createdAt: review.created_at,
});

const sanitizeDocument = (doc, fileUrl = null) => ({
  id: doc.id,
  companyId: doc.company_id,
  fileId: doc.file_id,
  fileUrl,
  docType: toExternalDocType(doc.doc_type),
  title: doc.title,
  issuer: doc.issuer,
  description: doc.description,
  issueDate: doc.issue_date,
  expiryDate: doc.expiry_date,
  uploadedAt: doc.uploaded_at,
});

const sanitizeContribution = (item, mediaFileUrl = null, partner = null) => ({
  id: item.id,
  companyId: item.company_id,
  mediaFileId: item.media_file_id,
  mediaFileUrl,
  mediaType: item.media_type,
  type: item.type,
  title: item.title,
  description: item.description,
  media: item.media || [],
  details: item.details,
  locations: item.details?.locations || [],
  socialMediaLinks: item.details?.socialMediaLinks || [],
  partnerId: item.details?.partnerId,
  partnerName: item.details?.partnerName,
  partnerLogoFileId: partner?.logoFileId || null,
  partnerLogoUrl: partner?.logoUrl || null,
  contributors: item.details?.contributors || [],
  tags: item.details?.tags || [],
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const sanitizeContributionMedia = (item, fileUrl = null) => ({
  id: item.id,
  contributionId: item.contributionId,
  fileId: item.fileId,
  fileUrl,
  sortOrder: item.sortOrder,
  caption: item.caption,
  createdAt: item.createdAt,
});

const buildPartnerMeta = async (contributions = []) => {
  const partnerRefMap = new Map();
  for (const contribution of contributions) {
    if (contribution.type !== 'partnership') continue;

    const partnerId = contribution.details?.partnerId;
    const partnerName = contribution.details?.partnerName;
    if (partnerId) {
      partnerRefMap.set(`id:${partnerId}`, { partnerId });
    } else if (partnerName) {
      partnerRefMap.set(`name:${partnerName.toLowerCase()}`, { partnerName });
    }
  }

  if (!partnerRefMap.size) return new Map();

  const partnerMeta = new Map();
  for (const [key, ref] of partnerRefMap.entries()) {
    let partnerCompany = null;
    if (ref.partnerId) {
      partnerCompany = await companyRepository.findById(ref.partnerId);
    } else if (ref.partnerName) {
      partnerCompany = await companyRepository.findByName(ref.partnerName);
    }

    if (!partnerCompany) continue;
    const logoUrl = await getFileUrl(partnerCompany.logo);
    partnerMeta.set(key, {
      companyId: partnerCompany.id,
      companyName: partnerCompany.name,
      logoFileId: partnerCompany.logo || null,
      logoUrl,
    });
  }

  return partnerMeta;
};

const resolvePartnerMetaForContribution = async (contribution) => {
  if (!contribution || contribution.type !== 'partnership') return null;
  if (contribution.details?.partnerId) {
    const partner = await companyRepository.findById(contribution.details.partnerId);
    if (!partner) return null;
    return {
      companyId: partner.id,
      companyName: partner.name,
      logoFileId: partner.logo || null,
      logoUrl: await getFileUrl(partner.logo),
    };
  }

  if (contribution.details?.partnerName) {
    const partner = await companyRepository.findByName(contribution.details.partnerName);
    if (!partner) return null;
    return {
      companyId: partner.id,
      companyName: partner.name,
      logoFileId: partner.logo || null,
      logoUrl: await getFileUrl(partner.logo),
    };
  }

  return null;
};

const enrichProfile = async (company, gallery = [], reviews = [], documents, contributions) => {
  const logoUrl = await getFileUrl(company.logo);
  const sanitizedCompany = sanitizeCompany(company, logoUrl);

  const sanitizedGallery = await Promise.all(
    gallery.map(async (item) => {
      const imageUrl = await getFileUrl(item.image_file_id);
      return sanitizeGalleryItem(item, imageUrl);
    })
  );

  const sanitizedReviews = reviews.map(sanitizeReview);

  const sanitizedDocuments = Array.isArray(documents)
    ? await Promise.all(
        documents.map(async (doc) => {
          const fileUrl = await getFileUrl(doc.file_id);
          return sanitizeDocument(doc, fileUrl);
        })
      )
    : undefined;

  const partnerMeta = Array.isArray(contributions)
    ? await buildPartnerMeta(contributions)
    : new Map();

  const sanitizedContributions = Array.isArray(contributions)
    ? await Promise.all(
        contributions.map(async (item) => {
          const mediaFileUrl = await getFileUrl(item.media_file_id);
          const partnerRefKey = item.details?.partnerId
            ? `id:${item.details.partnerId}`
            : item.details?.partnerName
              ? `name:${String(item.details.partnerName).toLowerCase()}`
              : null;
          const partner = partnerRefKey ? partnerMeta.get(partnerRefKey) || null : null;
          return sanitizeContribution(item, mediaFileUrl, partner);
        })
      )
    : undefined;

  const averageRating =
    sanitizedReviews.length > 0
      ? sanitizedReviews.reduce((sum, item) => sum + item.rating, 0) / sanitizedReviews.length
      : null;

  const profile = {
    company: sanitizedCompany,
    gallery: sanitizedGallery,
    reviews: sanitizedReviews,
    averageRating,
  };

  if (sanitizedDocuments !== undefined) {
    profile.documents = sanitizedDocuments;
  }

  if (sanitizedContributions !== undefined) {
    profile.contributions = sanitizedContributions;
  }

  return profile;
};

const getCompanyOrThrowByAgent = async (agentId) => {
  const company = await companyRepository.findByAgentId(agentId);
  if (!company) {
    throw new AppError('Company profile not found for this user', 404);
  }
  return company;
};

const parseCompanyId = (value) => {
  const id = Number(value);
  if (Number.isNaN(id)) {
    throw new AppError('Invalid company id', 400);
  }
  return id;
};

const getCompanyOrThrowById = async (companyId) => {
  const numericId = parseCompanyId(companyId);
  const company = await companyRepository.findById(numericId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }
  return company;
};

const resolvePartnerReferenceOrThrow = async ({ partnerId, partnerName, companyId }) => {
  if (partnerId !== undefined && partnerId !== null) {
    const numericPartnerId = Number(partnerId);
    if (!Number.isInteger(numericPartnerId) || numericPartnerId <= 0) {
      throw new AppError('Invalid partnerId', 400);
    }
    const partnerCompany = await companyRepository.findById(numericPartnerId);
    if (!partnerCompany) {
      throw new AppError('partnerId must match an existing company in the system', 400);
    }
    if (partnerCompany.id === companyId) {
      throw new AppError('partnerId cannot be your own company', 400);
    }
    return { partnerId: partnerCompany.id };
  }

  const normalizedName = partnerName?.trim();
  if (!normalizedName) {
    throw new AppError('partnerId or partnerName is required when type is partnership', 400);
  }

  const partnerCompany = await companyRepository.findByName(normalizedName);
  if (!partnerCompany) {
    throw new AppError('partnerName must match an existing company in the system', 400);
  }
  if (partnerCompany.id === companyId) {
    throw new AppError('partnerName cannot be your own company', 400);
  }

  return { partnerName: partnerCompany.name };
};

const getMyProfile = async (agentId) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const [gallery, reviews, documents, contributions] = await Promise.all([
    galleryRepository.listByCompanyId(company.id),
    reviewRepository.listByCompanyId(company.id),
    companyDocumentRepository.listByCompanyId(company.id, { scope: 'public' }),
    contributionRepository.listByCompanyId(company.id),
  ]);
  return enrichProfile(company, gallery, reviews, documents, contributions);
};

const updateMyProfile = async (agentId, payload) => {
  const dbUpdates = {
    name: payload.name,
    description: payload.description,
    address: payload.address,
    phone: payload.phone,
    email: payload.email,
    website: payload.website,
    logo: payload.logoFileId,
    company_type: payload.companyType,
    company_industry: payload.companyIndustry,
    manufacturing_strategy: payload.manufacturingStrategy,
    contacts: payload.contacts,
    locations: payload.locations,
    social_media_links: payload.socialMediaLinks
      ? JSON.stringify(payload.socialMediaLinks)
      : undefined,
  };

  const updated = await companyRepository.updateCompanyByAgent(agentId, dbUpdates);
  if (!updated) {
    throw new AppError('Company profile not found', 404);
  }
  const logoUrl = await getFileUrl(updated.logo);
  return sanitizeCompany(updated, logoUrl);
};

const getCompanyProfile = async (companyId) => {
  const { company, gallery, reviews, contributions, documents } =
    await companyRepository.findCompanyProfileById(companyId);
  return enrichProfile(company, gallery, reviews, documents, contributions);
};

const listCompanyDocuments = async (companyId) => {
  const company = await getCompanyOrThrowById(companyId);
  const docs = await companyDocumentRepository.listByCompanyId(company.id, { scope: 'public' });
  return Promise.all(
    docs.map(async (doc) => {
      const fileUrl = await getFileUrl(doc.file_id);
      return sanitizeDocument(doc, fileUrl);
    })
  );
};

const addGalleryItem = async (agentId, payload) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const item = await galleryRepository.createGalleryItem({
    companyId: company.id,
    imageFileId: payload.imageFileId,
    description: payload.description,
  });
  const imageUrl = await getFileUrl(item.image_file_id);
  return sanitizeGalleryItem(item, imageUrl);
};

const listMyGallery = async (agentId) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const items = await galleryRepository.listByCompanyId(company.id);
  return Promise.all(
    items.map(async (item) => {
      const imageUrl = await getFileUrl(item.image_file_id);
      return sanitizeGalleryItem(item, imageUrl);
    })
  );
};

const updateMyGalleryItem = async (agentId, galleryItemId, payload) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const numericId = Number(galleryItemId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new AppError('Invalid gallery item id', 400);
  }

  const existing = await galleryRepository.findById(numericId);
  if (!existing) {
    throw new AppError('Gallery item not found', 404);
  }
  if (existing.company_id !== company.id) {
    throw new AppError('You do not have access to this gallery item', 403);
  }

  const updated = await galleryRepository.updateGalleryItem(numericId, {
    image_file_id: payload.imageFileId,
    description: payload.description,
  });

  const imageUrl = await getFileUrl(updated.image_file_id);
  return sanitizeGalleryItem(updated, imageUrl);
};

const deleteMyGalleryItem = async (agentId, galleryItemId) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const numericId = Number(galleryItemId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new AppError('Invalid gallery item id', 400);
  }

  const existing = await galleryRepository.findById(numericId);
  if (!existing) {
    throw new AppError('Gallery item not found', 404);
  }
  if (existing.company_id !== company.id) {
    throw new AppError('You do not have access to this gallery item', 403);
  }

  const deleted = await galleryRepository.deleteGalleryItem(numericId);
  const imageUrl = await getFileUrl(deleted.image_file_id);
  return sanitizeGalleryItem(deleted, imageUrl);
};

const listGallery = async (companyId) => {
  const company = await getCompanyOrThrowById(companyId);
  const items = await galleryRepository.listByCompanyId(company.id);
  return Promise.all(
    items.map(async (item) => {
      const imageUrl = await getFileUrl(item.image_file_id);
      return sanitizeGalleryItem(item, imageUrl);
    })
  );
};

const listReviews = async (companyId) => {
  const company = await getCompanyOrThrowById(companyId);
  const reviews = await reviewRepository.listByCompanyId(company.id);
  return reviews.map(sanitizeReview);
};

const searchCompanies = async (filters = {}) => {
  const limit = parseInt(filters.limit, 10) || 20;
  const offset = parseInt(filters.offset, 10) || 0;
  const status = filters.status || 'active';

  const normalizedFilters = {
    keyword: filters.keyword,
    companyType: filters.companyType,
    companyIndustry: filters.companyIndustry,
    manufacturingStrategy: filters.manufacturingStrategy,
    location: filters.location,
    status,
    limit,
    offset,
  };

  const [items, total] = await Promise.all([
    companyRepository.searchCompanies(normalizedFilters),
    companyRepository.countCompanies(normalizedFilters),
  ]);

  const itemsWithLogos = await Promise.all(
    items.map(async (item) => {
      const logoUrl = await getFileUrl(item.logo);
      return sanitizeCompany(item, logoUrl);
    })
  );

  return {
    items: itemsWithLogos,
    total,
    limit,
    offset,
  };
};

const createReview = async (agentId, companyId, payload) => {
  const [targetCompany, reviewerCompany] = await Promise.all([
    getCompanyOrThrowById(companyId),
    getCompanyOrThrowByAgent(agentId),
  ]);

  if (targetCompany.id === reviewerCompany.id) {
    throw new AppError('You cannot review your own company', 400);
  }

  if (!payload.dealId) {
    throw new AppError('dealId is required to submit a review', 400);
  }

  const acceptedDeal = await dealRequestRepository.findAcceptedDealBetweenCompanies({
    dealId: payload.dealId,
    companyAId: targetCompany.id,
    companyBId: reviewerCompany.id,
  });

  if (!acceptedDeal) {
    throw new AppError('You can only review companies with accepted deals', 403);
  }

  const existingReview = await reviewRepository.findByDealAndCompanies({
    dealId: payload.dealId,
    companyId: targetCompany.id,
    reviewerCompanyId: reviewerCompany.id,
  });

  if (existingReview) {
    throw new AppError('You have already reviewed this deal', 409);
  }

  const review = await reviewRepository.createReview({
    companyId: targetCompany.id,
    reviewerCompanyId: reviewerCompany.id,
    dealId: payload.dealId,
    reviewText: payload.reviewText,
    rating: payload.rating,
  });

  return sanitizeReview({ ...review, reviewer_name: reviewerCompany.name });
};

const listMyDocuments = async (agentId) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const docs = await companyDocumentRepository.listByCompanyId(company.id, { scope: 'public' });
  return Promise.all(
    docs.map(async (doc) => {
      const fileUrl = await getFileUrl(doc.file_id);
      return sanitizeDocument(doc, fileUrl);
    })
  );
};

const listMyRegistrationDocuments = async (agentId) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const docs = await companyDocumentRepository.listByCompanyId(company.id, {
    scope: 'registration',
  });
  return Promise.all(
    docs.map(async (doc) => {
      const fileUrl = await getFileUrl(doc.file_id);
      return sanitizeDocument(doc, fileUrl);
    })
  );
};

const createMyDocument = async (agentId, payload) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const doc = await companyDocumentRepository.createDocument({
    companyId: company.id,
    fileId: payload.fileId,
    docType: payload.docType,
    title: payload.title,
    issuer: payload.issuer,
    url: payload.url,
    description: payload.description,
    issueDate: payload.issueDate,
    expiryDate: payload.expiryDate,
  });
  const fileUrl = await getFileUrl(doc.file_id);
  return sanitizeDocument(doc, fileUrl);
};

const updateMyDocument = async (agentId, documentId, payload) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const numericId = Number(documentId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new AppError('Invalid document id', 400);
  }

  const existing = await companyDocumentRepository.findById(numericId);
  if (!existing) {
    throw new AppError('Document not found', 404);
  }
  if (existing.company_id !== company.id) {
    throw new AppError('You do not have access to this document', 403);
  }
  if (isRegistrationDocType(existing.doc_type)) {
    throw new AppError('Registration form documents cannot be edited from this endpoint', 400);
  }

  const providedCertificateFields =
    payload.title !== undefined || payload.issuer !== undefined || payload.url !== undefined;
  const isExistingCertificate = toExternalDocType(existing.doc_type) === 'certificate';
  const isSettingCertificate = payload.docType === 'certificate';

  // Reject certificate metadata updates for non-certificate docs unless explicitly switching to certificate.
  if (providedCertificateFields && !isExistingCertificate && !isSettingCertificate) {
    throw new AppError('title/issuer/url are only allowed for certificate documents', 400);
  }

  // If explicitly switching to certificate, ensure the resulting record has required fields.
  if (isSettingCertificate) {
    const nextTitle = payload.title ?? existing.title;
    const nextIssuer = payload.issuer ?? existing.issuer;
    const nextFileId = payload.fileId ?? existing.file_id;
    const nextUrl = payload.url ?? existing.url;

    if (!nextTitle) {
      throw new AppError('title is required for certificate', 400);
    }
    if (!nextIssuer) {
      throw new AppError('issuer is required for certificate', 400);
    }
    if (!nextFileId && !nextUrl) {
      throw new AppError('Either fileId or url is required for certificate', 400);
    }
  }

  const updates = {
    file_id: payload.fileId,
    doc_type: payload.docType,
    title: payload.title,
    issuer: payload.issuer,
    url: payload.url,
    description: payload.description,
    issueDate: payload.issueDate,
    expiryDate: payload.expiryDate,
  };

  // If explicitly changing away from certificate, clear certificate metadata.
  if (payload.docType !== undefined && payload.docType !== 'certificate') {
    if (updates.title === undefined) updates.title = null;
    if (updates.issuer === undefined) updates.issuer = null;
    if (updates.url === undefined) updates.url = null;
  }

  const updated = await companyDocumentRepository.updateDocument(numericId, updates);
  const fileUrl = await getFileUrl(updated.file_id);
  return sanitizeDocument(updated, fileUrl);
};

const updateMyRegistrationDocument = async (agentId, registrationDocumentId, payload) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const numericId = Number(registrationDocumentId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new AppError('Invalid document id', 400);
  }

  const existing = await companyDocumentRepository.findById(numericId);
  if (!existing) {
    throw new AppError('Document not found', 404);
  }
  if (existing.company_id !== company.id) {
    throw new AppError('You do not have access to this document', 403);
  }
  if (!isRegistrationDocType(existing.doc_type)) {
    throw new AppError('Only registration form documents can be edited from this endpoint', 400);
  }

  const nextDocType =
    payload.docType === undefined
      ? existing.doc_type
      : payload.docType.startsWith(REGISTRATION_DOC_PREFIX)
        ? payload.docType
        : `${REGISTRATION_DOC_PREFIX}${payload.docType}`;

  const updates = {
    file_id: payload.fileId,
    doc_type: nextDocType,
    description: payload.description,
  };

  const updated = await companyDocumentRepository.updateDocument(numericId, updates);
  const fileUrl = await getFileUrl(updated.file_id);
  return sanitizeDocument(updated, fileUrl);
};

const deleteMyDocument = async (agentId, documentId) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const numericId = Number(documentId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new AppError('Invalid document id', 400);
  }

  const existing = await companyDocumentRepository.findById(numericId);
  if (!existing) {
    throw new AppError('Document not found', 404);
  }
  if (existing.company_id !== company.id) {
    throw new AppError('You do not have access to this document', 403);
  }
  if (isRegistrationDocType(existing.doc_type)) {
    throw new AppError('Registration form documents cannot be deleted from this endpoint', 400);
  }

  const deleted = await companyDocumentRepository.deleteDocument(numericId);
  const fileUrl = await getFileUrl(deleted.file_id);
  return sanitizeDocument(deleted, fileUrl);
};

const deleteMyRegistrationDocument = async (agentId, registrationDocumentId) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const numericId = Number(registrationDocumentId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new AppError('Invalid document id', 400);
  }

  const existing = await companyDocumentRepository.findById(numericId);
  if (!existing) {
    throw new AppError('Document not found', 404);
  }
  if (existing.company_id !== company.id) {
    throw new AppError('You do not have access to this document', 403);
  }
  if (!isRegistrationDocType(existing.doc_type)) {
    throw new AppError('Only registration form documents can be deleted from this endpoint', 400);
  }

  const deleted = await companyDocumentRepository.deleteDocument(numericId);
  const fileUrl = await getFileUrl(deleted.file_id);
  return sanitizeDocument(deleted, fileUrl);
};

const listMyContributions = async (agentId) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const items = await contributionRepository.listByCompanyId(company.id);
  return Promise.all(
    items.map(async (item) => {
      const mediaFileUrl = await getFileUrl(item.media_file_id);
      const partner = await resolvePartnerMetaForContribution(item);
      return sanitizeContribution(item, mediaFileUrl, partner);
    })
  );
};

const createMyContribution = async (agentId, payload) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  let resolvedPartner = {};
  if (payload.type === 'partnership') {
    resolvedPartner = await resolvePartnerReferenceOrThrow({
      partnerId: payload.partnerId,
      partnerName: payload.partnerName,
      companyId: company.id,
    });
  }
  // Map top-level UI fields to details JSONB
  const details = {
    ...(payload.details || {}),
  };
  if (payload.locations !== undefined) details.locations = payload.locations;
  if (payload.socialMediaLinks !== undefined) details.socialMediaLinks = payload.socialMediaLinks;
  if (resolvedPartner.partnerId !== undefined) {
    details.partnerId = resolvedPartner.partnerId;
    delete details.partnerName;
  } else if (resolvedPartner.partnerName !== undefined) {
    details.partnerName = resolvedPartner.partnerName;
    delete details.partnerId;
  }
  if (payload.contributors !== undefined) details.contributors = payload.contributors;
  if (payload.tags !== undefined) details.tags = payload.tags;

  const item = await contributionRepository.createContribution({
    companyId: company.id,
    mediaFileId: payload.mediaFileId,
    mediaType: payload.mediaType,
    mediaUrl: payload.mediaUrl,
    details,
    type: payload.type,
    title: payload.title,
    description: payload.description,
  });
  const mediaFileUrl = await getFileUrl(item.media_file_id);
  const partner = await resolvePartnerMetaForContribution(item);
  return sanitizeContribution(item, mediaFileUrl, partner);
};

const updateMyContribution = async (agentId, contributionId, payload) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const numericId = Number(contributionId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new AppError('Invalid contribution id', 400);
  }

  const existing = await contributionRepository.findById(numericId);
  if (!existing) {
    throw new AppError('Contribution not found', 404);
  }
  if (existing.company_id !== company.id) {
    throw new AppError('You do not have access to this contribution', 403);
  }

  const providedMediaType = payload.mediaType !== undefined;
  const providedMediaUrl = payload.mediaUrl !== undefined;
  const providedMediaFileId = payload.mediaFileId !== undefined;
  const existingMediaType = existing.media_type;

  if (providedMediaUrl) {
    if (providedMediaType && payload.mediaType !== 'url') {
      throw new AppError('mediaUrl is only allowed when mediaType is url', 400);
    }
    if (!providedMediaType && existingMediaType !== 'url') {
      throw new AppError('mediaUrl can only be updated for url media', 400);
    }
  }

  // If the client sends a mediaFileId without a mediaType, only allow it when
  // the existing record is already file-based (or legacy null).
  if (providedMediaFileId && !providedMediaType && existingMediaType === 'url') {
    throw new AppError('Set mediaType to image/video/file when switching away from url media', 400);
  }

  if (payload.mediaType === 'url') {
    if (!payload.mediaUrl) {
      throw new AppError('mediaUrl is required when setting mediaType to url', 400);
    }
    if (payload.mediaFileId) {
      throw new AppError('mediaFileId cannot be used when mediaType is url', 400);
    }
  }

  if (
    payload.mediaType === 'image' ||
    payload.mediaType === 'video' ||
    payload.mediaType === 'file'
  ) {
    const nextFileId = payload.mediaFileId ?? existing.media_file_id;
    if (!nextFileId) {
      throw new AppError('mediaFileId is required when setting mediaType to image/video/file', 400);
    }
  }

  // Handle details updates (merge with existing or payload.details)
  const nextType = payload.type ?? existing.type;
  let nextPartner = {
    partnerId: payload.partnerId ?? existing.details?.partnerId,
    partnerName: payload.partnerName ?? existing.details?.partnerName,
  };
  if (nextType === 'partnership') {
    nextPartner = await resolvePartnerReferenceOrThrow({
      partnerId: nextPartner.partnerId,
      partnerName: nextPartner.partnerName,
      companyId: company.id,
    });
  }

  const nextDetails = {
    ...(existing.details || {}),
    ...(payload.details || {}),
  };
  if (payload.locations !== undefined) nextDetails.locations = payload.locations;
  if (payload.socialMediaLinks !== undefined) {
    nextDetails.socialMediaLinks = payload.socialMediaLinks;
  }
  if (nextType !== 'partnership') {
    delete nextDetails.partnerName;
    delete nextDetails.partnerId;
  } else if (nextPartner.partnerId !== undefined) {
    nextDetails.partnerId = nextPartner.partnerId;
    delete nextDetails.partnerName;
  } else {
    nextDetails.partnerName = nextPartner.partnerName;
    delete nextDetails.partnerId;
  }
  if (payload.contributors !== undefined) nextDetails.contributors = payload.contributors;
  if (payload.tags !== undefined) nextDetails.tags = payload.tags;

  const contributionUpdates = {
    media_file_id: payload.mediaFileId,
    media_type: payload.mediaType,
    media_url: payload.mediaUrl,
    details: nextDetails,
    type: payload.type,
    title: payload.title,
    description: payload.description,
  };

  // If explicitly switching media type, clear incompatible fields.
  if (providedMediaType) {
    if (payload.mediaType === 'url') {
      contributionUpdates.media_file_id = null;
    } else {
      contributionUpdates.media_url = null;
    }
  }

  const updated = await contributionRepository.updateContribution(numericId, contributionUpdates);

  const mediaFileUrl = await getFileUrl(updated.media_file_id);
  const partner = await resolvePartnerMetaForContribution(updated);
  return sanitizeContribution(updated, mediaFileUrl, partner);
};

const deleteMyContribution = async (agentId, contributionId) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const numericId = Number(contributionId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new AppError('Invalid contribution id', 400);
  }

  const existing = await contributionRepository.findById(numericId);
  if (!existing) {
    throw new AppError('Contribution not found', 404);
  }
  if (existing.company_id !== company.id) {
    throw new AppError('You do not have access to this contribution', 403);
  }

  const deleted = await contributionRepository.deleteContribution(numericId);
  if (!deleted) {
    throw new AppError('Contribution not found', 404);
  }
  const mediaFileUrl = await getFileUrl(deleted.media_file_id);
  const partner = await resolvePartnerMetaForContribution(deleted);
  return sanitizeContribution(deleted, mediaFileUrl, partner);
};

// ============= Contribution Media CRUD =============

const verifyContributionOwnership = async (agentId, contributionId) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const numericId = Number(contributionId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new AppError('Invalid contribution id', 400);
  }

  const contribution = await contributionRepository.findById(numericId);
  if (!contribution) {
    throw new AppError('Contribution not found', 404);
  }
  if (contribution.company_id !== company.id) {
    throw new AppError('You do not have access to this contribution', 403);
  }
  return { company, contribution };
};

const listContributionMedia = async (agentId, contributionId) => {
  await verifyContributionOwnership(agentId, contributionId);
  const media = await contributionMediaRepository.listByContributionId(Number(contributionId));
  return Promise.all(
    media.map(async (item) => {
      const fileUrl = await getFileUrl(item.fileId);
      return sanitizeContributionMedia(item, fileUrl);
    })
  );
};

const addContributionMedia = async (agentId, contributionId, payload) => {
  await verifyContributionOwnership(agentId, contributionId);
  const media = await contributionMediaRepository.addMedia({
    contributionId: Number(contributionId),
    fileId: payload.fileId,
    mediaType: payload.mediaType,
    mediaUrl: payload.mediaUrl,
    caption: payload.caption,
    sortOrder: payload.sortOrder,
  });
  const fileUrl = await getFileUrl(media.fileId);
  return sanitizeContributionMedia(media, fileUrl);
};

const updateContributionMedia = async (agentId, contributionId, mediaId, payload) => {
  await verifyContributionOwnership(agentId, contributionId);

  const numericMediaId = Number(mediaId);
  const existing = await contributionMediaRepository.findById(numericMediaId);
  if (!existing) {
    throw new AppError('Media item not found', 404);
  }
  if (existing.contributionId !== Number(contributionId)) {
    throw new AppError('Media does not belong to this contribution', 403);
  }

  const updated = await contributionMediaRepository.updateMedia(numericMediaId, {
    file_id: payload.fileId,
    media_type: payload.mediaType,
    media_url: payload.mediaUrl,
    caption: payload.caption,
    sort_order: payload.sortOrder,
  });
  const fileUrl = await getFileUrl(updated.fileId);
  return sanitizeContributionMedia(updated, fileUrl);
};

const deleteContributionMedia = async (agentId, contributionId, mediaId) => {
  await verifyContributionOwnership(agentId, contributionId);

  const numericMediaId = Number(mediaId);
  const existing = await contributionMediaRepository.findById(numericMediaId);
  if (!existing) {
    throw new AppError('Media item not found', 404);
  }
  if (existing.contributionId !== Number(contributionId)) {
    throw new AppError('Media does not belong to this contribution', 403);
  }

  const deleted = await contributionMediaRepository.deleteMedia(numericMediaId);
  const fileUrl = await getFileUrl(deleted.fileId);
  return sanitizeContributionMedia(deleted, fileUrl);
};

const reorderContributionMedia = async (agentId, contributionId, orderedIds) => {
  await verifyContributionOwnership(agentId, contributionId);
  const media = await contributionMediaRepository.reorderMedia(Number(contributionId), orderedIds);
  return Promise.all(
    media.map(async (item) => {
      const fileUrl = await getFileUrl(item.fileId);
      return sanitizeContributionMedia(item, fileUrl);
    })
  );
};
const resendForReview = async (agentId) => {
  const company = await getCompanyOrThrowByAgent(agentId);

  const updated = await companyRepository.updateCompanyStatus(company.id, 'underReview');

  const agentEmail = company.email || company?.agent?.email;
  if (agentEmail) {
    const subject = 'Your company profile was submitted for review';
    const text = [
      'Your company profile has been submitted for review.',
      `Company ID: ${company.id}`,
      `Company Name: ${company.name}`,
    ].join('\n');

    const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #333;">Submitted for review</h2>
                <p>Your company profile has been submitted for review. We'll notify you once the status changes.</p>
                <ul>
                    <li><strong>Company ID:</strong> ${company.id}</li>
                    <li><strong>Company Name:</strong> ${company.name}</li>
                </ul>
            </div>
        `;

    try {
      await sendMail({
        to: agentEmail,
        subject,
        text,
        html,
      });
    } catch (error) {
      logger.error('Failed to send resend-for-review confirmation email to agent', {
        error,
        companyId: company.id,
        agentEmail,
      });
    }
  }

  const notificationEmail = config.companyReview?.notificationEmail;
  if (!notificationEmail) {
    logger.warn(
      'COMPANY_REVIEW_NOTIFICATION_EMAIL is missing; skipping review notification email',
      {
        companyId: company.id,
      }
    );
    return { company: sanitizeCompany(updated) };
  }

  const subject = 'Company resubmitted for review';
  const text = [
    'A company has been submitted/resubmitted for review.',
    `Company ID: ${company.id}`,
    `Company Name: ${company.name}`,
    `Agent ID: ${company.agent_id}`,
    company.email ? `Agent Email: ${company.email}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #333;">Company resubmitted for review</h2>
            <p>A company has been submitted/resubmitted for review.</p>
            <ul>
                <li><strong>Company ID:</strong> ${company.id}</li>
                <li><strong>Company Name:</strong> ${company.name}</li>
                <li><strong>Agent ID:</strong> ${company.agent_id}</li>
                ${company.email ? `<li><strong>Agent Email:</strong> ${company.email}</li>` : ''}
            </ul>
        </div>
    `;

  try {
    await sendMail({
      to: notificationEmail,
      subject,
      text,
      html,
    });
  } catch (error) {
    logger.error('Failed to send company review notification email', {
      error,
      companyId: company.id,
    });
  }

  const logoUrl = await getFileUrl(updated.logo);
  return { company: sanitizeCompany(updated, logoUrl) };
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  getCompanyProfile,
  addGalleryItem,
  listGallery,
  listReviews,
  searchCompanies,
  createReview,
  resendForReview,
  listMyGallery,
  updateMyGalleryItem,
  deleteMyGalleryItem,
  listMyDocuments,
  listMyRegistrationDocuments,
  createMyDocument,
  updateMyDocument,
  updateMyRegistrationDocument,
  deleteMyDocument,
  deleteMyRegistrationDocument,
  listMyContributions,
  createMyContribution,
  updateMyContribution,
  deleteMyContribution,
  listContributionMedia,
  addContributionMedia,
  updateContributionMedia,
  deleteContributionMedia,
  reorderContributionMedia,
  listCompanyDocuments,
  __testables: {
    sanitizeCompany,
    sanitizeGalleryItem,
    sanitizeReview,
    sanitizeDocument,
    sanitizeContribution,
    toExternalDocType,
  },
};
