const { ApiError } = require('../utils/ApiError');
const logger = require('../utils/logger');
const config = require('../config/env');

/**
 * Convert non-ApiError errors to ApiError
 */
const errorConverter = (err, req, res, next) => {
    let error = err;

    if (!(error instanceof ApiError)) {
        // Sequelize validation errors
        if (error.name === 'SequelizeValidationError') {
            const message = error.errors.map((e) => e.message).join(', ');
            error = new ApiError(400, message, true, error.stack);
        }
        // Sequelize unique constraint errors
        else if (error.name === 'SequelizeUniqueConstraintError') {
            const field = error.errors[0]?.path || 'field';
            error = new ApiError(
                409,
                `${field} already exists`,
                true,
                error.stack,
            );
        }
        // Sequelize foreign key constraint errors
        else if (error.name === 'SequelizeForeignKeyConstraintError') {
            error = new ApiError(
                400,
                'Invalid reference to related resource',
                true,
                error.stack,
            );
        }
        // Sequelize database errors
        else if (error.name === 'SequelizeDatabaseError') {
            error = new ApiError(
                500,
                'Database operation failed',
                false,
                error.stack,
            );
        }
        // JWT errors
        else if (error.name === 'JsonWebTokenError') {
            error = new ApiError(401, 'Invalid token', true, error.stack);
        } else if (error.name === 'TokenExpiredError') {
            error = new ApiError(401, 'Token expired', true, error.stack);
        }
        // Multer file upload errors
        else if (error.name === 'MulterError') {
            let message = 'File upload error';
            if (error.code === 'LIMIT_FILE_SIZE') {
                message = 'File size exceeds the limit';
            } else if (error.code === 'LIMIT_FILE_COUNT') {
                message = 'Too many files';
            } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
                message = 'Unexpected file field';
            }
            error = new ApiError(400, message, true, error.stack);
        }
        // Syntax errors (invalid JSON)
        else if (
            error instanceof SyntaxError &&
            error.status === 400 &&
            'body' in error
        ) {
            error = new ApiError(
                400,
                'Invalid JSON in request body',
                true,
                error.stack,
            );
        }
        // MongoDB/Mongoose CastError
        else if (error.name === 'CastError') {
            error = new ApiError(400, 'Invalid ID format', true, error.stack);
        }
        // Generic errors
        else {
            const statusCode = error.statusCode || error.status || 500;
            const message = error.message || 'Internal Server Error';
            error = new ApiError(statusCode, message, false, error.stack);
        }
    }

    next(error);
};

/**
 * Main error handler
 */
const errorHandler = (err, req, res, next) => {
    let { statusCode, message, isOperational, stack } = err;

    // Default to 500 if statusCode is not set
    if (!statusCode) {
        statusCode = 500;
    }

    // Default message for 500 errors in production
    if (statusCode === 500 && config.env === 'production' && !isOperational) {
        message = 'Internal Server Error';
    }

    // Prepare response
    const response = {
        success: false,
        statusCode,
        message,
        ...(config.env === 'development' && { stack }),
        ...(err.errors && { errors: err.errors }), // Include validation errors if present
    };

    // Log error
    if (statusCode >= 500) {
        logger.logError(message, {
            statusCode,
            stack,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            userId: req.user?.id,
            body: req.body,
            isOperational,
        });
    } else if (statusCode >= 400) {
        logger.logWarn(message, {
            statusCode,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            userId: req.user?.id,
        });
    }

    res.status(statusCode).json(response);
};

/**
 * Handle 404 errors (route not found)
 */
const notFound = (req, res, next) => {
    const error = new ApiError(404, `Route not found: ${req.originalUrl}`);
    next(error);
};

/**
 * Handle async errors (wrapper for async route handlers)
 * This is already in utils/asyncHandler.js but included here for completeness
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Handle unhandled promise rejections
 */
const handleUnhandledRejection = () => {
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        // In production, you might want to:
        // 1. Log to error tracking service (Sentry, Rollbar, etc.)
        // 2. Gracefully shutdown the server
        // 3. Restart the process with a process manager (PM2, Kubernetes, etc.)
    });
};

/**
 * Handle uncaught exceptions
 */
const handleUncaughtException = () => {
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', error);
        // Exit the process - let process manager restart it
        process.exit(1);
    });
};

/**
 * Validation error formatter
 */
const formatValidationErrors = (errors) => {
    return errors.map((error) => ({
        field: error.path || error.field,
        message: error.message,
        value: error.value,
    }));
};

/**
 * Handle specific HTTP status errors
 */
const handleHttpStatusError = (statusCode, message) => {
    return (req, res, next) => {
        throw new ApiError(statusCode, message);
    };
};

/**
 * Rate limit error handler
 */
