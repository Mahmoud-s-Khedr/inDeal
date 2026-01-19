const express = require('express');
const notificationController = require('../../controllers/notification.controller');
const protect = require('../../middlewares/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', notificationController.getMyNotifications);
router.put('/read-all', notificationController.markAllAsRead);
router.put('/:id/read', notificationController.markAsRead);

module.exports = router;
