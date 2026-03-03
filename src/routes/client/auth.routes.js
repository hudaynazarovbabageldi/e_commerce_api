const express = require('express');
const router = express.Router();
const Joi = require('joi');

const authController = require('../../controllers/client/auth.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const {
    validate,
    commonSchemas,
} = require('../../middlewares/validate.middleware');
const {
    authLimiter,
    passwordResetLimiter,
    emailVerificationLimiter,
} = require('../../middlewares/rateLimiter.middleware');

const registerSchema = {
    body: Joi.object({
        email: commonSchemas.email,
        password: commonSchemas.password,
        firstName: Joi.string().min(2).max(50).required(),
        lastName: Joi.string().min(2).max(50).required(),
        phone: commonSchemas.phone.optional(),
    }),
};

const loginSchema = {
    body: Joi.object({
        email: commonSchemas.email,
        password: Joi.string().required(),
    }),
};

const refreshTokenSchema = {
    body: Joi.object({
        refreshToken: Joi.string().required(),
    }),
};

const updateProfileSchema = {
    body: Joi.object({
        firstName: Joi.string().min(2).max(50),
        lastName: Joi.string().min(2).max(50),
        phone: commonSchemas.phone,
        dateOfBirth: Joi.date().iso().max('now'),
        avatar: commonSchemas.url,
    }).min(1),
};

const changePasswordSchema = {
    body: Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: commonSchemas.password,
    }),
};

const forgotPasswordSchema = {
    body: Joi.object({
        email: commonSchemas.email,
    }),
};

const resetPasswordSchema = {
    body: Joi.object({
        token: Joi.string().required(),
        newPassword: commonSchemas.password,
    }),
};

const verifyEmailSchema = {
    body: Joi.object({
        token: Joi.string().required(),
    }),
};

router.post(
    '/register',
    // authLimiter,
    validate(registerSchema),
    authController.register,
);
router.post('/login', authLimiter, validate(loginSchema), authController.login);

router.post('/logout', authenticate, authController.logout);

router.post(
    '/refresh',
    validate(refreshTokenSchema),
    authController.refreshToken,
);

router.get('/me', authenticate, authController.getProfile);

router.put(
    '/me',
    authenticate,
    validate(updateProfileSchema),
    authController.updateProfile,
);

router.put(
    '/change-password',
    authenticate,
    validate(changePasswordSchema),
    authController.changePassword,
);
router.post(
    '/forgot-password',
    passwordResetLimiter,
    validate(forgotPasswordSchema),
    authController.forgotPassword,
);

router.post(
    '/reset-password',
    validate(resetPasswordSchema),
    authController.resetPassword,
);

router.post(
    '/verify-email',
    validate(verifyEmailSchema),
    authController.verifyEmail,
);

router.post(
    '/resend-verification',
    authenticate,
    emailVerificationLimiter,
    authController.resendVerification,
);

module.exports = router;
