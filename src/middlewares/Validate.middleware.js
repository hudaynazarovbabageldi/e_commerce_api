const Joi = require('joi');
const { ApiError } = require('../utils/ApiError');

const validate = (schema) => {
    return (req, res, next) => {
        const validationOptions = {
            abortEarly: false, // Return all errors, not just the first one
            allowUnknown: true, // Allow unknown keys that will be ignored
            stripUnknown: true, // Remove unknown keys from the validated data
        };

        const errors = [];

        // Validate request body
        if (schema.body) {
            const { error, value } = schema.body.validate(
                req.body,
                validationOptions,
            );
            if (error) {
                errors.push(
                    ...error.details.map((detail) => ({
                        field: detail.path.join('.'),
                        message: detail.message,
                        type: 'body',
                    })),
                );
            } else {
                req.body = value;
            }
        }

        // Validate request params
        if (schema.params) {
            const { error, value } = schema.params.validate(
                req.params,
                validationOptions,
            );
            if (error) {
                errors.push(
                    ...error.details.map((detail) => ({
                        field: detail.path.join('.'),
                        message: detail.message,
                        type: 'params',
                    })),
                );
            } else {
                req.params = value;
            }
        }

        // Validate request query
        if (schema.query) {
            const { error, value } = schema.query.validate(
                req.query,
                validationOptions,
            );
            if (error) {
                errors.push(
                    ...error.details.map((detail) => ({
                        field: detail.path.join('.'),
                        message: detail.message,
                        type: 'query',
                    })),
                );
            } else {
                req.query = value;
            }
        }

        // Validate request headers
        if (schema.headers) {
            const { error, value } = schema.headers.validate(
                req.headers,
                validationOptions,
            );
            if (error) {
                errors.push(
                    ...error.details.map((detail) => ({
                        field: detail.path.join('.'),
                        message: detail.message,
                        type: 'headers',
                    })),
                );
            }
        }

        if (errors.length > 0) {
            throw new ApiError(400, 'Validation failed', true, null, errors);
        }

        next();
    };
};

const validateField = (field, key, schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[field][key]);

        if (error) {
            throw new ApiError(400, error.details[0].message);
        }

        req[field][key] = value;
        next();
    };
};

const commonSchemas = {
    uuid: Joi.string().uuid({ version: 'uuidv4' }).required(),
    optionalUuid: Joi.string().uuid({ version: 'uuidv4' }).optional(),
    email: Joi.string().email().lowercase().trim().required(),
    password: Joi.string()
        .min(8)
        .max(128)
        .pattern(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/,
        )
        .required()
        .messages({
            'string.pattern.base':
                'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
            'string.min': 'Password must be at least 8 characters long',
            'string.max': 'Password must not exceed 128 characters',
        }),
    // Phone number validation
    phone: Joi.string()
        .pattern(
            /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
        )
        .messages({
            'string.pattern.base': 'Please provide a valid phone number',
        }),

    // Pagination
    pagination: {
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20),
        sort: Joi.string().optional(),
        order: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').default('desc'),
    },

    // Date range
    dateRange: {
        startDate: Joi.date().iso().optional(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
    },

    // Price range
    priceRange: {
        minPrice: Joi.number().min(0).optional(),
        maxPrice: Joi.number().min(Joi.ref('minPrice')).optional(),
    },

    // Search query
    search: Joi.string().min(1).max(100).trim().optional(),

    // URL validation
    url: Joi.string().uri().optional(),

    // Boolean
    boolean: Joi.boolean().optional(),

    // Array of strings
    stringArray: Joi.array().items(Joi.string()).optional(),

    // Array of UUIDs
    uuidArray: Joi.array().items(Joi.string().uuid()).optional(),
};

/**
 * Sanitize input to prevent XSS and injection attacks
 */
const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            // Remove script tags and other dangerous content
            return obj
                .replace(
                    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                    '',
                )
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '')
                .trim();
        }

        if (Array.isArray(obj)) {
            return obj.map(sanitize);
        }

        if (typeof obj === 'object' && obj !== null) {
            const sanitized = {};
            for (const key in obj) {
                sanitized[key] = sanitize(obj[key]);
            }
            return sanitized;
        }

        return obj;
    };

    req.body = sanitize(req.body);
    req.query = sanitize(req.query);
    req.params = sanitize(req.params);

    next();
};

/**
 * Validate file upload
 * @param {Object} options - Validation options
 * @returns {Function} Middleware function
 */
