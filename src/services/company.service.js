const AppError = require('../utils/AppError');
const companyRepository = require('../repositories/company.repository');
const companyAgentRepository = require('../repositories/companyAgent.repository');
const galleryRepository = require('../repositories/companyGallery.repository');
const reviewRepository = require('../repositories/companyReview.repository');
const companyDocumentRepository = require('../repositories/companyDocument.repository');
const contributionRepository = require('../repositories/companyContribution.repository');
const contributionMediaRepository = require('../repositories/companyContributionMedia.repository');
const dealRequestRepository = require('../repositories/dealRequest.repository');
const config = require('../config/env');
const logger = require('../utils/logger');
const { sendMail } = require('../config/mailer');
const notificationService = require('./notification.service');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');
const { validateCompanyCompleteness } = require('../utils/validationHelper');

const sanitizeCompany = (company) => {
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
      id: company.agent_id_user,
      firstName: company.first_name,
      lastName: company.last_name,
      email: company.agent_email,
      jobTitle: company.job_title,
      username: company.username,
    };
  }

  return result;
};

const sanitizeGalleryItem = (item) => ({
  id: item.id,
  companyId: item.company_id,
  imageFileId: item.image_file_id,
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

const sanitizeDocument = (doc) => ({
  id: doc.id,
  companyId: doc.company_id,
  fileId: doc.file_id,
  docType: doc.doc_type,
  title: doc.title,
  issuer: doc.issuer,
  url: doc.url,
  description: doc.description,
  issueDate: doc.issue_date,
  expiryDate: doc.expiry_date,
  uploadedAt: doc.uploaded_at,
});

const sanitizeContribution = (item) => ({
  id: item.id,
  companyId: item.company_id,
  mediaFileId: item.media_file_id,
  mediaType: item.media_type,
  mediaUrl: item.media_url,
  type: item.type,
  title: item.title,
  description: item.description,
  media: item.media || [],
  details: item.details,
  locations: item.details?.locations || [],
  socialMediaLinks: item.details?.socialMediaLinks || [],
  partnerName: item.details?.partnerName,
  contributors: item.details?.contributors || [],
  tags: item.details?.tags || [],
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const sanitizeContributionMedia = (item) => ({
  id: item.id,
  contributionId: item.contributionId,
  fileId: item.fileId,
  mediaType: item.mediaType,
  mediaUrl: item.mediaUrl,
  sortOrder: item.sortOrder,
  caption: item.caption,
  createdAt: item.createdAt,
});

const enrichProfile = (company, gallery = [], reviews = [], documents, contributions) => {
  const sanitizedCompany = sanitizeCompany(company);
  const sanitizedGallery = gallery.map(sanitizeGalleryItem);
  const sanitizedReviews = reviews.map(sanitizeReview);
  const sanitizedDocuments = Array.isArray(documents) ? documents.map(sanitizeDocument) : undefined;
  const sanitizedContributions = Array.isArray(contributions)
    ? contributions.map(sanitizeContribution)
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

const getMyProfile = async (agentId) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const [gallery, reviews, documents, contributions] = await Promise.all([
    galleryRepository.listByCompanyId(company.id),
    reviewRepository.listByCompanyId(company.id),
    companyDocumentRepository.listByCompanyId(company.id),
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
    company_type: payload.companyType,
    company_industry: payload.companyIndustry,
    manufacturing_strategy: payload.manufacturingStrategy,
    contacts: payload.contacts,
    locations: payload.locations,
    social_media_links: payload.socialMediaLinks,
  };

  const updated = await companyRepository.updateCompanyByAgent(agentId, dbUpdates);
  if (!updated) {
    throw new AppError('Company profile not found', 404);
  }
  return sanitizeCompany(updated);
};

const getCompanyProfile = async (companyId) => {
  const { company, gallery, reviews, contributions, documents } =
    await companyRepository.findCompanyProfileById(companyId);
  return enrichProfile(company, gallery, reviews, documents, contributions);
};

const addGalleryItem = async (agentId, payload) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const item = await galleryRepository.createGalleryItem({
    companyId: company.id,
    imageFileId: payload.imageFileId,
    description: payload.description,
  });
  return sanitizeGalleryItem(item);
};

const listMyGallery = async (agentId) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const items = await galleryRepository.listByCompanyId(company.id);
  return items.map(sanitizeGalleryItem);
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

  return sanitizeGalleryItem(updated);
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
  return sanitizeGalleryItem(deleted);
};

const listGallery = async (companyId) => {
  const company = await getCompanyOrThrowById(companyId);
  const items = await galleryRepository.listByCompanyId(company.id);
  return items.map(sanitizeGalleryItem);
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

  return {
    items: items.map(sanitizeCompany),
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
  const docs = await companyDocumentRepository.listByCompanyId(company.id);
  return docs.map(sanitizeDocument);
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
  return sanitizeDocument(doc);
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

  const providedCertificateFields =
    payload.title !== undefined || payload.issuer !== undefined || payload.url !== undefined;
  const isExistingCertificate = existing.doc_type === 'certificate';
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
  return sanitizeDocument(updated);
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

  const deleted = await companyDocumentRepository.deleteDocument(numericId);
  return sanitizeDocument(deleted);
};

const listMyContributions = async (agentId) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  const items = await contributionRepository.listByCompanyId(company.id);
  return items.map(sanitizeContribution);
};

const createMyContribution = async (agentId, payload) => {
  const company = await getCompanyOrThrowByAgent(agentId);

  // Map top-level UI fields to details JSONB
  const details = {
    ...(payload.details || {}),
  };
  if (payload.locations) details.locations = payload.locations;
  if (payload.socialMediaLinks) details.socialMediaLinks = payload.socialMediaLinks;
  if (payload.partnerName) details.partnerName = payload.partnerName;
  if (payload.contributors) details.contributors = payload.contributors;
  if (payload.tags) details.tags = payload.tags;

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
  return sanitizeContribution(item);
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
  const nextDetails = {
    ...(existing.details || {}),
    ...(payload.details || {}),
  };
  if (payload.locations) nextDetails.locations = payload.locations;
  if (payload.socialMediaLinks) nextDetails.socialMediaLinks = payload.socialMediaLinks;
  if (payload.partnerName) nextDetails.partnerName = payload.partnerName;
  if (payload.contributors) nextDetails.contributors = payload.contributors;
  if (payload.tags) nextDetails.tags = payload.tags;

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

  return sanitizeContribution(updated);
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
  return sanitizeContribution(deleted);
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
  return media.map(sanitizeContributionMedia);
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
  return sanitizeContributionMedia(media);
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
  return sanitizeContributionMedia(updated);
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
  return sanitizeContributionMedia(deleted);
};

const reorderContributionMedia = async (agentId, contributionId, orderedIds) => {
  await verifyContributionOwnership(agentId, contributionId);
  const media = await contributionMediaRepository.reorderMedia(Number(contributionId), orderedIds);
  return media.map(sanitizeContributionMedia);
};
// validateCompanyCompleteness is imported from utils/validationHelper

const resendForReview = async (agentId) => {
  const company = await getCompanyOrThrowByAgent(agentId);
  validateCompanyCompleteness(company);

  const updated = await companyRepository.updateCompanyStatus(company.id, 'underReview');

  // Send in-app notification
  await notificationService.createNotification({
    userId: agentId,
    type: NOTIFICATION_TYPES.COMPANY_STATUS_CHANGE,
    title: 'Application Submitted',
    message: 'Your company profile has been submitted for review.',
    metadata: { companyId: company.id, status: 'underReview' },
  });

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

  return { company: sanitizeCompany(updated) };
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
  createMyDocument,
  updateMyDocument,
  deleteMyDocument,
  listMyContributions,
  createMyContribution,
  updateMyContribution,
  deleteMyContribution,
  listContributionMedia,
  addContributionMedia,
  updateContributionMedia,
  deleteContributionMedia,
  reorderContributionMedia,
};
