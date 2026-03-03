const { ApiError } = require('./ApiError');

/**
 * UUID v4 validation regex
 */
const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate if a string is a valid UUID v4
 * @param {string} id - The ID to validate
 * @returns {boolean}
 */
const isValidUuid = (id) => {
    if (!id || typeof id !== 'string') return false;
    return UUID_REGEX.test(id);
};

/**
 * Validate UUID and throw error if invalid
 * @param {string} id - The ID to validate
 * @param {string} entityName - Name of the entity for error message
 * @throws {ApiError} If UUID is invalid
 */
const validateUuid = (id, entityName = 'Entity') => {
    if (!isValidUuid(id)) {
        throw new ApiError(400, `Invalid ${entityName} ID format`);
    }
};

/**
 * Get entity by ID (UUID) from any Sequelize model
 * @param {Object} Model - Sequelize model
 * @param {string} id - Entity UUID
 * @param {Object} options - Query options (attributes, include, etc.)
 * @returns {Promise<Object>} The found entity
 * @throws {ApiError} If entity not found
 */
const getById = async (Model, id, options = {}) => {
    const modelName = Model.name || 'Entity';
    validateUuid(id, modelName);

    const entity = await Model.findByPk(id, options);

    if (!entity) {
        throw new ApiError(404, `${modelName} not found`);
    }

    return entity;
};

/**
 * Get entity by ID or return null (no error thrown)
 * @param {Object} Model - Sequelize model
 * @param {string} id - Entity UUID
 * @param {Object} options - Query options
 * @returns {Promise<Object|null>}
 */
const getByIdOrNull = async (Model, id, options = {}) => {
    if (!isValidUuid(id)) return null;
    return Model.findByPk(id, options);
};

/**
 * Get multiple entities by IDs
 * @param {Object} Model - Sequelize model
 * @param {string[]} ids - Array of UUIDs
 * @param {Object} options - Query options
 * @returns {Promise<Object[]>}
 */
const getByIds = async (Model, ids, options = {}) => {
    const validIds = ids.filter(isValidUuid);

    if (validIds.length === 0) {
        return [];
    }

    const { Op } = require('sequelize');
    return Model.findAll({
        where: { id: { [Op.in]: validIds } },
        ...options,
    });
};

/**
 * Check if entity exists by ID
 * @param {Object} Model - Sequelize model
 * @param {string} id - Entity UUID
 * @returns {Promise<boolean>}
 */
const existsById = async (Model, id) => {
    if (!isValidUuid(id)) return false;

    const count = await Model.count({ where: { id } });
    return count > 0;
};

/**
 * Get entity by ID or throw custom error
 * @param {Object} Model - Sequelize model
 * @param {string} id - Entity UUID
 * @param {string} errorMessage - Custom error message
 * @param {number} statusCode - HTTP status code (default: 404)
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
const getByIdOrFail = async (
    Model,
    id,
    errorMessage,
    statusCode = 404,
    options = {},
) => {
    const modelName = Model.name || 'Entity';
    validateUuid(id, modelName);

    const entity = await Model.findByPk(id, options);

    if (!entity) {
        throw new ApiError(statusCode, errorMessage);
    }

    return entity;
};

/**
 * Create a resolver function for a specific model
 * Useful for creating model-specific utilities
 * @param {Object} Model - Sequelize model
 * @returns {Object} Object with resolver methods
 *
 * @example
 * const userResolver = createResolver(User);
 * const user = await userResolver.getById(userId);
 */
const createResolver = (Model) => {
    const modelName = Model.name || 'Entity';

    return {
        getById: (id, options = {}) => getById(Model, id, options),
        getByIdOrNull: (id, options = {}) => getByIdOrNull(Model, id, options),
        getByIds: (ids, options = {}) => getByIds(Model, ids, options),
        existsById: (id) => existsById(Model, id),
        getByIdOrFail: (id, errorMessage, statusCode = 404, options = {}) =>
            getByIdOrFail(
                Model,
                id,
                errorMessage || `${modelName} not found`,
                statusCode,
                options,
            ),
    };
};

/**
 * Extract and validate ID from request params
 * @param {Object} req - Express request object
 * @param {string} paramName - Name of the param (default: 'id')
 * @param {string} entityName - Entity name for error message
 * @returns {string} The validated UUID
 */
const extractIdFromParams = (req, paramName = 'id', entityName = 'Entity') => {
    const id = req.params[paramName];
    validateUuid(id, entityName);
    return id;
};

/**
 * Middleware factory to load entity and attach to request
 * @param {Object} Model - Sequelize model
 * @param {string} paramName - Request param name (default: 'id')
 * @param {string} reqKey - Key to attach entity to req (default: model name lowercase)
 * @param {Object} options - Query options
 * @returns {Function} Express middleware
 *
 * @example
 * router.get('/:id', loadEntity(User, 'id', 'user'), getUser);
 * // req.user will contain the loaded user
 */
const loadEntity = (Model, paramName = 'id', reqKey = null, options = {}) => {
    const modelName = Model.name || 'Entity';
    const key = reqKey || modelName.toLowerCase();

    return async (req, res, next) => {
        try {
            const id = req.params[paramName];
            const entity = await getById(Model, id, options);
            req[key] = entity;
            next();
        } catch (error) {
            next(error);
        }
    };
};

module.exports = {
    isValidUuid,
    validateUuid,
    getById,
    getByIdOrNull,
    getByIds,
    existsById,
    getByIdOrFail,
    createResolver,
    extractIdFromParams,
    loadEntity,
    UUID_REGEX,
};
