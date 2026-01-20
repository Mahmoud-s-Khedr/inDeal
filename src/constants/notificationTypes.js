/**
 * Centralized notification type constants
 * Use these constants when creating notifications to ensure consistency
 */
const NOTIFICATION_TYPES = {
    // Company-related notifications
    COMPANY_STATUS_CHANGE: 'COMPANY_STATUS_CHANGE',

    // Deal-related notifications
    DEAL_REQUEST_RECEIVED: 'DEAL_REQUEST_RECEIVED',
    DEAL_REQUEST_ACCEPTED: 'DEAL_REQUEST_ACCEPTED',
    DEAL_REQUEST_REJECTED: 'DEAL_REQUEST_REJECTED',
    DEAL_UPDATE: 'DEAL_UPDATE',

    // Chat-related notifications (fallback when user offline)
    CHAT_MESSAGE: 'CHAT_MESSAGE',

    // Support ticket notifications
    SUPPORT_TICKET_REPLY: 'SUPPORT_TICKET_REPLY',
};

module.exports = { NOTIFICATION_TYPES };
