const express = require('express');
const protect = require('../../middlewares/authMiddleware');
const validate = require('../../middlewares/validateMiddleware');
const userController = require('../../controllers/user.controller');
const {
  updateMeSchema,
  updatePasswordSchema,
  updateProfileImageSchema,
} = require('../../validations/user.validation');

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
