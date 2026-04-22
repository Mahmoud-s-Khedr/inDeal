const express = require('express');
const protect = require('../../../core/middleware/authMiddleware');
const validate = require('../../../core/middleware/validateMiddleware');
const userController = require('../controller/user.controller');
const {
  updateMeSchema,
  updatePasswordSchema,
  updateProfileImageSchema,
} = require('../validation/user.validation');

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

module.exports = router;
