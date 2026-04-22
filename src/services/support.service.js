const config = require('../config/env');

const getSupportInfo = () => {
  return {
    email: config.support?.email || 'support@indeal.com',
    phone: config.support?.phone || '+20 123 456 7890',
    hours: config.support?.hours || 'Sunday - Thursday, 9:00 AM - 5:00 PM (EET)',
    address: config.support?.address || 'Cairo, Egypt',
    responseTime: '24-48 hours',
  };
};

const getEmailSupportRedirect = () => {
  const supportEmail = config.support?.email || 'support@indeal.com';
  return {
    type: 'email_redirect',
    email: supportEmail,
    mailto: `mailto:${supportEmail}`,
  };
};

module.exports = {
  getSupportInfo,
  getEmailSupportRedirect,
};
