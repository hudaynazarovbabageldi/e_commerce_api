const { User } = require('../../models/index.js');
const { ApiError } = require('../../utils/ApiError');
const { ApiResponse } = require('../../utils/ApiResponse');
const { asyncHandler } = require('../../utils/asyncHandler');
const jwtUtils = require('../../utils/jwt');
const encryption = require('../../utils/encryption');
const logger = require('../../utils/logger');

const register = asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, phone } = req.body;

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
        throw new ApiError(409, 'Email already registered');
    }

    console.log('existingUser: ', existingUser);
    // Validate password strength
    const passwordValidation = encryption.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
        throw new ApiError(
            400,
            'Password does not meet requirements',
            true,
            null,
            passwordValidation.errors,
        );
    }

    // Create user (password will be hashed by model hook)
    const user = await User.create({
        email: email.toLowerCase(),
        password,
        firstName,
        lastName,
        phone,
        role: 'admin',
    });

    console.log('user object when created: ', user);

    const tokens = jwtUtils.generateTokenPair(user);

    // Generate email verification token
    const verificationToken = jwtUtils.generateEmailVerificationToken(user.id);

    // TODO: Send verification email
    // await emailService.sendVerificationEmail(user.email, verificationToken);

    logger.logBusinessEvent('user_registered', {
        userId: user.id,
        email: encryption.maskEmail(email),
    });

    res.status(201).json(
        new ApiResponse(
            201,
            {
                user: user.toJSON(),
                ...tokens,
                verificationToken,
            },
            'Registration successful',
        ),
    );
});

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
        logger.logAuth(email, false, req.ip);
        throw new ApiError(401, 'Invalid email or password');
    }

    if (!user.isActive) {
        throw new ApiError(
            403,
            'Your account has been deactivated. Please contact support.',
        );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
        logger.logAuth(email, false, req.ip);
        throw new ApiError(401, 'Invalid email or password');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate tokens
    const tokens = jwtUtils.generateTokenPair(user);

    logger.logAuth(email, true, req.ip);

    res.json(
        new ApiResponse(
            200,
            {
                user: user.toJSON(),
                ...tokens,
            },
            'Login successful',
        ),
    );
});

/**
 * Logout user
 * @route POST /api/admin/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
    // In a more sophisticated setup, you might:
    // 1. Blacklist the token
    // 2. Clear refresh token from database
    // 3. Clear any sessions

    logger.logInfo('User logged out', {
        userId: req.user.id,
        email: req.user.email,
    });

    res.json(new ApiResponse(200, null, 'Logout successful'));
});

/**
 * Refresh access token
 * @route POST /api/auth/refresh
 */
const refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        throw new ApiError(400, 'Refresh token is required');
    }

    try {
        // Verify refresh token
        const decoded = jwtUtils.verifyToken(refreshToken, true);

        // Find user
        const user = await User.findByPk(decoded.userId);
        if (!user || !user.isActive) {
            throw new ApiError(401, 'Invalid refresh token');
        }

        // Generate new tokens
        const tokens = jwtUtils.generateTokenPair(user);

        res.json(new ApiResponse(200, tokens, 'Token refreshed successfully'));
    } catch (error) {
        throw new ApiError(401, 'Invalid or expired refresh token');
    }
});

/**
 * Get current user profile
 * @route GET /api/auth/me
 */
const getProfile = asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['password'] },
    });

    res.json(new ApiResponse(200, user, 'Profile retrieved successfully'));
});

/**
 * Update current user profile
 * @route PUT /api/auth/me
 */
const updateProfile = asyncHandler(async (req, res) => {
    const { firstName, lastName, phone, dateOfBirth, avatar } = req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Update allowed fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (avatar) user.avatar = avatar;

    await user.save();

    res.json(
        new ApiResponse(200, user.toJSON(), 'Profile updated successfully'),
    );
});

/**
 * Change password
 * @route PUT /api/auth/change-password
 */
