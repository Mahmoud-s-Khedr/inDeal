/**
 * Pending Update Controller
 * Admin endpoints for managing profile update requests (FR-ADMIN-003)
 */

const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const pendingUpdateService = require('../services/pendingUpdate.service');

/**
 * List all pending updates
 * GET /api/v1/admin/companies/pending-updates
 */
const listPendingUpdates = catchAsync(async (req, res) => {
    const result = await pendingUpdateService.listPendingUpdates(req.query);
    sendResponse(res, 200, result, 'Pending updates fetched');
});

/**
 * Get pending update details
 * GET /api/v1/admin/companies/pending-updates/:id
 */
const getPendingUpdate = catchAsync(async (req, res) => {
    const result = await pendingUpdateService.getPendingUpdateById(req.params.id);
    sendResponse(res, 200, result, 'Pending update fetched');
});

/**
 * Approve a pending update
 * POST /api/v1/admin/companies/pending-updates/:id/approve
 */
const approveUpdate = catchAsync(async (req, res) => {
    const result = await pendingUpdateService.approveUpdate(req.params.id, req.user.id);
    sendResponse(res, 200, result, 'Update approved');
});

/**
 * Reject a pending update
 * POST /api/v1/admin/companies/pending-updates/:id/reject
 */
const rejectUpdate = catchAsync(async (req, res) => {
    const result = await pendingUpdateService.rejectUpdate(
        req.params.id,
        req.user.id,
        req.body.reason
    );
    sendResponse(res, 200, result, 'Update rejected');
});

module.exports = {
    listPendingUpdates,
    getPendingUpdate,
    approveUpdate,
    rejectUpdate,
};
