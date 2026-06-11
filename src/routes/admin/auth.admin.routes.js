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

/**
 * @openapi
 * /v1/admin/auth/register:
 *   post:
 *     tags:
 *       - Admin Auth
 *     summary: Register an admin user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Admin registered successfully.
 */

router.post(
    '/register',
    // authLimiter,
    validate(registerSchema),
    authAdminController.register,
);

/**
 * @openapi
 * /v1/admin/auth/login:
 *   post:
 *     tags:
 *       - Admin Auth
 *     summary: Login admin user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful.
 */

router.post(
    '/login',
    // authLimiter,
    validate(loginSchema),
    authAdminController.login,
);

/**
 * @openapi
 * /v1/admin/auth/logout:
 *   post:
 *     tags:
 *       - Admin Auth
 *     summary: Logout current admin user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful.
 */

router.post('/logout', authenticate, authAdminController.logout);

/**
 * @openapi
 * /v1/admin/auth/refresh:
 *   post:
 *     tags:
 *       - Admin Auth
 *     summary: Refresh admin access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Token refreshed successfully.
 */

router.post(
    '/refresh',
    validate(refreshTokenSchema),
    authAdminController.refreshToken,
);

/**
 * @openapi
 * /v1/admin/auth/me:
 *   get:
 *     tags:
 *       - Admin Auth
 *     summary: Get current admin profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully.
 */

router.get('/me', authenticate, authAdminController.getProfile);

/**
 * @openapi
 * /v1/admin/auth/me:
 *   put:
 *     tags:
 *       - Admin Auth
 *     summary: Update current admin profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: Profile updated successfully.
 */

router.put(
    '/me',
    authenticate,
    validate(updateProfileSchema),
    authAdminController.updateProfile,
);

/**
 * @openapi
 * /v1/admin/auth/change-password:
 *   put:
 *     tags:
 *       - Admin Auth
 *     summary: Change current admin password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password changed successfully.
 */

router.put(
    '/change-password',
    authenticate,
    validate(changePasswordSchema),
    authAdminController.changePassword,
);

/**
 * @openapi
 * /v1/admin/auth/forgot-password:
 *   post:
 *     tags:
 *       - Admin Auth
 *     summary: Request admin password reset email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset email sent.
 */
router.post(
    '/forgot-password',
    // passwordResetLimiter,
    validate(forgotPasswordSchema),
    authAdminController.forgotPassword,
);

/**
 * @openapi
 * /v1/admin/auth/reset-password:
 *   post:
 *     tags:
 *       - Admin Auth
 *     summary: Reset admin password with token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset successfully.
 */

router.post(
    '/reset-password',
    validate(resetPasswordSchema),
    authAdminController.resetPassword,
);

/**
 * @openapi
 * /v1/admin/auth/verify-email:
 *   post:
 *     tags:
 *       - Admin Auth
 *     summary: Verify admin email by token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyEmailRequest'
 *     responses:
 *       200:
 *         description: Email verified successfully.
 */

router.post(
    '/verify-email',
    validate(verifyEmailSchema),
    authAdminController.verifyEmail,
);

/**
 * @openapi
 * /v1/admin/auth/resend-verification:
 *   post:
 *     tags:
 *       - Admin Auth
 *     summary: Resend admin verification email
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email resent.
 */

router.post(
    '/resend-verification',
    authenticate,
    // emailVerificationLimiter,
    authAdminController.resendVerification,
);

module.exports = router;
