const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { ApiError } = require('./ApiError');

/**
 * Generate JWT access token
 * @param {Object} payload - Token payload (usually user data)
 * @param {String} expiresIn - Token expiration time
 * @returns {String} JWT token
 */
const generateAccessToken = (
    payload,
    expiresIn = config.jwt.accessExpiresIn || '15m',
) => {
    try {
        return jwt.sign(payload, config.jwt.secret, {
            expiresIn,
            issuer: config.jwt.issuer || 'ecommerce-api',
            audience: config.jwt.audience || 'ecommerce-users',
        });
    } catch (error) {
        throw new ApiError(500, 'Failed to generate access token');
    }
};

/**
 * Generate JWT refresh token
 * @param {Object} payload - Token payload
 * @param {String} expiresIn - Token expiration time
 * @returns {String} JWT refresh token
 */
const generateRefreshToken = (
    payload,
    expiresIn = config.jwt.refreshExpiresIn || '7d',
) => {
    try {
        return jwt.sign(
            payload,
            config.jwt.refreshSecret || config.jwt.secret,
            {
                expiresIn,
                issuer: config.jwt.issuer || 'ecommerce-api',
                audience: config.jwt.audience || 'ecommerce-users',
            },
        );
    } catch (error) {
        throw new ApiError(500, 'Failed to generate refresh token');
    }
};

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} Object containing access and refresh tokens
 */
const generateTokenPair = (user) => {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken({ userId: user.id });

    return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: config.jwt.accessExpiresIn || '1d',
    };
};

/**
 * Verify JWT token
 * @param {String} token - JWT token to verify
 * @param {Boolean} isRefreshToken - Whether verifying refresh token
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token, isRefreshToken = false) => {
    try {
        const secret = isRefreshToken
            ? config.jwt.refreshSecret || config.jwt.secret
            : config.jwt.secret;

        return jwt.verify(token, secret, {
            issuer: config.jwt.issuer || 'ecommerce-api',
            audience: config.jwt.audience || 'ecommerce-users',
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new ApiError(401, 'Token has expired');
        }
        if (error.name === 'JsonWebTokenError') {
            throw new ApiError(401, 'Invalid token');
        }
        throw new ApiError(401, 'Token verification failed');
    }
};

/**
 * Decode JWT token without verification
 * @param {String} token - JWT token to decode
 * @returns {Object} Decoded token payload
 */
const decodeToken = (token) => {
    try {
        return jwt.decode(token);
    } catch (error) {
        throw new ApiError(400, 'Failed to decode token');
    }
};

/**
 * Extract token from Authorization header
 * @param {String} authHeader - Authorization header value
 * @returns {String|null} Extracted token or null
 */
const extractTokenFromHeader = (authHeader) => {
    if (!authHeader) {
        return null;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }

    return parts[1];
};

/**
 * Generate email verification token
 * @param {String} userId - User ID
 * @returns {String} Verification token
 */
const generateEmailVerificationToken = (userId) => {
    return jwt.sign({ userId, type: 'email_verification' }, config.jwt.secret, {
        expiresIn: '24h',
    });
};

/**
 * Generate password reset token
 * @param {String} userId - User ID
 * @returns {String} Reset token
 */
const generatePasswordResetToken = (userId) => {
    return jwt.sign({ userId, type: 'password_reset' }, config.jwt.secret, {
        expiresIn: '1h',
    });
};

/**
 * Verify special purpose token (email verification, password reset)
 * @param {String} token - Token to verify
 * @param {String} expectedType - Expected token type
 * @returns {Object} Decoded token payload
 */
const verifySpecialToken = (token, expectedType) => {
    try {
        const decoded = jwt.verify(token, config.jwt.secret);

        if (decoded.type !== expectedType) {
            throw new ApiError(400, 'Invalid token type');
        }

        return decoded;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        if (error.name === 'TokenExpiredError') {
            throw new ApiError(401, 'Token has expired');
        }
        throw new ApiError(401, 'Invalid token');
    }
};

/**
 * Check if token is expired
 * @param {String} token - JWT token
 * @returns {Boolean} True if expired
 */
const isTokenExpired = (token) => {
    try {
        const decoded = decodeToken(token);
        if (!decoded.exp) {
            return false;
        }
        return Date.now() >= decoded.exp * 1000;
    } catch (error) {
        return true;
    }
};

/**
 * Get token expiration time
 * @param {String} token - JWT token
 * @returns {Date|null} Expiration date or null
 */
const getTokenExpiration = (token) => {
    try {
        const decoded = decodeToken(token);
        if (!decoded.exp) {
            return null;
        }
        return new Date(decoded.exp * 1000);
    } catch (error) {
        return null;
    }
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    generateTokenPair,
    verifyToken,
    decodeToken,
    extractTokenFromHeader,
    generateEmailVerificationToken,
    generatePasswordResetToken,
    verifySpecialToken,
    isTokenExpired,
    getTokenExpiration,
};
