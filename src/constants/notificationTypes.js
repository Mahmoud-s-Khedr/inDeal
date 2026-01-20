/**
 * Centralized notification type constants
 * Use these constants when creating notifications to ensure consistency
 */
const NOTIFICATION_TYPES = {
    // Company-related notifications
    COMPANY_STATUS_CHANGE: 'COMPANY_STATUS_CHANGE',

    // Profile Update Re-review (FR-ADMIN-003)
    PROFILE_UPDATE_APPROVED: 'PROFILE_UPDATE_APPROVED',
    PROFILE_UPDATE_REJECTED: 'PROFILE_UPDATE_REJECTED',
    PROFILE_UPDATE_PENDING: 'PROFILE_UPDATE_PENDING',

    // Deal-related notifications
    DEAL_REQUEST_RECEIVED: 'DEAL_REQUEST_RECEIVED',
    DEAL_REQUEST_ACCEPTED: 'DEAL_REQUEST_ACCEPTED',
    DEAL_REQUEST_REJECTED: 'DEAL_REQUEST_REJECTED',
    DEAL_UPDATE: 'DEAL_UPDATE',

    // Chat-related notifications (fallback when user offline)
    CHAT_MESSAGE: 'CHAT_MESSAGE',

    // Support ticket notifications
    SUPPORT_TICKET_REPLY: 'SUPPORT_TICKET_REPLY',

    // Support Live Chat (FR-SUP-004)
    SUPPORT_CHAT_ASSIGNED: 'SUPPORT_CHAT_ASSIGNED',
    SUPPORT_CHAT_MESSAGE: 'SUPPORT_CHAT_MESSAGE',
    SUPPORT_CHAT_CLOSED: 'SUPPORT_CHAT_CLOSED',
};

module.exports = { NOTIFICATION_TYPES };
