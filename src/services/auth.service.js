const { User } = require('../models');
const { ApiError } = require('../utils/ApiError');
const jwtUtils = require('../utils/jwt');
const encryption = require('../utils/encryption');
const logger = require('../utils/logger');
const emailService = require('./email.service');

class AuthService {
    async register(userData) {
        const { email, password, firstName, lastName, phone } = userData;

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            throw new ApiError(409, 'Email already registered');
        }

        const passwordValidation =
            encryption.validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            throw new ApiError(
                400,
                'Password does not meet requirements',
                true,
                null,
                passwordValidation.errors
            );
        }

        const user = await User.create({
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            phone,
        });

        const tokens = jwtUtils.generateTokenPair(user);
        const verificationToken = jwtUtils.generateEmailVerificationToken(
            user.id
        );

        emailService
            .sendVerificationEmail(
                user.email,
                verificationToken,
                user.firstName
            )
            .catch(err =>
                logger.logError('Failed to send verification email', {
                    error: err.message,
                })
            );

        logger.logBusinessEvent('user_registered', {
            userId: user.id,
            email: encryption.maskEmail(email),
        });

        return {
            user: user.toJSON(),
            ...tokens,
            verificationToken,
        };
    }

    async login(email, password, ipAddress) {
        const user = await User.findByEmail(email);
        if (!user) {
            logger.logAuth(email, false, ipAddress);
            throw new ApiError(401, 'Invalid email or password');
        }

        if (!user.isActive) {
            throw new ApiError(
                403,
                'Your account has been deactivated. Please contact support.'
            );
        }

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            logger.logAuth(email, false, ipAddress);
            throw new ApiError(401, 'Invalid email or password');
        }

        user.lastLoginAt = new Date();
        await user.save();

        const tokens = jwtUtils.generateTokenPair(user);
        logger.logAuth(email, true, ipAddress);

        return {
            user: user.toJSON(),
            ...tokens,
        };
    }

    async refreshToken(refreshToken) {
        if (!refreshToken) {
            throw new ApiError(400, 'Refresh token is required');
        }

        try {
            const decoded = jwtUtils.verifyToken(refreshToken, true);
            const user = await User.findByPk(decoded.userId);
            if (!user || !user.isActive) {
                throw new ApiError(401, 'Invalid refresh token');
            }

            return jwtUtils.generateTokenPair(user);
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError(401, 'Invalid or expired refresh token');
        }
    }

    async changePassword(userId, currentPassword, newPassword) {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            throw new ApiError(401, 'Current password is incorrect');
        }

        const passwordValidation =
            encryption.validatePasswordStrength(newPassword);
        if (!passwordValidation.isValid) {
            throw new ApiError(
                400,
                'New password does not meet requirements',
                true,
                null,
                passwordValidation.errors
            );
        }

        user.password = newPassword;
        await user.save();

        logger.logBusinessEvent('password_changed', {
            userId: user.id,
            email: encryption.maskEmail(user.email),
        });

        emailService
            .sendPasswordChangedEmail(user.email, user.firstName)
            .catch(err =>
                logger.logError('Failed to send password change email', {
                    error: err.message,
                })
            );
    }

    async requestPasswordReset(email) {
        const user = await User.findByEmail(email);
        if (!user) return null;

        const resetToken = jwtUtils.generatePasswordResetToken(user.id);
        user.resetPasswordToken = encryption.hashSHA256(resetToken);
        user.resetPasswordExpires = new Date(Date.now() + 3600000);
        await user.save();

        emailService
            .sendPasswordResetEmail(user.email, resetToken, user.firstName)
            .catch(err =>
                logger.logError('Failed to send password reset email', {
                    error: err.message,
                })
            );

        logger.logBusinessEvent('password_reset_requested', {
            userId: user.id,
            email: encryption.maskEmail(email),
        });

        return resetToken;
    }

    async resetPassword(token, newPassword) {
        try {
            const decoded = jwtUtils.verifySpecialToken(
                token,
                'password_reset'
            );
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

            const passwordValidation =
                encryption.validatePasswordStrength(newPassword);
            if (!passwordValidation.isValid) {
                throw new ApiError(
                    400,
                    'Password does not meet requirements',
                    true,
                    null,
                    passwordValidation.errors
                );
            }

            user.password = newPassword;
            user.resetPasswordToken = null;
            user.resetPasswordExpires = null;
            await user.save();

            logger.logBusinessEvent('password_reset_completed', {
                userId: user.id,
            });

            emailService
                .sendPasswordResetConfirmationEmail(user.email, user.firstName)
                .catch(err =>
                    logger.logError('Failed to send reset confirmation email', {
                        error: err.message,
                    })
                );
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError(400, 'Invalid or expired reset token');
        }
    }

    async verifyEmail(token) {
        try {
            const decoded = jwtUtils.verifySpecialToken(
                token,
                'email_verification'
            );
            const user = await User.findByPk(decoded.userId);
            if (!user) {
                throw new ApiError(404, 'User not found');
            }

            if (user.emailVerified) {
                throw new ApiError(400, 'Email already verified');
            }

            user.emailVerified = true;
            user.emailVerifiedAt = new Date();
            user.verificationToken = null;
            await user.save();

            logger.logBusinessEvent('email_verified', {
                userId: user.id,
                email: encryption.maskEmail(user.email),
            });

            emailService
                .sendWelcomeEmail(user.email, user.firstName)
                .catch(err =>
                    logger.logError('Failed to send welcome email', {
                        error: err.message,
                    })
                );
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError(400, 'Invalid or expired verification token');
        }
    }

    async resendVerificationEmail(userId) {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        if (user.emailVerified) {
            throw new ApiError(400, 'Email already verified');
        }

        const verificationToken = jwtUtils.generateEmailVerificationToken(
            user.id
        );

        emailService
            .sendVerificationEmail(
                user.email,
                verificationToken,
                user.firstName
            )
            .catch(err =>
                logger.logError('Failed to send verification email', {
                    error: err.message,
                })
            );

        return verificationToken;
    }
}

module.exports = new AuthService();