const validateFileUpload = (options = {}) => {
    const {
        required = false,
        maxSize = 5 * 1024 * 1024, // 5MB default
        allowedMimeTypes = [],
        allowedExtensions = [],
    } = options;

    return (req, res, next) => {
        if (!req.file && !req.files) {
            if (required) {
                throw new ApiError(400, 'File upload is required');
            }
            return next();
        }

        const files = req.files || [req.file];

        for (const file of files) {
            if (!file) continue;

            // Check file size
            if (file.size > maxSize) {
                throw new ApiError(
                    400,
                    `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`,
                );
            }

            // Check MIME type
            if (
                allowedMimeTypes.length > 0 &&
                !allowedMimeTypes.includes(file.mimetype)
            ) {
                throw new ApiError(
                    400,
                    `File type ${file.mimetype} is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
                );
            }

            // Check file extension
            if (allowedExtensions.length > 0) {
                const ext = file.originalname.split('.').pop().toLowerCase();
                if (!allowedExtensions.includes(ext)) {
                    throw new ApiError(
                        400,
                        `File extension .${ext} is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`,
                    );
                }
            }
        }

        next();
    };
};

/**
 * Validate content type
 * @param {Array} allowedTypes - Array of allowed content types
 * @returns {Function} Middleware function
 */
const validateContentType = (allowedTypes = ['application/json']) => {
    return (req, res, next) => {
        const contentType = req.headers['content-type'];

        if (!contentType) {
            throw new ApiError(400, 'Content-Type header is required');
        }

        const isAllowed = allowedTypes.some((type) =>
            contentType.toLowerCase().includes(type.toLowerCase()),
        );

        if (!isAllowed) {
            throw new ApiError(
                415,
                `Unsupported Media Type. Allowed types: ${allowedTypes.join(', ')}`,
            );
        }

        next();
    };
};

/**
 * Validate array length
 * @param {String} field - Field location (body, query)
 * @param {String} key - Field name
 * @param {Number} min - Minimum length
 * @param {Number} max - Maximum length
 * @returns {Function} Middleware function
 */
const validateArrayLength = (field, key, min = 0, max = Infinity) => {
    return (req, res, next) => {
        const array = req[field][key];

        if (!Array.isArray(array)) {
            throw new ApiError(400, `${key} must be an array`);
        }

        if (array.length < min) {
            throw new ApiError(
                400,
                `${key} must contain at least ${min} items`,
            );
        }

        if (array.length > max) {
            throw new ApiError(400, `${key} must contain at most ${max} items`);
        }

        next();
    };
};

/**
 * Validate request body size
 * @param {Number} maxSize - Maximum body size in bytes
 * @returns {Function} Middleware function
 */
const validateBodySize = (maxSize = 1024 * 1024) => {
    return (req, res, next) => {
        const contentLength = parseInt(req.headers['content-length'] || 0);

        if (contentLength > maxSize) {
            throw new ApiError(
                413,
                `Request body size exceeds maximum allowed size of ${maxSize / 1024}KB`,
            );
        }

        next();
    };
};

/**
 * Custom validation function wrapper
 * @param {Function} validationFn - Custom validation function
 * @returns {Function} Middleware function
 */
const customValidation = (validationFn) => {
    return async (req, res, next) => {
        try {
            await validationFn(req);
            next();
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(400, error.message || 'Validation failed');
        }
    };
};

/**
 * Validate unique field (e.g., email, username)
 * @param {Object} Model - Sequelize model
 * @param {String} field - Field name to check
 * @param {String} location - Field location (body, params)
 * @returns {Function} Middleware function
 */
const validateUnique = (Model, field, location = 'body') => {
    return async (req, res, next) => {
        const value = req[location][field];

        if (!value) {
            return next();
        }

        const existing = await Model.findOne({ where: { [field]: value } });

        if (existing) {
            throw new ApiError(409, `${field} already exists`);
        }

        next();
    };
};

/**
 * Validate resource exists
 * @param {Object} Model - Sequelize model
 * @param {String} paramName - Parameter name containing ID
 * @param {String} resourceName - Resource name for error message
 * @returns {Function} Middleware function
 */
const validateResourceExists = (
    Model,
    paramName = 'id',
    resourceName = 'Resource',
) => {
    return async (req, res, next) => {
        const id = req.params[paramName];

        if (!id) {
            throw new ApiError(400, `${paramName} is required`);
        }

        const resource = await Model.findByPk(id);

        if (!resource) {
            throw new ApiError(404, `${resourceName} not found`);
        }

        // Attach resource to request
        req[resourceName.toLowerCase()] = resource;

        next();
    };
};

/**
 * Conditional validation
 * @param {Function} condition - Function that returns boolean
 * @param {Object} schema - Joi schema to apply if condition is true
 * @returns {Function} Middleware function
 */
const conditionalValidate = (condition, schema) => {
    return (req, res, next) => {
        if (condition(req)) {
            return validate(schema)(req, res, next);
        }
        next();
    };
};

module.exports = {
    validate,
    validateField,
    commonSchemas,
    sanitizeInput,
    validateFileUpload,
    validateContentType,
    validateArrayLength,
    validateBodySize,
    customValidation,
    validateUnique,
    validateResourceExists,
    conditionalValidate,
};
