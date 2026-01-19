const AppError = require('./AppError');

const validateCompanyCompleteness = (company) => {
  const missing = [];
  if (!company.name) missing.push('name');
  if (!company.phone) missing.push('phone');
  if (!company.address) missing.push('address');
  if (!company.company_type) missing.push('companyType');
  // Website marked with * in UI
  if (!company.website) missing.push('website');
  // Agent Job Title marked with * in UI (mapped from user.job_title)
  if (!company.job_title) missing.push('agentJobTitle');

  if (missing.length > 0) {
    throw new AppError(`Missing required fields for submission: ${missing.join(', ')}`, 400);
  }
};

module.exports = {
  validateCompanyCompleteness,
};
