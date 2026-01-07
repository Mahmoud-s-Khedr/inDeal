/**
 * Resend Email Service Configuration
 * Transactional email with enhanced logging
 */

const { Resend } = require('resend');
const config = require('./env');
const { createServiceLogger } = require('./pino');

// Create service-specific logger
const log = createServiceLogger('resend');

let resend = null;

if (config.resend.apiKey) {
    resend = new Resend(config.resend.apiKey);
    log.info({ fromEmail: config.resend.fromEmail }, 'Resend client configured');
} else {
    log.warn('RESEND_API_KEY is missing. Emails will not be sent until configured.');
}

/**
 * Send an email via Resend
 * @param {Object} options - Email options
 * @param {string|string[]} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} [options.html] - HTML content
 * @param {string} [options.text] - Plain text content
 * @param {string} [options.from] - Sender (uses default if not provided)
 * @param {string} [options.replyTo] - Reply-to address
 * @returns {Promise<Object>} Send result with message ID
 */
const sendMail = async (options) => {
    if (!resend) {
        const error = new Error('Resend client is not configured');
        error.code = 'MAILER_NOT_CONFIGURED';
        log.error({ operation: 'send', to: options.to }, 'Attempted to send email without configured client');
        throw error;
    }

    const start = Date.now();
    const from = options.from || `${config.resend.fromName} <${config.resend.fromEmail}>`;
    const toAddresses = Array.isArray(options.to) ? options.to : [options.to];

    try {
        const { data, error } = await resend.emails.send({
            from,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
            replyTo: options.replyTo,
        });

        const duration = Date.now() - start;

        if (error) {
            log.error(
                {
                    operation: 'send',
                    to: toAddresses,
                    subject: options.subject?.substring(0, 50),
                    error,
                    durationMs: duration,
                },
                'Resend send failed'
            );
            const err = new Error('Email delivery failed');
            err.code = 'RESEND_SEND_FAILED';
            err.details = error;
            throw err;
        }

        log.info(
            {
                operation: 'send',
                messageId: data?.id,
                to: toAddresses,
                subject: options.subject?.substring(0, 50),
                durationMs: duration,
            },
            'Email sent successfully'
        );

        return { id: data?.id };
    } catch (err) {
        // Re-throw if already logged
        if (err.code === 'RESEND_SEND_FAILED') throw err;

        const duration = Date.now() - start;
        log.error(
            {
                err,
                operation: 'send',
                to: toAddresses,
                subject: options.subject?.substring(0, 50),
                durationMs: duration,
            },
            'Resend send threw exception'
        );
        throw err;
    }
};

/**
 * Send a batch of emails
 * @param {Object[]} emails - Array of email options
 * @returns {Promise<Object[]>} Array of send results
 */
const sendBatch = async (emails) => {
    if (!resend) {
        log.error({ operation: 'batch' }, 'Attempted batch send without configured client');
        throw new Error('Resend client is not configured');
    }

    const start = Date.now();

    try {
        const results = await Promise.allSettled(
            emails.map((email) => sendMail(email))
        );

        const duration = Date.now() - start;
        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        const failureCount = results.filter((r) => r.status === 'rejected').length;

        log.info(
            {
                operation: 'batch',
                totalEmails: emails.length,
                successCount,
                failureCount,
                durationMs: duration,
            },
            'Batch email send completed'
        );

        return results;
    } catch (err) {
        const duration = Date.now() - start;
        log.error(
            { err, operation: 'batch', emailCount: emails.length, durationMs: duration },
            'Batch email send failed'
        );
        throw err;
    }
};

module.exports = {
    sendMail,
    sendBatch,
};