const rateLimitErrorHandler = (req, res) => {
    logger.logSecurity('Rate limit exceeded', {
        ip: req.ip,
        url: req.originalUrl,
        userAgent: req.get('user-agent'),
    });

    res.status(429).json({
        success: false,
        statusCode: 429,
        message: 'Too many requests, please try again later',
        retryAfter: req.rateLimit?.resetTime,
    });
};

/**
 * CORS error handler
 */
const corsErrorHandler = (err, req, res, next) => {
    if (err.message && err.message.includes('Not allowed by CORS')) {
        return res.status(403).json({
            success: false,
            statusCode: 403,
            message: 'CORS policy: Access denied',
        });
    }
    next(err);
};

/**
 * Database connection error handler
 */
const databaseErrorHandler = (err, req, res, next) => {
    if (
        err.name === 'SequelizeConnectionError' ||
        err.name === 'SequelizeConnectionRefusedError'
    ) {
        logger.error('Database connection error:', err);
        return res.status(503).json({
            success: false,
            statusCode: 503,
            message: 'Service temporarily unavailable. Please try again later.',
        });
    }
    next(err);
};

/**
 * Timeout error handler
 */
const timeoutErrorHandler = (err, req, res, next) => {
    if (err.message && err.message.includes('timeout')) {
        logger.error('Request timeout:', {
            url: req.originalUrl,
            method: req.method,
        });
        return res.status(408).json({
            success: false,
            statusCode: 408,
            message: 'Request timeout. Please try again.',
        });
    }
    next(err);
};

/**
 * Custom error responses for different environments
 */
const getErrorResponse = (err, env) => {
    const baseResponse = {
        success: false,
        statusCode: err.statusCode || 500,
        message: err.message,
    };

    if (env === 'development') {
        return {
            ...baseResponse,
            stack: err.stack,
            errors: err.errors,
        };
    }

    if (env === 'staging') {
        return {
            ...baseResponse,
            errors: err.errors,
        };
    }

    // Production - minimal information
    if (err.statusCode >= 500) {
        return {
            success: false,
            statusCode: 500,
            message: 'Internal Server Error',
        };
    }

    return baseResponse;
};

/**
 * Send error to external error tracking service
 */
const sendToErrorTracking = (err, req) => {
    // Integrate with services like Sentry, Rollbar, Bugsnag, etc.
    // Example with Sentry:
    // const Sentry = require('@sentry/node');
    // Sentry.captureException(err, {
    //   user: { id: req.user?.id, email: req.user?.email },
    //   tags: { path: req.path, method: req.method },
    //   extra: { body: req.body, query: req.query }
    // });

    if (config.env === 'production' && err.statusCode >= 500) {
        logger.error('Error tracked for monitoring', {
            message: err.message,
            stack: err.stack,
            statusCode: err.statusCode,
            userId: req.user?.id,
            url: req.originalUrl,
        });
    }
};

/**
 * Error handler with monitoring
 */
const errorHandlerWithMonitoring = (err, req, res, next) => {
    // Send to error tracking service
    sendToErrorTracking(err, req);

    // Continue with normal error handling
    errorHandler(err, req, res, next);
};

/**
 * Handle specific error types
 */
const handleSpecificErrors = (err, req, res, next) => {
    // Payment errors
    if (err.type === 'StripeCardError') {
        return res.status(400).json({
            success: false,
            statusCode: 400,
            message: err.message,
            code: err.code,
        });
    }

    // Email service errors
    if (err.type === 'EmailServiceError') {
        logger.error('Email service error:', err);
        // Don't fail the request if email fails
        return next();
    }

    next(err);
};

/**
 * Create a custom error middleware
 */
const createCustomErrorHandler = (options = {}) => {
    const {
        logErrors = true,
        sendToTracking = true,
        includeStack = config.env === 'development',
    } = options;

    return (err, req, res, next) => {
        if (logErrors) {
            logger.error('Custom error handler:', err);
        }

        if (sendToTracking) {
            sendToErrorTracking(err, req);
        }

        const response = {
            success: false,
            statusCode: err.statusCode || 500,
            message: err.message || 'Internal Server Error',
            ...(includeStack && { stack: err.stack }),
        };

        res.status(response.statusCode).json(response);
    };
};

module.exports = {
    errorConverter,
    errorHandler,
    notFound,
    asyncHandler,
    handleUnhandledRejection,
    handleUncaughtException,
    formatValidationErrors,
    handleHttpStatusError,
    rateLimitErrorHandler,
    corsErrorHandler,
    databaseErrorHandler,
    timeoutErrorHandler,
    getErrorResponse,
    sendToErrorTracking,
    errorHandlerWithMonitoring,
    handleSpecificErrors,
    createCustomErrorHandler,
};
