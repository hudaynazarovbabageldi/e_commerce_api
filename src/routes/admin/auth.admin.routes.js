const express = require('express');
const router = express.Router();
const Joi = require('joi');

const authAdminController = require('../../controllers/admin/auth.admin.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const {
    validate,
    commonSchemas,
} = require('../../middlewares/Validate.middleware');
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
    authAdminController.register,
);

router.post(
    '/login',
    // authLimiter,
    validate(loginSchema),
    authAdminController.login,
);

router.post('/logout', authenticate, authAdminController.logout);

router.post(
    '/refresh',
    validate(refreshTokenSchema),
    authAdminController.refreshToken,
);

router.get('/me', authenticate, authAdminController.getProfile);

router.put(
    '/me',
    authenticate,
    validate(updateProfileSchema),
    authAdminController.updateProfile,
);

router.put(
    '/change-password',
    authenticate,
    validate(changePasswordSchema),
    authAdminController.changePassword,
);
router.post(
    '/forgot-password',
    // passwordResetLimiter,
    validate(forgotPasswordSchema),
    authAdminController.forgotPassword,
);

router.post(
    '/reset-password',
    validate(resetPasswordSchema),
    authAdminController.resetPassword,
);

router.post(
    '/verify-email',
    validate(verifyEmailSchema),
    authAdminController.verifyEmail,
);

router.post(
    '/resend-verification',
    authenticate,
    emailVerificationLimiter,
    authAdminController.resendVerification,
);

module.exports = router;
