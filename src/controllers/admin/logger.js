const winston = require('winston');
const path = require('path');
const config = require('../config/env');

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define log colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};

// Add colors to Winston
winston.addColors(colors);

// Determine log level based on environment
const level = () => {
    const env = config.env || 'development';
    const isDevelopment = env === 'development';
    return isDevelopment ? 'debug' : 'warn';
};

// Define log format
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
);

// Define console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf((info) => {
        const { timestamp, level, message, ...args } = info;
        let meta = '';
        if (Object.keys(args).length) {
            try {
                // Handle circular references with a replacer function
                const seen = new WeakSet();
                meta = JSON.stringify(
                    args,
                    (key, value) => {
                        if (typeof value === 'object' && value !== null) {
                            if (seen.has(value)) {
                                return '[Circular]';
                            }
                            seen.add(value);
                        }
                        return value;
                    },
                    2,
                );
            } catch (error) {
                meta = String(args);
            }
        }
        return `${timestamp} [${level}]: ${message} ${meta}`;
    }),
);

// Define transports
const transports = [
    // Console transport
    new winston.transports.Console({
        format: consoleFormat,
    }),

    // Error log file
    new winston.transports.File({
        filename: path.join('logs', 'error.log'),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }),

    // Combined log file
    new winston.transports.File({
        filename: path.join('logs', 'combined.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }),
];

// Create the logger
const logger = winston.createLogger({
    level: level(),
    levels,
    format,
    transports,
    exitOnError: false,
});

// Add daily rotate file transport for production
if (config.env === 'production') {
    const DailyRotateFile = require('winston-daily-rotate-file');

    logger.add(
        new DailyRotateFile({
            filename: path.join('logs', 'application-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
        }),
    );
}

/**
 * Custom logging methods with metadata support
 */

/**
 * Log error message
 * @param {String} message - Error message
 * @param {Object} meta - Additional metadata
 */
logger.logError = (message, meta = {}) => {
    logger.error(message, {
        timestamp: new Date().toISOString(),
        ...meta,
    });
};

/**
 * Log warning message
 * @param {String} message - Warning message
 * @param {Object} meta - Additional metadata
 */
logger.logWarn = (message, meta = {}) => {
    logger.warn(message, {
        timestamp: new Date().toISOString(),
        ...meta,
    });
};

/**
 * Log info message
 * @param {String} message - Info message
 * @param {Object} meta - Additional metadata
 */
logger.logInfo = (message, meta = {}) => {
    logger.info(message, {
        timestamp: new Date().toISOString(),
        ...meta,
    });
};

/**
 * Log HTTP request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Number} duration - Request duration in ms
 */
logger.logRequest = (req, res, duration) => {
    logger.http('HTTP Request', {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user?.id,
    });
};

/**
 * Log database query
 * @param {String} query - SQL query
 * @param {Number} duration - Query duration in ms
 */
logger.logQuery = (query, duration) => {
    logger.debug('Database Query', {
        query: query.substring(0, 200), // Limit query length
        duration: `${duration}ms`,
    });
};

/**
 * Log authentication attempt
 * @param {String} email - User email
 * @param {Boolean} success - Whether authentication succeeded
 * @param {String} ip - IP address
 */
logger.logAuth = (email, success, ip) => {
    const level = success ? 'info' : 'warn';
    logger[level]('Authentication Attempt', {
        email,
        success,
        ip,
        timestamp: new Date().toISOString(),
    });
};

/**
 * Log API key usage
 * @param {String} apiKey - API key (masked)
 * @param {String} endpoint - Endpoint accessed
 * @param {String} ip - IP address
 */
logger.logApiUsage = (apiKey, endpoint, ip) => {
    logger.info('API Usage', {
        apiKey: apiKey.substring(0, 8) + '...',
        endpoint,
        ip,
    });
};

/**
 * Log payment transaction
 * @param {String} orderId - Order ID
 * @param {Number} amount - Transaction amount
 * @param {String} status - Transaction status
 * @param {String} gateway - Payment gateway
 */
logger.logPayment = (orderId, amount, status, gateway) => {
    logger.info('Payment Transaction', {
        orderId,
        amount,
        status,
        gateway,
        timestamp: new Date().toISOString(),
    });
};

/**
 * Log security event
 * @param {String} event - Event type
 * @param {Object} details - Event details
 */
logger.logSecurity = (event, details = {}) => {
    logger.warn('Security Event', {
        event,
        ...details,
        timestamp: new Date().toISOString(),
    });
};

/**
 * Log performance metric
 * @param {String} metric - Metric name
 * @param {Number} value - Metric value
 * @param {String} unit - Unit of measurement
 */
logger.logPerformance = (metric, value, unit = 'ms') => {
    logger.debug('Performance Metric', {
        metric,
        value,
        unit,
        timestamp: new Date().toISOString(),
    });
};

/**
 * Log external API call
 * @param {String} service - External service name
 * @param {String} endpoint - Endpoint called
 * @param {Number} duration - Call duration
 * @param {Boolean} success - Whether call succeeded
 */
logger.logExternalApi = (service, endpoint, duration, success) => {
    const level = success ? 'info' : 'error';
    logger[level]('External API Call', {
        service,
        endpoint,
        duration: `${duration}ms`,
        success,
    });
};

/**
 * Log business event
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
logger.logBusinessEvent = (event, data = {}) => {
    logger.info('Business Event', {
        event,
        ...data,
        timestamp: new Date().toISOString(),
    });
};

/**
 * Stream object for Morgan HTTP logger middleware
 */
logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    },
};

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = logger;
