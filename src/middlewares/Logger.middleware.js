const morgan = require('morgan');
const logger = require('../utils/logger');
const { maskSensitiveData, maskEmail } = require('../utils/encryption');

/**
 * Custom Morgan token for user ID
 */
morgan.token('user-id', (req) => {
    return req.user?.id || 'anonymous';
});

/**
 * Custom Morgan token for user email
 */
morgan.token('user-email', (req) => {
    return req.user ? maskEmail(req.user.email) : 'anonymous';
});

/**
 * Custom Morgan token for user role
 */
morgan.token('user-role', (req) => {
    return req.user?.role || 'guest';
});

/**
 * Custom Morgan token for request ID
 */
morgan.token('request-id', (req) => {
    return req.id || 'N/A';
});

/**
 * Custom Morgan token for response time in ms
 */
morgan.token('response-time-ms', (req, res) => {
    const responseTime = res.getHeader('X-Response-Time');
    return responseTime ? `${responseTime}ms` : 'N/A';
});

/**
 * Custom Morgan token for request body (sanitized)
 */
morgan.token('request-body', (req) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return 'N/A';
    }

    // Clone body to avoid modifying original
    const body = { ...req.body };

    // Mask sensitive fields
    const sensitiveFields = [
        'password',
        'token',
        'apiKey',
        'secret',
        'creditCard',
        'cvv',
        'ssn',
    ];

    sensitiveFields.forEach((field) => {
        if (body[field]) {
            body[field] = '***REDACTED***';
        }
    });

    return JSON.stringify(body).substring(0, 200); // Limit length
});

/**
 * Custom Morgan token for query params
 */
morgan.token('query-params', (req) => {
    if (!req.query || Object.keys(req.query).length === 0) {
        return 'N/A';
    }
    return JSON.stringify(req.query).substring(0, 200);
});

/**
 * Custom Morgan token for client IP (considering proxy)
 */
morgan.token('real-ip', (req) => {
    return req.ip || req.connection.remoteAddress;
});

/**
 * Development logging format
 * Shows detailed information for debugging
 */
const developmentFormat =
    ':method :url :status :response-time ms - :res[content-length] - User: :user-email (:user-role)';

/**
 * Production logging format
 * Minimal information for performance
 */
const productionFormat =
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';

/**
 * Detailed logging format
 * Comprehensive information for debugging
 */
const detailedFormat = [
    ':method :url',
    'Status: :status',
    'User: :user-id (:user-role)',
    'IP: :real-ip',
    'Response Time: :response-time ms',
    'Body: :request-body',
    'Query: :query-params',
].join(' | ');

/**
 * Combined format (Apache combined log format)
 */
const combinedFormat =
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - User: :user-id';

/**
 * Development logger
 */
const developmentLogger = morgan(developmentFormat, {
    stream: logger.stream,
});

/**
 * Production logger
 */
const productionLogger = morgan(productionFormat, {
    stream: logger.stream,
    skip: (req, res) => {
        // Skip logging for health checks and static files
        return req.url === '/health' || req.url.startsWith('/static');
    },
});

/**
 * Detailed logger (for debugging)
 */
const detailedLogger = morgan(detailedFormat, {
    stream: logger.stream,
});

/**
 * Combined logger
 */
const combinedLogger = morgan(combinedFormat, {
    stream: logger.stream,
});

/**
 * Error logger - only log failed requests
 */
const errorLogger = morgan(combinedFormat, {
    stream: logger.stream,
    skip: (req, res) => res.statusCode < 400,
});

/**
 * Success logger - only log successful requests
 */
const successLogger = morgan(combinedFormat, {
    stream: logger.stream,
    skip: (req, res) => res.statusCode >= 400,
});

/**
 * Request ID middleware
 * Adds unique ID to each request for tracing
 */
const requestId = (req, res, next) => {
    const crypto = require('crypto');
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
};

/**
 * Response time middleware
 * Calculates and logs response time
 */
const responseTime = (req, res, next) => {
    const startTime = Date.now();

    // Override res.end to calculate response time
    const originalEnd = res.end;

    res.end = function (...args) {
        const duration = Date.now() - startTime;
        res.setHeader('X-Response-Time', duration);

        // Log slow requests
        if (duration > 1000) {
            logger.logWarn('Slow request detected', {
                method: req.method,
                url: req.originalUrl,
                duration: `${duration}ms`,
                userId: req.user?.id,
            });
        }

        // Call original end
        originalEnd.apply(res, args);
    };

    next();
};

/**
 * Request logger middleware
 * Logs detailed request information
 */