const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
        throw new ApiError(401, 'Current password is incorrect');
    }

    // Validate new password strength
    const passwordValidation = encryption.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
        throw new ApiError(
            400,
            'New password does not meet requirements',
            true,
            null,
            passwordValidation.errors,
        );
    }

    // Update password (will be hashed by model hook)
    user.password = newPassword;
    await user.save();

    logger.logBusinessEvent('password_changed', {
        userId: user.id,
        email: encryption.maskEmail(user.email),
    });

    res.json(new ApiResponse(200, null, 'Password changed successfully'));
});

/**
 * Request password reset
 * @route POST /api/auth/forgot-password
 */
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
        res.json(
            new ApiResponse(
                200,
                null,
                'If the email exists, a reset link will be sent',
            ),
        );
        return;
    }

    // Generate reset token
    const resetToken = jwtUtils.generatePasswordResetToken(user.id);

    // Save token to database
    user.resetPasswordToken = encryption.hashSHA256(resetToken);
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // TODO: Send reset email
    // await emailService.sendPasswordResetEmail(user.email, resetToken);

    logger.logBusinessEvent('password_reset_requested', {
        userId: user.id,
        email: encryption.maskEmail(email),
    });

    res.json(
        new ApiResponse(
            200,
            { resetToken },
            'If the email exists, a reset link will be sent',
        ),
    );
});

/**
 * Reset password with token
 * @route POST /api/auth/reset-password
 */
const resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        // Verify token
        const decoded = jwtUtils.verifySpecialToken(token, 'password_reset');

        // Find user
        const hashedToken = encryption.hashSHA256(token);
        const user = await User.findOne({
            where: {
                id: decoded.userId,
                resetPasswordToken: hashedToken,
            },
        });

        if (
            !user ||
            !user.resetPasswordExpires ||
            user.resetPasswordExpires < new Date()
        ) {
            throw new ApiError(400, 'Invalid or expired reset token');
        }

        // Validate new password
        const passwordValidation =
            encryption.validatePasswordStrength(newPassword);
        if (!passwordValidation.isValid) {
            throw new ApiError(
                400,
                'Password does not meet requirements',
                true,
                null,
                passwordValidation.errors,
            );
        }

        // Update password
        user.password = newPassword;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        logger.logBusinessEvent('password_reset_completed', {
            userId: user.id,
        });

        res.json(new ApiResponse(200, null, 'Password reset successful'));
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(400, 'Invalid or expired reset token');
    }
});

/**
 * Verify email
 * @route POST /api/auth/verify-email
 */
const verifyEmail = asyncHandler(async (req, res) => {
    const { token } = req.body;

    try {
        // Verify token
        const decoded = jwtUtils.verifySpecialToken(
            token,
            'email_verification',
        );

        // Find user
        const user = await User.findByPk(decoded.userId);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        if (user.emailVerified) {
            throw new ApiError(400, 'Email already verified');
        }

        // Mark email as verified
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
        user.verificationToken = null;
        await user.save();

        logger.logBusinessEvent('email_verified', {
            userId: user.id,
            email: encryption.maskEmail(user.email),
        });

        res.json(new ApiResponse(200, null, 'Email verified successfully'));
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(400, 'Invalid or expired verification token');
    }
});

/**
 * Resend verification email
 * @route POST /api/auth/resend-verification
 */
const resendVerification = asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.id);

    if (user.emailVerified) {
        throw new ApiError(400, 'Email already verified');
    }

    // Generate new verification token
    const verificationToken = jwtUtils.generateEmailVerificationToken(user.id);

    // TODO: Send verification email
    // await emailService.sendVerificationEmail(user.email, verificationToken);

    res.json(
        new ApiResponse(200, { verificationToken }, 'Verification email sent'),
    );
});

module.exports = {
    register,
    login,
    logout,
    refreshToken,
    getProfile,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification,
};
