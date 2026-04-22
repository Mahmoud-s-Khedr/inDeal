/**
 * Email Queue Worker
 * Processes queued emails with retry logic and tracking
 */

const { Worker } = require('bullmq');
const { connection } = require('../config/jobQueue');
const { sendMail } = require('../config/mailer');
const { renderTemplate } = require('../emailTemplate.service');
const emailLogRepository = require('../repositories.emailLog');
const logger = require('../../shared/utils/logger');

/**
 * Process email job
 * @param {Object} job - BullMQ job
 */
const processEmailJob = async (job) => {
  const { logId, to, subject, template, variables, html, text } = job.data;

  logger.debug({ jobId: job.id, logId, to, template }, 'Processing email job');

  try {
    let emailHtml = html;
    let emailText = text;

    // Render template if specified
    if (template && !html) {
      const rendered = renderTemplate(template, variables);
      emailHtml = rendered.html;
      emailText = rendered.text;
    }

    // Send the email
    const result = await sendMail({
      to,
      subject,
      html: emailHtml,
      text: emailText,
    });

    // Update log on success
    if (logId) {
      await emailLogRepository.updateLog(logId, {
        status: 'sent',
        messageId: result.id,
        sentAt: new Date(),
        attempts: job.attemptsMade + 1,
      });
    }

    logger.info(
      { jobId: job.id, logId, to, template, messageId: result.id },
      'Email sent successfully'
    );

    return { success: true, messageId: result.id };
  } catch (error) {
    logger.error({ err: error, jobId: job.id, logId, to, template }, 'Email job failed');

    // Update log on failure
    if (logId) {
      await emailLogRepository.updateLog(logId, {
        status: job.attemptsMade + 1 >= 3 ? 'failed' : 'retrying',
        error: error.message,
        attempts: job.attemptsMade + 1,
      });
    }

    throw error;
  }
};

/**
 * Start the email worker
 */
const startEmailWorker = () => {
  const worker = new Worker('email', processEmailJob, {
    connection,
    concurrency: 5, // Process 5 emails concurrently
  });

  worker.on('completed', (job, result) => {
    logger.debug({ jobId: job.id, messageId: result?.messageId }, 'Email job completed');
  });

  worker.on('failed', (job, error) => {
    logger.error({ err: error, jobId: job?.id, attempts: job?.attemptsMade }, 'Email job failed');
  });

  logger.info('Email worker started');
  return worker;
};

module.exports = {
  startEmailWorker,
  processEmailJob,
};