const requestLogger = (req, res, next) => {
    const startTime = Date.now();

    logger.logInfo('Incoming request', {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user?.id,
        body: maskSensitiveFields(req.body),
    });

    // Log response
    res.on('finish', () => {
        const duration = Date.now() - startTime;

        const logLevel =
            res.statusCode >= 500
                ? 'error'
                : res.statusCode >= 400
                  ? 'warn'
                  : 'info';

        logger[logLevel]('Request completed', {
            requestId: req.id,
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userId: req.user?.id,
            ip: req.ip,
        });
    });

    next();
};

/**
 * Mask sensitive fields in object
 */
const maskSensitiveFields = (obj) => {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    const masked = { ...obj };
    const sensitiveFields = [
        'password',
        'token',
        'apiKey',
        'secret',
        'creditCard',
        'cvv',
        'ssn',
        'refreshToken',
        'accessToken',
    ];

    sensitiveFields.forEach((field) => {
        if (masked[field]) {
            masked[field] = '***REDACTED***';
        }
    });

    return masked;
};

/**
 * API logger
 * Comprehensive logging for API requests
 */
const apiLogger = (req, res, next) => {
    const startTime = Date.now();

    logger.logInfo('API Request', {
        requestId: req.id,
        method: req.method,
        path: req.path,
        query: req.query,
        body: maskSensitiveFields(req.body),
        headers: {
            'content-type': req.get('content-type'),
            'user-agent': req.get('user-agent'),
        },
        ip: req.ip,
        userId: req.user?.id,
    });

    res.on('finish', () => {
        const duration = Date.now() - startTime;

        logger.logInfo('API Response', {
            requestId: req.id,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            contentLength: res.get('content-length'),
        });
    });

    next();
};

/**
 * Security logger
 * Logs security-related events
 */
const securityLogger = (req, res, next) => {
    // Log authentication attempts
    if (req.path.includes('/login') || req.path.includes('/register')) {
        logger.logSecurity('Authentication attempt', {
            path: req.path,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            email: req.body.email ? maskEmail(req.body.email) : 'N/A',
        });
    }

    // Log unauthorized access attempts
    res.on('finish', () => {
        if (res.statusCode === 401 || res.statusCode === 403) {
            logger.logSecurity('Unauthorized access attempt', {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                ip: req.ip,
                userId: req.user?.id,
            });
        }
    });

    next();
};

/**
 * Performance logger
 * Tracks performance metrics
 */
const performanceLogger = (req, res, next) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const endMemory = process.memoryUsage();

        logger.logPerformance('Request performance', {
            method: req.method,
            path: req.path,
            duration,
            memoryDelta: {
                heapUsed:
                    (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
                rss: (endMemory.rss - startMemory.rss) / 1024 / 1024,
            },
            statusCode: res.statusCode,
        });
    });

    next();
};

/**
 * Custom logger creator
 * Create custom logger with specific format
 */
const createLogger = (format, options = {}) => {
    return morgan(format, {
        stream: logger.stream,
        ...options,
    });
};

/**
 * Conditional logger
 * Log based on condition
 */
const conditionalLogger = (condition, loggerMiddleware) => {
    return (req, res, next) => {
        if (condition(req, res)) {
            return loggerMiddleware(req, res, next);
        }
        next();
    };
};

/**
 * Skip logger for specific routes
 */
const skipRoutes = (routes = []) => {
    return (req, res) => {
        return routes.some((route) => {
            if (typeof route === 'string') {
                return req.url.startsWith(route);
            }
            if (route instanceof RegExp) {
                return route.test(req.url);
            }
            return false;
        });
    };
};

/**
 * Environment-based logger
 * Different loggers for different environments
 */
const environmentLogger = (() => {
    const env = process.env.NODE_ENV || 'development';

    switch (env) {
        case 'production':
            return productionLogger;
        case 'development':
            return developmentLogger;
        case 'test':
            return morgan('tiny', { stream: logger.stream });
        default:
            return combinedLogger;
    }
})();

/**
 * Aggregated logger
 * Combines multiple logging middlewares
 */
const aggregatedLogger = [
    requestId,
    responseTime,
    environmentLogger,
    securityLogger,
];

module.exports = {
    // Pre-configured loggers
    developmentLogger,
    productionLogger,
    detailedLogger,
    combinedLogger,
    errorLogger,
    successLogger,
    environmentLogger,
    aggregatedLogger,

    // Custom loggers
    requestLogger,
    apiLogger,
    securityLogger,
    performanceLogger,

    // Helper middlewares
    requestId,
    responseTime,

    // Utilities
    createLogger,
    conditionalLogger,
    skipRoutes,
    maskSensitiveFields,
};
