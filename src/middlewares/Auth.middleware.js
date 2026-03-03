const { User } = require('../models');
const jwtUtils = require('../utils/jwt');
const { ApiError } = require('../utils/ApiError');
const { asyncHandler } = require('../utils/asyncHandler');
const logger = require('../utils/logger');

/**
 * Authenticate user via JWT token
 * Extracts token from Authorization header and verifies it
 */
const authenticate = asyncHandler(async (req, res, next) => {
    // Extract token from header
    const token = jwtUtils.extractTokenFromHeader(req.headers.authorization);

    if (!token) {
        throw new ApiError(
            401,
            'Authentication required. Please provide a valid token.',
        );
    }

    try {
        // Verify token
        const decoded = jwtUtils.verifyToken(token);

        // Fetch user from database
        const user = await User.findByPk(decoded.userId, {
            attributes: { exclude: ['password'] },
        });

        if (!user) {
            throw new ApiError(401, 'User not found. Token is invalid.');
        }

        if (!user.isActive) {
            throw new ApiError(
                403,
                'Your account has been deactivated. Please contact support.',
            );
        }

        // Attach user to request object
        req.user = user;
        req.token = token;

        next();
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }

        logger.logSecurity('Invalid token attempt', {
            ip: req.ip,
            userAgent: req.get('user-agent'),
            error: error.message,
        });

        throw new ApiError(
            401,
            'Invalid or expired token. Please login again.',
        );
    }
});

/**
 * Optional authentication middleware
 * Attaches user to request if token is present, but doesn't fail if missing
 */
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
    const token = jwtUtils.extractTokenFromHeader(req.headers.authorization);

    if (!token) {
        return next();
    }

    try {
        const decoded = jwtUtils.verifyToken(token);
        const user = await User.findByPk(decoded.userId, {
            attributes: { exclude: ['password'] },
        });

        if (user && user.isActive) {
            req.user = user;
            req.token = token;
        }
    } catch (error) {
        // Silently fail for optional authentication
        logger.logWarn('Optional authentication failed', {
            error: error.message,
            ip: req.ip,
        });
    }

    next();
});

/**
 * Authorize user based on roles
 * @param {...String} allowedRoles - Roles that are allowed to access the route
 * @returns {Function} Middleware function
 */
const authorize = (...allowedRoles) => {
    return asyncHandler((req, res, next) => {
        if (!req.user) {
            throw new ApiError(401, 'Authentication required');
        }

        if (!allowedRoles.includes(req.user.role)) {
            logger.logSecurity('Unauthorized access attempt', {
                userId: req.user.id,
                userRole: req.user.role,
                requiredRoles: allowedRoles,
                path: req.path,
                ip: req.ip,
            });

            throw new ApiError(
                403,
                `Access denied. Required role: ${allowedRoles.join(' or ')}`,
            );
        }

        next();
    });
};

/**
 * Verify email is confirmed
 */
const requireEmailVerification = (req, res, next) => {
    if (!req.user) {
        throw new ApiError(401, 'Authentication required');
    }

    if (!req.user.emailVerified) {
        throw new ApiError(
            403,
            'Email verification required. Please verify your email to access this resource.',
        );
    }

    next();
};

/**
 * Check if user owns the resource
 * @param {String} paramName - Name of the parameter containing resource owner ID
 * @returns {Function} Middleware function
 */
const checkOwnership = (paramName = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            throw new ApiError(401, 'Authentication required');
        }

        const resourceOwnerId = req.params[paramName] || req.body[paramName];

        // Admin can access any resource
        if (req.user.role === 'admin') {
            return next();
        }

        if (req.user.id !== resourceOwnerId) {
            logger.logSecurity('Unauthorized resource access attempt', {
                userId: req.user.id,
                resourceOwnerId,
                path: req.path,
            });

            throw new ApiError(
                403,
                'Access denied. You can only access your own resources.',
            );
        }

        next();
    };
};

/**
 * Verify API key for external integrations
 */
