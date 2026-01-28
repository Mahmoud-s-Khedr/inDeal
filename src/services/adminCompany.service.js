const AppError = require('../utils/AppError');
const companyRepository = require('../repositories/company.repository');
const companyDocumentRepository = require('../repositories/companyDocument.repository');
const galleryRepository = require('../repositories/companyGallery.repository');
const contributionRepository = require('../repositories/companyContribution.repository');
const reviewRepository = require('../repositories/companyReview.repository');
const userRepository = require('../repositories/user.repository');
const fileRepository = require('../repositories/file.repository');
const fileService = require('./file.service');
const { publicUrl } = require('../config/storage');
const logger = require('../utils/logger');
const { sendMail } = require('../config/mailer');

const getFileUrl = async (fileId) => {
  if (!fileId) return null;
  try {
    const file = await fileService.getFileById(fileId);
    return file.publicUrl;
  } catch (err) {
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
    agent: company.first_name
      ? {
          firstName: company.first_name,
          lastName: company.last_name,
          email: company.email,
          jobTitle: company.job_title,
          username: company.username,
        }
      : undefined,
  };
};

const sanitizeDocument = (doc, fileUrl = null) => ({
  id: doc.id,
  companyId: doc.company_id,
  fileId: doc.file_id,
  fileUrl,
  docType: doc.doc_type,
  title: doc.title,
  issuer: doc.issuer,
  description: doc.description,
  uploadedAt: doc.uploaded_at,
});

const sanitizeGalleryItem = (item, imageUrl = null) => ({
  id: item.id,
  companyId: item.company_id,
  imageFileId: item.image_file_id,
  imageUrl,
  description: item.description,
  uploadedAt: item.uploaded_at,
});

const sanitizeContribution = (item, mediaFileUrl = null) => ({
  id: item.id,
  companyId: item.company_id,
  mediaFileId: item.media_file_id,
  mediaFileUrl,
  mediaType: item.media_type,
  type: item.type,
  title: item.title,
  description: item.description,
  details: item.details,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const sanitizeReview = (review) => ({
  id: review.id,
  companyId: review.company_id,
  reviewerCompanyId: review.reviewer_company_id,
  reviewerCompanyName: review.reviewer_name || null,
  reviewText: review.review_text,
  rating: review.rating,
  createdAt: review.created_at,
});

const sanitizeUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
  };
};

const buildPublicUrl = (filePath) => {
  if (!publicUrl || !filePath) return null;
  return `${publicUrl.replace(/\/$/, '')}/${filePath}`;
};

const populateDocumentsWithFiles = async (documents) => {
  if (!documents || !documents.length) {
    return [];
  }

  return Promise.all(
    documents.map(async (doc) => {
      const fileUrl = await getFileUrl(doc.file_id);
      return sanitizeDocument(doc, fileUrl);
    })
  );
};

const listPendingCompanies = async () => {
  const pendingCompanies = await companyRepository.listByStatus('underReview');
  const documentsByCompany = await Promise.all(
    pendingCompanies.map((company) => companyDocumentRepository.listByCompanyId(company.id))
  );
  const documentsWithFiles = await Promise.all(documentsByCompany.map(populateDocumentsWithFiles));

  return pendingCompanies.map((company, index) => ({
    company: sanitizeCompany(company),
    documents: documentsWithFiles[index],
  }));
};

const parseCompanyId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('Invalid company id', 400);
  }
  return id;
};

const listAllCompanies = async () => {
  const companies = await companyRepository.listAll();
  return companies.map(sanitizeCompany);
};

