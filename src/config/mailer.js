const { Resend } = require('resend');
const config = require('./env');
const logger = require('../utils/logger');

let resend = null;

if (config.resend.apiKey) {
    resend = new Resend(config.resend.apiKey);
    logger.info('Resend client configured');
} else {
    logger.warn('RESEND_API_KEY is missing. Emails will not be sent until configured.');
}

const sendMail = async (options) => {
    if (!resend) {
        const error = new Error('Resend client is not configured');
        error.code = 'MAILER_NOT_CONFIGURED';
        throw error;
    }

    const from = options.from || `${config.resend.fromName} <${config.resend.fromEmail}>`;
    const { data, error } = await resend.emails.send({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
    });

    if (error) {
        logger.error('Resend send failed', { error, to: options.to });
        const err = new Error('Email delivery failed');
        err.code = 'RESEND_SEND_FAILED';
        throw err;
    }

    logger.info('Email sent successfully', { id: data?.id, to: options.to });
    return { id: data?.id };
};

module.exports = {
    sendMail,
};
