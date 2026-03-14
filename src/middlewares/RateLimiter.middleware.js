const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const logger = require('../utils/logger');
const { getRedisClient } = require('../config/redis');
const { ipKeyGenerator } = rateLimit;

const redisClient = process.env.USE_REDIS === 'true' ? getRedisClient() : null;

const createStore = () => {
    if (!redisClient) return undefined;

    return new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
        prefix: 'rl:',
    });
};
// const createStore = () => {
//     if (!redisClient) {
//         console.log('RateLimit using MemoryStore (Redis disabled)');
//         return undefined;
//     }

//     console.log('RateLimit using RedisStore');

//     return new RedisStore({
//         sendCommand: (...args) => redisClient.sendCommand(args),
//         prefix: 'rl:',
//     });
// };

const keyGenerator = (req) => {
    if (req.user) {
        return `user:${req.user.id}`;
    }
    return ipKeyGenerator(req);
};

const rateLimitHandler = (req, res) => {
    logger.logSecurity('Rate limit exceeded', {
        ip: ipKeyGenerator(req),
        userId: req.user?.id,
        path: req.path,
        method: req.method,
    });

    res.status(429).json({
        success: false,
        statusCode: 429,
        message: 'Too many requests from this IP/user, please try again later.',
        retryAfter: req.rateLimit?.resetTime,
    });
};

const skipSuccessfulRequests = (req, res) => {
    return res.statusCode < 400;
};

const skipFailedRequests = (req, res) => {
    return res.statusCode >= 400;
};

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    passOnStoreError: true,
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many requests' });
    },
});

const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    passOnStoreError: true,
    keyGenerator,
    handler: rateLimitHandler,
    skipSuccessfulRequests: false,
});

/**
 * Auth rate limiter (login, register, password reset)
 * Limits: 5 requests per 15 minutes per IP
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    passOnStoreError: true,
    keyGenerator: (req) => `auth:${ipKeyGenerator(req)}`,
    handler: (req, res) => {
        logger.logSecurity('Auth rate limit exceeded', {
            ip: ipKeyGenerator(req),
            path: req.path,
            email: req.body.email,
        });

        res.status(429).json({
            success: false,
            statusCode: 429,
            message:
                'Too many authentication attempts, please try again later.',
            retryAfter: req.rateLimit?.resetTime,
        });
    },
    skipSuccessfulRequests: true,
});

const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    passOnStoreError: true,
    keyGenerator: (req) => `reset:${ipKeyGenerator(req)}`,
    handler: rateLimitHandler,
});

const emailVerificationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    passOnStoreError: true,
    keyGenerator: (req) => `verify:${req.user?.id || ipKeyGenerator(req)}`,
    handler: rateLimitHandler,
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    passOnStoreError: true,
    keyGenerator,
    handler: (req, res) => {
        logger.logSecurity('Upload rate limit exceeded', {
            ip: ipKeyGenerator(req),
            userId: req.user?.id,
        });

        res.status(429).json({
            success: false,
            statusCode: 429,
            message: 'Too many file uploads, please try again later.',
            retryAfter: req.rateLimit?.resetTime,
        });
    },
});

const searchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    passOnStoreError: true,
    keyGenerator,
    handler: rateLimitHandler,
    skipSuccessfulRequests: false,
});

const paymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    passOnStoreError: true,
    keyGenerator: (req) => `payment:${req.user?.id || ipKeyGenerator(req)}`,
    handler: (req, res) => {
        logger.logSecurity('Payment rate limit exceeded', {
            ip: ipKeyGenerator(req),
            userId: req.user?.id,
        });

        res.status(429).json({
            success: false,
            statusCode: 429,
            message:
                'Too many payment attempts. Please contact support if you need assistance.',
            retryAfter: req.rateLimit?.resetTime,
        });
    },
});

const apiKeyLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    passOnStoreError: true,
    keyGenerator: (req) => `apikey:${req.headers['x-api-key']}`,
    handler: rateLimitHandler,
});

const createRateLimiter = (options = {}) => {
    const {
        windowMs = 15 * 60 * 1000,
        max = 100,
        message = 'Too many requests, please try again later.',
        statusCode = 429,
        keyPrefix = '',
        skipSuccessful = false,
        skipFailed = false,
    } = options;

    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        store: createStore(),
        passOnStoreError: true,
        keyGenerator: (req) => {
            const key = req.user
                ? `user:${req.user.id}`
                : `ip:${ipKeyGenerator(req)}`;
            return keyPrefix ? `${keyPrefix}:${key}` : key;
        },
        handler: (req, res) => {
            logger.logSecurity('Rate limit exceeded', {
                prefix: keyPrefix,
                ip: ipKeyGenerator(req),
                userId: req.user?.id,
                path: req.path,
            });

            res.status(statusCode).json({
                success: false,
                statusCode,
                message,
                retryAfter: req.rateLimit?.resetTime,
            });
        },
        skipSuccessfulRequests: skipSuccessful,
        skipFailedRequests: skipFailed,
    });
};

/**
 * Dynamic rate limiter based on user role
 * Different limits for different user roles
 */