const verifyApiKey = asyncHandler(async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        throw new ApiError(401, 'API key required');
    }

    // In production, you would:
    // 1. Hash the API key
    // 2. Look it up in the database
    // 3. Check rate limits
    // 4. Validate permissions

    const encryption = require('../utils/encryption');
    const hashedKey = encryption.hashApiKey(apiKey);

    // Example: Check against stored API keys
    // const apiKeyRecord = await ApiKey.findOne({ where: { keyHash: hashedKey } });

    // For now, we'll just validate format
    if (!apiKey.startsWith('sk_')) {
        throw new ApiError(401, 'Invalid API key format');
    }

    logger.logApiUsage(apiKey, req.path, req.ip);

    // Attach API key info to request
    req.apiKey = {
        key: apiKey.substring(0, 8) + '...',
        // permissions: apiKeyRecord.permissions
    };

    next();
});

/**
 * Refresh access token using refresh token
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        throw new ApiError(400, 'Refresh token is required');
    }

    try {
        // Verify refresh token
        const decoded = jwtUtils.verifyToken(refreshToken, true);

        // Fetch user
        const user = await User.findByPk(decoded.userId, {
            attributes: { exclude: ['password'] },
        });

        if (!user || !user.isActive) {
            throw new ApiError(401, 'Invalid refresh token');
        }

        // Generate new tokens
        const tokens = jwtUtils.generateTokenPair(user);

        logger.logAuth(user.email, true, req.ip);

        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: tokens,
        });
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(401, 'Invalid or expired refresh token');
    }
});

/**
 * Logout user (client should discard token)
 */
const logout = asyncHandler(async (req, res) => {
    // In a more complex system, you might:
    // 1. Add token to blacklist
    // 2. Clear refresh token from database
    // 3. Clear any sessions

    if (req.user) {
        logger.logInfo('User logged out', {
            userId: req.user.id,
            email: req.user.email,
        });
    }

    res.json({
        success: true,
        message: 'Logged out successfully',
    });
});

/**
 * Middleware to attach user permissions to request
 */
const attachPermissions = asyncHandler(async (req, res, next) => {
    if (!req.user) {
        return next();
    }

    // Define permissions based on role
    const permissions = {
        admin: [
            'user:read',
            'user:write',
            'user:delete',
            'product:read',
            'product:write',
            'product:delete',
            'order:read',
            'order:write',
            'order:delete',
            'settings:read',
            'settings:write',
        ],
        vendor: [
            'product:read',
            'product:write',
            'order:read',
            'inventory:read',
            'inventory:write',
        ],
        customer: [
            'product:read',
            'order:read',
            'order:write',
            'profile:read',
            'profile:write',
        ],
    };

    req.permissions = permissions[req.user.role] || [];
    next();
});

/**
 * Check if user has specific permission
 * @param {String} permission - Permission to check
 * @returns {Function} Middleware function
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new ApiError(401, 'Authentication required');
        }

        if (!req.permissions || !req.permissions.includes(permission)) {
            throw new ApiError(
                403,
                `Permission denied: ${permission} required`,
            );
        }

        next();
    };
};

/**
 * Track failed login attempts
 */
const trackFailedLogins = asyncHandler(async (req, res, next) => {
    const { email } = req.body;

    // In production, implement rate limiting based on email/IP
    // Store failed attempts in Redis with TTL

    // Example pseudocode:
    // const key = `failed_login:${email}`;
    // const attempts = await redis.incr(key);
    // await redis.expire(key, 900); // 15 minutes

    // if (attempts > 5) {
    //   throw new ApiError(429, 'Too many failed login attempts. Please try again later.');
    // }

    next();
});

module.exports = {
    authenticate,
    optionalAuthenticate,
    authorize,
    requireEmailVerification,
    checkOwnership,
    verifyApiKey,
    refreshAccessToken,
    logout,
    attachPermissions,
    requirePermission,
    trackFailedLogins,
};
