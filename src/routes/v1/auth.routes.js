const express = require('express');
const validate = require('../../middlewares/validateMiddleware');
const authController = require('../../controllers/auth.controller');
const { registerSchema, loginSchema } = require('../../validations/auth.validation');

const router = express.Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);

module.exports = router;
