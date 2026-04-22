const REGISTRATION_DOC_PREFIX = 'registration:';

const toRegistrationDocType = (docType) => {
  const normalized = typeof docType === 'string' && docType.trim() ? docType.trim() : 'other';
  return `${REGISTRATION_DOC_PREFIX}${normalized}`;
};

const toExternalDocType = (docType) =>
  typeof docType === 'string' && docType.startsWith(REGISTRATION_DOC_PREFIX)
    ? docType.slice(REGISTRATION_DOC_PREFIX.length) || 'other'
    : docType;

const sanitizeUser = (user) => {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    jobTitle: user.job_title,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
};

module.exports = {
  toRegistrationDocType,
  toExternalDocType,
  sanitizeUser,
};
