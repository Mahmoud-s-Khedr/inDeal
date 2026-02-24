const express = require('express');
const protect = require('../../middlewares/authMiddleware');
const validate = require('../../middlewares/validateMiddleware');
const userController = require('../../controllers/user.controller');
const deviceTokenController = require('../../controllers/deviceToken.controller');
const {
  updateMeSchema,
  updatePasswordSchema,
  updateProfileImageSchema,
} = require('../../validations/user.validation');
const { registerDeviceSchema } = require('../../validations/deviceToken.validation');

const router = express.Router();

router.use(protect);

router.get('/me', userController.getMe);
router.put('/me', validate(updateMeSchema), userController.updateMe);
router.put('/me/password', validate(updatePasswordSchema), userController.updatePassword);
router.put(
  '/me/profile-image',
  validate(updateProfileImageSchema),
  userController.updateProfileImage
);
router.delete('/me/profile-image', userController.deleteProfileImage);

// Device token management (Push notifications)
router.get('/me/devices', deviceTokenController.listDevices);
router.post('/me/devices', validate(registerDeviceSchema), deviceTokenController.registerDevice);
router.delete('/me/devices', deviceTokenController.unregisterDevice);

module.exports = router;