const dynamicRateLimiter = (limits = {}) => {
    const defaultLimits = {
        admin: { max: 1000, windowMs: 15 * 60 * 1000 },
        vendor: { max: 500, windowMs: 15 * 60 * 1000 },
        customer: { max: 100, windowMs: 15 * 60 * 1000 },
        guest: { max: 20, windowMs: 15 * 60 * 1000 },
    };

    const finalLimits = { ...defaultLimits, ...limits };

    return (req, res, next) => {
        const role = req.user?.role || 'guest';
        const limit = finalLimits[role] || finalLimits.guest;

        const limiter = rateLimit({
            windowMs: limit.windowMs,
            max: limit.max,
            standardHeaders: true,
            legacyHeaders: false,
            store: createStore(),
            passOnStoreError: true,
            keyGenerator: (req) =>
                `${role}:${req.user?.id || ipKeyGenerator(req)}`,
            handler: rateLimitHandler,
        });

        limiter(req, res, next);
    };
};

/**
 * Sliding window rate limiter
 * More accurate than fixed window
 */
const slidingWindowLimiter = (options = {}) => {
    const { windowMs = 60 * 1000, max = 10 } = options;

    const requests = new Map();

    return (req, res, next) => {
        const key = req.user?.id || ipKeyGenerator(req);
        const now = Date.now();
        const windowStart = now - windowMs;

        // Get existing requests for this key
        let userRequests = requests.get(key) || [];

        // Remove old requests outside the window
        userRequests = userRequests.filter(
            (timestamp) => timestamp > windowStart,
        );

        if (userRequests.length >= max) {
            return rateLimitHandler(req, res);
        }

        // Add current request
        userRequests.push(now);
        requests.set(key, userRequests);

        // Cleanup old entries periodically
        if (Math.random() < 0.01) {
            for (const [k, v] of requests.entries()) {
                if (v.every((timestamp) => timestamp < windowStart)) {
                    requests.delete(k);
                }
            }
        }

        next();
    };
};

/**
 * Conditional rate limiter
 * Apply rate limiting based on condition
 */
const conditionalRateLimiter = (condition, limiter) => {
    return (req, res, next) => {
        if (condition(req)) {
            return limiter(req, res, next);
        }
        next();
    };
};

/**
 * Rate limit info middleware
 * Adds rate limit information to response headers
 */
const rateLimitInfo = (req, res, next) => {
    if (req.rateLimit) {
        res.set({
            'X-RateLimit-Limit': req.rateLimit.limit,
            'X-RateLimit-Remaining': req.rateLimit.remaining,
            'X-RateLimit-Reset': new Date(
                req.rateLimit.resetTime,
            ).toISOString(),
        });
    }
    next();
};

/**
 * IP whitelist middleware
 * Skip rate limiting for whitelisted IPs
 */
const ipWhitelist = (whitelist = []) => {
    return (req, res, next) => {
        if (whitelist.includes(ipKeyGenerator(req))) {
            req.skipRateLimit = true;
        }
        next();
    };
};

/**
 * Speed limiter (slow down requests)
 * Gradually increases delay as limit is approached
 */
const speedLimiter = require('express-slow-down');

const slowDown = speedLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // Allow 50 requests per windowMs without delay
    delayMs: (used, req) => {
        const delayAfter = req.slowDown.limit;
        return (used - delayAfter) * 500;
    }, // Add 500ms delay per request after delayAfter
    maxDelayMs: 20000, // Maximum delay of 20 seconds
    store: createStore(),
    keyGenerator,
});

module.exports = {
    apiLimiter,
    strictLimiter,
    authLimiter,
    passwordResetLimiter,
    emailVerificationLimiter,
    uploadLimiter,
    searchLimiter,
    paymentLimiter,
    apiKeyLimiter,
    createRateLimiter,
    dynamicRateLimiter,
    slidingWindowLimiter,
    conditionalRateLimiter,
    rateLimitInfo,
    ipWhitelist,
    slowDown,
};
