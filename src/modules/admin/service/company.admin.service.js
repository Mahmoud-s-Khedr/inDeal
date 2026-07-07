const AppError = require('../../../core/errors/AppError');
const config = require('../../../infrastructure/config/env');
const logger = require('../../../shared/utils/logger');
const { sendEmailSync } = require('../../../infrastructure/email.service');
const companyModule = require('../../company');
const { companyAdminRepository } = require('../repository');
const { mapPaginated, mapCompanyListItem } = require('../mappers/admin.mappers');

const { companyRepository } = companyModule.repository;
const companyService = companyModule.service;

const buildStatusEmailVariables = (company, status, rejectionReason) => ({
  companyName: company.name,
  status,
  rejectionReason: rejectionReason || null,
  isApproved: status === 'active',
  isRejected: status === 'rejected',
  isOther: !['active', 'rejected'].includes(status),
  frontendUrl: config.forgotPassword.frontendUrl.replace(/\/$/, ''),
});

const sendCompanyStatusEmail = async (company, status, rejectionReason) => {
  if (!company?.agent_email) return;

  try {
    await sendEmailSync({
      to: company.agent_email,
      subject: `Your company status is now ${status}`,
      template: 'companyStatusChange',
      variables: buildStatusEmailVariables(company, status, rejectionReason),
    });
  } catch (error) {
    logger.error(
      { err: error, companyId: company.id, status },
      'Failed to send company status email'
    );
    if (config.app.env === 'production') {
      throw new AppError('Company status updated, but notification email failed', 502);
    }
  }
};

const listCompanies = async (query) => {
  const page = query.page;
  const limit = query.limit;
  const offset = (page - 1) * limit;

  const [items, total] = await Promise.all([
    companyAdminRepository.listCompanies({ ...query, limit, offset }),
    companyAdminRepository.countCompanies(query),
  ]);

  return mapPaginated({
    items: items.map(mapCompanyListItem),
    total,
    page,
    limit,
  });
};

const getCompanyById = async (companyId) => {
  return companyService.getCompanyProfile(companyId);
};

const updateCompanyStatus = async (companyId, payload) => {
  const company = await companyRepository.findByIdWithAgentEmail(companyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const rejectionReason = payload.status === 'rejected' ? payload.rejectionReason : null;
  await companyRepository.updateCompanyStatus(companyId, payload.status, rejectionReason);
  await sendCompanyStatusEmail(company, payload.status, rejectionReason);

  return getCompanyById(companyId);
};

module.exports = {
  listCompanies,
  getCompanyById,
  updateCompanyStatus,
};
