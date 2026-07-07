const mapPagination = ({ total, page, limit }) => ({
  total,
  page,
  limit,
  totalPages: total > 0 ? Math.ceil(total / limit) : 0,
});

const mapPaginated = ({ items, total, page, limit }) => ({
  items,
  pagination: mapPagination({ total, page, limit }),
});

const mapUserSummary = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
  fullName: [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.username,
  jobTitle: user.job_title,
  role: user.role,
  status: user.status,
  company: user.company_id
    ? {
        id: user.company_id,
        name: user.company_name,
        status: user.company_status,
      }
    : null,
  createdAt: user.created_at,
  updatedAt: user.updated_at,
});

const mapUserDetail = (user) => ({
  ...mapUserSummary(user),
  preferences: user.preferences || null,
  profileImageFileId: user.profile_image || null,
});

const mapCompanyListItem = (company) => ({
  id: company.id,
  name: company.name,
  description: company.description,
  companyType: company.company_type,
  companyIndustry: company.company_industry,
  manufacturingStrategy: company.manufacturing_strategy,
  status: company.status,
  rejectionReason: company.rejection_reason,
  createdAt: company.created_at,
  updatedAt: company.updated_at,
  agent: company.agent_id
    ? {
        id: company.agent_id,
        firstName: company.agent_first_name,
        lastName: company.agent_last_name,
        email: company.agent_email,
      }
    : null,
});

const mapDealListItem = (deal) => ({
  id: deal.id,
  dealName: deal.deal_name,
  dealDescription: deal.deal_description,
  dealValue: deal.deal_value,
  dealType: deal.deal_type,
  status: deal.status,
  createdAt: deal.created_at,
  updatedAt: deal.updated_at,
  company: {
    id: deal.company_id,
    name: deal.company_name,
    status: deal.company_status || null,
  },
  requestCount: Number(deal.request_count || deal.applications_count || 0),
});

const mapEmailLog = (log) => ({
  id: log.id,
  messageId: log.message_id,
  recipient: log.recipient,
  template: log.template,
  subject: log.subject,
  status: log.status,
  error: log.error,
  attempts: log.attempts || 0,
  sentAt: log.sent_at,
  createdAt: log.created_at,
});

module.exports = {
  mapPagination,
  mapPaginated,
  mapUserSummary,
  mapUserDetail,
  mapCompanyListItem,
  mapDealListItem,
  mapEmailLog,
};
