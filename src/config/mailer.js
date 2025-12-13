const nodemailer = require('nodemailer');
const config = require('./env');
const logger = require('../utils/logger');

let transporter = null;

const hasSmtpConfig = config.mail.host && config.mail.port && config.mail.user && config.mail.password;

if (hasSmtpConfig) {
    transporter = nodemailer.createTransport({
        host: config.mail.host,
        port: config.mail.port,
        secure: config.mail.secure,
        auth: {
            user: config.mail.user,
            pass: config.mail.password,
        },
    });
    logger.info('SMTP transporter configured');
} else {
    logger.warn('SMTP credentials missing. Emails will not be sent until configured.');
}

const sendMail = (options) => {
    if (!transporter) {
        const error = new Error('Mail transporter is not configured');
        error.code = 'MAILER_NOT_CONFIGURED';
        throw error;
    }

    const from = options.from || `${config.mail.fromName} <${config.mail.from}>`;
    return transporter.sendMail({ ...options, from });
};

module.exports = {
    transporter,
    sendMail,
};
