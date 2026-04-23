const AppError = require('../../../core/errors/AppError');
const companyModule = require('../../company');

const { companyRepository } = companyModule.repository;

const sanitizeReviewRequest = (company) => ({
  id: company.id,
  agentId: company.agent_id,
  name: company.name,
  description: company.description,
  address: company.address,
  phone: company.phone,
  email: company.email,
  website: company.website,
  companyType: company.company_type,
  companyIndustry: company.company_industry,
  manufacturingStrategy: company.manufacturing_strategy,
  status: company.status,
  rejectionReason: company.rejection_reason,
  contacts: company.contacts,
  locations: company.locations,
  createdAt: company.created_at,
  updatedAt: company.updated_at,
  agent: {
    firstName: company.first_name || null,
    lastName: company.last_name || null,
    email: company.email || null,
    jobTitle: company.job_title || null,
    username: company.username || null,
  },
});

const listCompanyReviewRequests = async () => {
  const companies = await companyRepository.listByStatus('underReview');
  return companies.map(sanitizeReviewRequest);
};

const getCompanyReviewRequest = async (companyId) => {
  const company = await companyRepository.findCompanyProfileById(companyId);
  if (!company || !company.company) {
    throw new AppError('Company not found', 404);
  }

  return {
    company: sanitizeReviewRequest(company.company),
    gallery: company.gallery || [],
    reviews: company.reviews || [],
    documents: company.documents || [],
    contributions: company.contributions || [],
  };
};

const updateCompanyReviewRequest = async (companyId, { action, reason }) => {
  const existing = await companyRepository.findById(companyId);
  if (!existing) {
    throw new AppError('Company not found', 404);
  }

  const normalizedAction = String(action || '').toLowerCase();
  if (!['approve', 'reject'].includes(normalizedAction)) {
    throw new AppError('action must be approve or reject', 400);
  }

  const nextStatus = normalizedAction === 'approve' ? 'active' : 'rejected';
  const rejectionReason = normalizedAction === 'reject' ? reason || null : null;
  const updated = await companyRepository.updateCompanyStatus(
    companyId,
    nextStatus,
    rejectionReason
  );

  return {
    company: sanitizeReviewRequest(updated),
    action: normalizedAction,
  };
};

module.exports = {
  listCompanyReviewRequests,
  getCompanyReviewRequest,
  updateCompanyReviewRequest,
};
