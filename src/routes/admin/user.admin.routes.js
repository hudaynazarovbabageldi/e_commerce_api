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
} = require('../../middlewares/Validate.middleware');
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

/**
 * @openapi
 * /v1/admin/users:
 *   get:
 *     tags:
 *       - Admin Users
 *     summary: List users (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [customer, vendor, admin]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Users retrieved successfully.
 */

router.get(
    '/',
    authenticate,
    authorize('admin'),
    apiLimiter,
    validate(getUsersSchema),
    userController.getUsers,
);

/**
 * @openapi
 * /v1/admin/users/{id}:
 *   get:
 *     tags:
 *       - Admin Users
 *     summary: Get user by id (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User retrieved successfully.
 */

router.get(
    '/:id',
    authenticate,
    validate(userIdSchema),
    userController.getUserById,
);

/**
 * @openapi
 * /v1/admin/users:
 *   post:
 *     tags:
 *       - Admin Users
 *     summary: Create user (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCreateRequest'
 *     responses:
 *       201:
 *         description: User created successfully.
 */

router.post(
    '/',
    authenticate,
    authorize('admin'),
    validate(createUserSchema),
    userController.createUser,
);

/**
 * @openapi
 * /v1/admin/users/{id}:
 *   put:
 *     tags:
 *       - Admin Users
 *     summary: Update user (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdateRequest'
 *     responses:
 *       200:
 *         description: User updated successfully.
 */

router.put(
    '/:id',
    authenticate,
    validate(updateUserSchema),
    userController.updateUser,
);

/**
 * @openapi
 * /v1/admin/users/{id}:
 *   delete:
 *     tags:
 *       - Admin Users
 *     summary: Delete user (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User deleted successfully.
 */

router.delete(
    '/:id',
    authenticate,
    authorize('admin'),
    validate(userIdSchema),
    userController.deleteUser,
);

/**
 * @openapi
 * /v1/admin/users/{id}/deactivate:
 *   post:
 *     tags:
 *       - Admin Users
 *     summary: Deactivate user (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User deactivated successfully.
 */

router.post(
    '/:id/deactivate',
    authenticate,
    authorize('admin'),
    validate(userIdSchema),
    userController.deactivateUser,
);

/**
 * @openapi
 * /v1/admin/users/{id}/activate:
 *   post:
 *     tags:
 *       - Admin Users
 *     summary: Activate user (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User activated successfully.
 */

router.post(
    '/:id/activate',
    authenticate,
    authorize('admin'),
    validate(userIdSchema),
    userController.activateUser,
);

/**
 * @openapi
 * /v1/admin/users/{id}/orders:
 *   get:
 *     tags:
 *       - Admin Users
 *     summary: List user orders (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Orders retrieved successfully.
 */

router.get(
    '/:id/orders',
    authenticate,
    validate({
        params: Joi.object({ id: commonSchemas.uuid }),
        query: commonSchemas.pagination,
    }),
    userController.getUserOrders,
);

/**
 * @openapi
 * /v1/admin/users/{id}/reviews:
 *   get:
 *     tags:
 *       - Admin Users
 *     summary: List user reviews (admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully.
 */

router.get(
    '/:id/reviews',
    validate({
        params: Joi.object({ id: commonSchemas.uuid }),
        query: commonSchemas.pagination,
    }),
    userController.getUserReviews,
);

/**
 * @openapi
 * /v1/admin/users/{id}/addresses:
 *   get:
 *     tags:
 *       - Admin Users
 *     summary: List user addresses (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Addresses retrieved successfully.
 */

router.get(
    '/:id/addresses',
    authenticate,
    validate(userIdSchema),
    userController.getUserAddresses,
);

/**
 * @openapi
 * /v1/admin/users/{id}/stats:
 *   get:
 *     tags:
 *       - Admin Users
 *     summary: Get user statistics (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully.
 */

router.get(
    '/:id/stats',
    authenticate,
    authorize('admin'),
    validate(userIdSchema),
    userController.getUserStats,
);

/**
 * @openapi
 * /v1/admin/users/{id}/role:
 *   put:
 *     tags:
 *       - Admin Users
 *     summary: Change user role (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRoleUpdateRequest'
 *     responses:
 *       200:
 *         description: User role updated successfully.
 */

router.put(
    '/:id/role',
    authenticate,
    authorize('admin'),
    validate(changeRoleSchema),
    userController.changeUserRole,
);

module.exports = router;