const getCompanyDetail = async (companyId) => {
  const numericId = parseCompanyId(companyId);
  const company = await companyRepository.findById(numericId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const [documents, agent] = await Promise.all([
    companyDocumentRepository.listByCompanyId(numericId),
    userRepository.findById(company.agent_id),
  ]);
  const documentsWithFiles = await populateDocumentsWithFiles(documents);

  return {
    company: sanitizeCompany(company),
    documents: documentsWithFiles,
    agent: sanitizeUser(agent),
  };
};

const reviewCompanyStatus = async (companyId, status) => {
  const numericId = parseCompanyId(companyId);
  const existing = await companyRepository.findById(numericId);
  if (!existing) {
    throw new AppError('Company not found', 404);
  }

  let agent = null;

  if (status === 'active') {
    agent = await userRepository.findById(existing.agent_id);
    if (!agent) {
      throw new AppError('Associated agent not found', 400);
    }
    if (agent.status !== 'verified') {
      throw new AppError('Agent must verify their email before their company can be approved', 400);
    }
  }

  if (existing.status === status) {
    return sanitizeCompany(existing);
  }

  const updated = await companyRepository.updateCompanyStatus(numericId, status);

  // Optional: notify agent on approval/rejection.
  if ((status === 'active' || status === 'rejected') && existing.agent_id) {
    try {
      if (!agent) {
        agent = await userRepository.findById(existing.agent_id);
      }

      if (agent?.email) {
        const isApproved = status === 'active';
        const subject = isApproved
          ? 'Your company has been approved'
          : 'Your company review result';

        const text = [
          isApproved
            ? 'Good news! Your company has been approved.'
            : 'Your company review has been completed.',
          `Company ID: ${existing.id}`,
          `Company Name: ${existing.name}`,
          `New Status: ${status}`,
        ].join('\n');

        const html = `
                    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #333;">${isApproved ? 'Company approved' : 'Company status updated'}</h2>
                        <p>${
                          isApproved
                            ? 'Good news! Your company has been approved.'
                            : 'Your company review has been completed and its status was updated.'
                        }</p>
                        <ul>
                            <li><strong>Company ID:</strong> ${existing.id}</li>
                            <li><strong>Company Name:</strong> ${existing.name}</li>
                            <li><strong>New Status:</strong> ${status}</li>
                        </ul>
                    </div>
                `;

        await sendMail({
          to: agent.email,
          subject,
          text,
          html,
        });
      }
    } catch (error) {
      logger.error('Failed to send company approval/rejection email to agent', {
        error,
        companyId: existing.id,
        status,
      });
    }
  }

  return sanitizeCompany(updated);
};

const approveCompany = async (companyId) => reviewCompanyStatus(companyId, 'active');

const rejectCompany = async (companyId) => reviewCompanyStatus(companyId, 'rejected');

const changeCompanyAgent = async (companyId, agentId) => {
  const numericCompanyId = parseCompanyId(companyId);
  const numericAgentId = Number(agentId);
  if (!Number.isInteger(numericAgentId) || numericAgentId <= 0) {
    throw new AppError('Invalid agent id', 400);
  }

  const [company, agent] = await Promise.all([
    companyRepository.findById(numericCompanyId),
    userRepository.findById(numericAgentId),
  ]);

  if (!company) {
    throw new AppError('Company not found', 404);
  }

  if (!agent) {
    throw new AppError('Agent not found', 404);
  }

  const existingCompanyForAgent = await companyRepository.findByAgentId(numericAgentId);
  if (existingCompanyForAgent && existingCompanyForAgent.id !== numericCompanyId) {
    throw new AppError('Agent is already assigned to another company', 400);
  }

  const updated = await companyRepository.updateCompanyAgent(numericCompanyId, numericAgentId);
  return {
    company: sanitizeCompany(updated),
    agent: sanitizeUser(agent),
  };
};

const updateCompany = async (companyId, payload) => {
  const numericId = parseCompanyId(companyId);
  const existing = await companyRepository.findById(numericId);
  if (!existing) {
    throw new AppError('Company not found', 404);
  }

  const dbUpdates = {
    name: payload.name,
    description: payload.description,
    address: payload.address,
    phone: payload.phone,
    website: payload.website,
    company_type: payload.companyType,
    company_industry: payload.companyIndustry,
    manufacturing_strategy: payload.manufacturingStrategy,
    contacts: payload.contacts,
    locations: payload.locations,
  };

  const updated = await companyRepository.updateCompanyById(numericId, dbUpdates);
  return sanitizeCompany(updated);
};

const updateCompanySummary = async (companyId, summary) => {
  const numericId = parseCompanyId(companyId);
  const existing = await companyRepository.findById(numericId);
  if (!existing) {
    throw new AppError('Company not found', 404);
  }

  const updated = await companyRepository.updateCompanyById(numericId, {
    description: summary,
  });
  return sanitizeCompany(updated);
};

const listCompanyReviews = async (companyId) => {
  const numericId = parseCompanyId(companyId);
  const existing = await companyRepository.findById(numericId);
  if (!existing) {
    throw new AppError('Company not found', 404);
  }
  const reviews = await reviewRepository.listByCompanyId(numericId);
  return reviews.map(sanitizeReview);
};

const listCompanyGallery = async (companyId) => {
  const numericId = parseCompanyId(companyId);
  const existing = await companyRepository.findById(numericId);
  if (!existing) {
    throw new AppError('Company not found', 404);
  }
  const items = await galleryRepository.listByCompanyId(numericId);
  return Promise.all(
    items.map(async (item) => {
      const imageUrl = await getFileUrl(item.image_file_id);
      return sanitizeGalleryItem(item, imageUrl);
    })
  );
};

const createCompanyGalleryItem = async (companyId, payload) => {
  const numericId = parseCompanyId(companyId);
  const existing = await companyRepository.findById(numericId);
  if (!existing) {
    throw new AppError('Company not found', 404);
  }

  const item = await galleryRepository.createGalleryItem({
    companyId: numericId,
    imageFileId: payload.imageFileId,
    description: payload.description,
  });
  const imageUrl = await getFileUrl(item.image_file_id);
  return sanitizeGalleryItem(item, imageUrl);
};

const updateCompanyGalleryItem = async (companyId, galleryItemId, payload) => {
  const numericCompanyId = parseCompanyId(companyId);
  const numericGalleryItemId = Number(galleryItemId);
  if (!Number.isInteger(numericGalleryItemId) || numericGalleryItemId <= 0) {
    throw new AppError('Invalid gallery item id', 400);
  }

  const existingCompany = await companyRepository.findById(numericCompanyId);
  if (!existingCompany) {
    throw new AppError('Company not found', 404);
  }

  const existingItem = await galleryRepository.findById(numericGalleryItemId);
  if (!existingItem) {
    throw new AppError('Gallery item not found', 404);
  }
  if (existingItem.company_id !== numericCompanyId) {
    throw new AppError('Gallery item does not belong to this company', 400);
  }

  const updated = await galleryRepository.updateGalleryItem(numericGalleryItemId, {
    image_file_id: payload.imageFileId,
    description: payload.description,
  });

  const imageUrl = await getFileUrl(updated.image_file_id);
  return sanitizeGalleryItem(updated, imageUrl);
};

const deleteCompanyGalleryItem = async (companyId, galleryItemId) => {
  const numericCompanyId = parseCompanyId(companyId);
  const numericGalleryItemId = Number(galleryItemId);
  if (!Number.isInteger(numericGalleryItemId) || numericGalleryItemId <= 0) {
    throw new AppError('Invalid gallery item id', 400);
  }

  const existingCompany = await companyRepository.findById(numericCompanyId);
  if (!existingCompany) {
    throw new AppError('Company not found', 404);
  }

  const existingItem = await galleryRepository.findById(numericGalleryItemId);
  if (!existingItem) {
    throw new AppError('Gallery item not found', 404);
  }
  if (existingItem.company_id !== numericCompanyId) {
    throw new AppError('Gallery item does not belong to this company', 400);
  }

  const deleted = await galleryRepository.deleteGalleryItem(numericGalleryItemId);
  const imageUrl = await getFileUrl(deleted.image_file_id);
  return sanitizeGalleryItem(deleted, imageUrl);
};

const listCompanyDocuments = async (companyId) => {
  const numericId = parseCompanyId(companyId);
  const company = await companyRepository.findById(numericId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }
  const documents = await companyDocumentRepository.listByCompanyId(numericId);
  return await populateDocumentsWithFiles(documents);
};

const createCompanyDocument = async (companyId, payload) => {
  const numericId = parseCompanyId(companyId);
  const company = await companyRepository.findById(numericId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const doc = await companyDocumentRepository.createDocument({
    companyId: numericId,
    fileId: payload.fileId,
    docType: payload.docType,
    title: payload.title,
    issuer: payload.issuer,
    url: payload.url,
    description: payload.description,
  });

  const docsWithFiles = await populateDocumentsWithFiles([doc]);
  return docsWithFiles[0] || sanitizeDocument(doc);
};

const updateCompanyDocument = async (companyId, documentId, payload) => {
  const numericCompanyId = parseCompanyId(companyId);
  const numericDocumentId = Number(documentId);
  if (!Number.isInteger(numericDocumentId) || numericDocumentId <= 0) {
    throw new AppError('Invalid document id', 400);
  }

  const company = await companyRepository.findById(numericCompanyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const existingDoc = await companyDocumentRepository.findById(numericDocumentId);
  if (!existingDoc) {
    throw new AppError('Document not found', 404);
  }
  if (existingDoc.company_id !== numericCompanyId) {
    throw new AppError('Document does not belong to this company', 400);
  }

  const providedCertificateFields =
    payload.title !== undefined || payload.issuer !== undefined || payload.url !== undefined;
  const isExistingCertificate = existingDoc.doc_type === 'certificate';
  const isSettingCertificate = payload.docType === 'certificate';

  if (providedCertificateFields && !isExistingCertificate && !isSettingCertificate) {
    throw new AppError('title/issuer/url are only allowed for certificate documents', 400);
  }

  if (isSettingCertificate) {
    const nextTitle = payload.title ?? existingDoc.title;
    const nextIssuer = payload.issuer ?? existingDoc.issuer;
    const nextFileId = payload.fileId ?? existingDoc.file_id;
    const nextUrl = payload.url ?? existingDoc.url;

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
  };

  if (payload.docType !== undefined && payload.docType !== 'certificate') {
    if (updates.title === undefined) updates.title = null;
    if (updates.issuer === undefined) updates.issuer = null;
    if (updates.url === undefined) updates.url = null;
  }

  const updated = await companyDocumentRepository.updateDocument(numericDocumentId, updates);

  const docsWithFiles = await populateDocumentsWithFiles([updated]);
  return docsWithFiles[0] || sanitizeDocument(updated);
};

const deleteCompanyDocument = async (companyId, documentId) => {
  const numericCompanyId = parseCompanyId(companyId);
  const numericDocumentId = Number(documentId);
  if (!Number.isInteger(numericDocumentId) || numericDocumentId <= 0) {
    throw new AppError('Invalid document id', 400);
  }

  const company = await companyRepository.findById(numericCompanyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const existingDoc = await companyDocumentRepository.findById(numericDocumentId);
  if (!existingDoc) {
    throw new AppError('Document not found', 404);
  }
  if (existingDoc.company_id !== numericCompanyId) {
    throw new AppError('Document does not belong to this company', 400);
  }

  const deleted = await companyDocumentRepository.deleteDocument(numericDocumentId);
  return sanitizeDocument(deleted);
};

const listCompanyContributions = async (companyId) => {
  const numericId = parseCompanyId(companyId);
  const company = await companyRepository.findById(numericId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }
  const items = await contributionRepository.listByCompanyId(numericId);
  return Promise.all(
    items.map(async (item) => {
      const mediaFileUrl = await getFileUrl(item.media_file_id);
      return sanitizeContribution(item, mediaFileUrl);
    })
  );
};

const createCompanyContribution = async (companyId, payload) => {
  const numericId = parseCompanyId(companyId);
  const company = await companyRepository.findById(numericId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }
  const item = await contributionRepository.createContribution({
    companyId: numericId,
    mediaFileId: payload.mediaFileId,
    mediaType: payload.mediaType,
    mediaUrl: payload.mediaUrl,
    details: payload.details,
    type: payload.type,
    title: payload.title,
    description: payload.description,
  });
  const mediaFileUrl = await getFileUrl(item.media_file_id);
  return sanitizeContribution(item, mediaFileUrl);
};

const updateCompanyContribution = async (companyId, contributionId, payload) => {
  const numericCompanyId = parseCompanyId(companyId);
  const numericContributionId = Number(contributionId);
  if (!Number.isInteger(numericContributionId) || numericContributionId <= 0) {
    throw new AppError('Invalid contribution id', 400);
  }

  const company = await companyRepository.findById(numericCompanyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const existing = await contributionRepository.findById(numericContributionId);
  if (!existing) {
    throw new AppError('Contribution not found', 404);
  }
  if (existing.company_id !== numericCompanyId) {
    throw new AppError('Contribution does not belong to this company', 400);
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

  const contributionUpdates = {
    media_file_id: payload.mediaFileId,
    media_type: payload.mediaType,
    media_url: payload.mediaUrl,
    details: payload.details,
    type: payload.type,
    title: payload.title,
    description: payload.description,
  };

  if (providedMediaType) {
    if (payload.mediaType === 'url') {
      contributionUpdates.media_file_id = null;
    } else {
      contributionUpdates.media_url = null;
    }
  }

  const updated = await contributionRepository.updateContribution(
    numericContributionId,
    contributionUpdates
  );

  const mediaFileUrl = await getFileUrl(updated.media_file_id);
  return sanitizeContribution(updated, mediaFileUrl);
};

const deleteCompanyContribution = async (companyId, contributionId) => {
  const numericCompanyId = parseCompanyId(companyId);
  const numericContributionId = Number(contributionId);
  if (!Number.isInteger(numericContributionId) || numericContributionId <= 0) {
    throw new AppError('Invalid contribution id', 400);
  }

  const company = await companyRepository.findById(numericCompanyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const existing = await contributionRepository.findById(numericContributionId);
  if (!existing) {
    throw new AppError('Contribution not found', 404);
  }
  if (existing.company_id !== numericCompanyId) {
    throw new AppError('Contribution does not belong to this company', 400);
  }

  const deleted = await contributionRepository.deleteContribution(numericContributionId);
  const mediaFileUrl = await getFileUrl(deleted.media_file_id);
  return sanitizeContribution(deleted, mediaFileUrl);
};

module.exports = {
  listPendingCompanies,
  listAllCompanies,
  getCompanyDetail,
  reviewCompanyStatus,
  approveCompany,
  rejectCompany,
  changeCompanyAgent,
  updateCompany,
  updateCompanySummary,
  listCompanyReviews,
  listCompanyGallery,
  createCompanyGalleryItem,
  updateCompanyGalleryItem,
  deleteCompanyGalleryItem,
  listCompanyDocuments,
  createCompanyDocument,
  updateCompanyDocument,
  deleteCompanyDocument,
  listCompanyContributions,
  createCompanyContribution,
  updateCompanyContribution,
  deleteCompanyContribution,
};
