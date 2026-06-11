const express = require('express');
const router = express.Router();
const Joi = require('joi');

const authController = require('../../controllers/client/auth.controller');
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
 * /v1/auth/register:
 *   post:
 *     tags:
 *       - Client Auth
 *     summary: Register a client user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully.
 */

router.post(
    '/register',
    // authLimiter,
    validate(registerSchema),
    authController.register,
);

/**
 * @openapi
 * /v1/auth/login:
 *   post:
 *     tags:
 *       - Client Auth
 *     summary: Login client user
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
router.post('/login', authLimiter, validate(loginSchema), authController.login);

/**
 * @openapi
 * /v1/auth/logout:
 *   post:
 *     tags:
 *       - Client Auth
 *     summary: Logout current client user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful.
 */

router.post('/logout', authenticate, authController.logout);

/**
 * @openapi
 * /v1/auth/refresh:
 *   post:
 *     tags:
 *       - Client Auth
 *     summary: Refresh access token
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
    authController.refreshToken,
);

/**
 * @openapi
 * /v1/auth/me:
 *   get:
 *     tags:
 *       - Client Auth
 *     summary: Get current client profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully.
 */

router.get('/me', authenticate, authController.getProfile);

/**
 * @openapi
 * /v1/auth/me:
 *   put:
 *     tags:
 *       - Client Auth
 *     summary: Update current client profile
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
    authController.updateProfile,
);

/**
 * @openapi
 * /v1/auth/change-password:
 *   put:
 *     tags:
 *       - Client Auth
 *     summary: Change current client password
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
    authController.changePassword,
);

/**
 * @openapi
 * /v1/auth/forgot-password:
 *   post:
 *     tags:
 *       - Client Auth
 *     summary: Request password reset email
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
    passwordResetLimiter,
    validate(forgotPasswordSchema),
    authController.forgotPassword,
);

/**
 * @openapi
 * /v1/auth/reset-password:
 *   post:
 *     tags:
 *       - Client Auth
 *     summary: Reset password with reset token
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
    authController.resetPassword,
);

/**
 * @openapi
 * /v1/auth/verify-email:
 *   post:
 *     tags:
 *       - Client Auth
 *     summary: Verify email by token
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
    authController.verifyEmail,
);

/**
 * @openapi
 * /v1/auth/resend-verification:
 *   post:
 *     tags:
 *       - Client Auth
 *     summary: Resend verification email
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email resent.
 */

router.post(
    '/resend-verification',
    authenticate,
    emailVerificationLimiter,
    authController.resendVerification,
);

module.exports = router;
