const express = require('express');
const router = express.Router();
const Joi = require('joi');

const userController = require('../../controllers/admin/user.controller');
const {
    authenticate,
    authorize,
} = require('../../middlewares/auth.middleware');
const {
    validate,
    commonSchemas,
} = require('../../middlewares/validate.middleware');
const { apiLimiter } = require('../../middlewares/rateLimiter.middleware');

const createUserSchema = {
    body: Joi.object({
        email: commonSchemas.email,
        password: commonSchemas.password,
        firstName: Joi.string().min(2).max(50).required(),
        lastName: Joi.string().min(2).max(50).required(),
        phone: commonSchemas.phone.optional(),
        role: Joi.string().valid('customer', 'vendor', 'admin').optional(),
        isActive: commonSchemas.boolean,
    }),
};

const updateUserSchema = {
    params: Joi.object({
        id: commonSchemas.uuid,
    }),
    body: Joi.object({
        firstName: Joi.string().min(2).max(50),
        lastName: Joi.string().min(2).max(50),
        phone: commonSchemas.phone,
        dateOfBirth: Joi.date().iso().max('now'),
        avatar: commonSchemas.url,
        role: Joi.string().valid('customer', 'vendor', 'admin'),
        isActive: commonSchemas.boolean,
        emailVerified: commonSchemas.boolean,
    }).min(1),
};

const changeRoleSchema = {
    params: Joi.object({
        id: commonSchemas.uuid,
    }),
    body: Joi.object({
        role: Joi.string().valid('customer', 'vendor', 'admin').required(),
    }),
};

const getUsersSchema = {
    query: Joi.object({
        ...commonSchemas.pagination,
        role: Joi.string().valid('customer', 'vendor', 'admin'),
        isActive: commonSchemas.boolean,
        search: commonSchemas.search,
    }),
};

const userIdSchema = {
    params: Joi.object({
        id: commonSchemas.uuid,
    }),
};

router.get(
    '/',
    authenticate,
    authorize('admin'),
    apiLimiter,
    validate(getUsersSchema),
    userController.getUsers,
);

router.get(
    '/:id',
    authenticate,
    validate(userIdSchema),
    userController.getUserById,
);

router.delete(
    '/:id',
    authenticate,
    authorize('admin'),
    validate(userIdSchema),
    userController.deleteUser,
);

module.exports = router;
