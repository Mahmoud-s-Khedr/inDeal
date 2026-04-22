/**
 * Email Service
 * High-level email sending with templates and queue integration
 */

const { enqueueEmail } = require('./config/jobQueue');
const { renderTemplate } = require('./emailTemplate.service');
const emailLogRepository = require('./repositories.emailLog');
const { sendMail } = require('./config/mailer');
const logger = require('../shared/utils/logger');

/**
 * Send an email asynchronously via queue with tracking
 * Use this for non-critical emails that can be retried
 *
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Template name (e.g., 'passwordReset')
 * @param {Object} [options.variables] - Template variables
 * @returns {Promise<{logId: number, jobId: string}>}
 */
const sendEmailAsync = async (options) => {
  const { to, subject, template, variables } = options;
  const recipient = Array.isArray(to) ? to[0] : to;

  // Create tracking log
  const log = await emailLogRepository.createLog({
    recipient,
    template,
    subject,
    status: 'queued',
  });

  // Enqueue the email job
  const { jobId } = await enqueueEmail({
    to,
    subject,
    template,
    variables,
    logId: log.id,
  });

  logger.debug({ logId: log.id, jobId, to, template }, 'Email queued for async sending');

  return { logId: log.id, jobId };
};

/**
 * Send an email synchronously (immediately)
 * Use this for critical emails that must be sent immediately (e.g., OTP)
 *
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Template name
 * @param {Object} [options.variables] - Template variables
 * @returns {Promise<{id: string}>}
 */
const sendEmailSync = async (options) => {
  const { to, subject, template, variables } = options;
  const recipient = Array.isArray(to) ? to[0] : to;

  // Render template
  const { html, text } = renderTemplate(template, variables);

  // Create tracking log
  const log = await emailLogRepository.createLog({
    recipient,
    template,
    subject,
    status: 'sending',
  });

  try {
    // Send immediately
    const result = await sendMail({
      to,
      subject,
      html,
      text,
    });

    // Update log on success
    await emailLogRepository.updateLog(log.id, {
      status: 'sent',
      messageId: result.id,
      sentAt: new Date(),
      attempts: 1,
    });

    logger.info({ logId: log.id, to, template, messageId: result.id }, 'Email sent synchronously');

    return { id: result.id, logId: log.id };
  } catch (error) {
    // Update log on failure
    await emailLogRepository.updateLog(log.id, {
      status: 'failed',
      error: error.message,
      attempts: 1,
    });

    logger.error({ err: error, logId: log.id, to, template }, 'Sync email send failed');
    throw error;
  }
};

/**
 * Get email sending statistics
 * @returns {Promise<Object>}
 */
const getEmailStats = async () => {
  return emailLogRepository.getStats();
};

module.exports = {
  sendEmailAsync,
  sendEmailSync,
  getEmailStats,
};
