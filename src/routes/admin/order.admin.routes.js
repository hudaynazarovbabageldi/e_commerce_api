const express = require('express');
const router = express.Router();
const Joi = require('joi');

const orderController = require('../../controllers/admin/order.admin.controller');
const {
    authenticate,
    authorize,
} = require('../../middlewares/auth.middleware');
const {
    validate,
    commonSchemas,
} = require('../../middlewares/Validate.middleware');
const { apiLimiter } = require('../../middlewares/rateLimiter.middleware');

const createOrderSchema = {
    body: Joi.object({
        shippingAddressId: commonSchemas.uuid,
        billingAddressId: commonSchemas.uuid.optional(),
        paymentMethod: Joi.string().required(),
        shippingMethod: Joi.string(),
        customerNotes: Joi.string().max(500),
    }),
};

const updateStatusSchema = {
    params: Joi.object({
        id: commonSchemas.uuid,
    }),
    body: Joi.object({
        status: Joi.string()
            .valid(
                'pending',
                'confirmed',
                'processing',
                'shipped',
                'delivered',
                'cancelled',
            )
            .required(),
    }),
};

const cancelOrderSchema = {
    params: Joi.object({
        id: commonSchemas.uuid,
    }),
    body: Joi.object({
        reason: Joi.string().required(),
    }),
};

const shipOrderSchema = {
    params: Joi.object({
        id: commonSchemas.uuid,
    }),
    body: Joi.object({
        trackingNumber: Joi.string(),
        trackingUrl: commonSchemas.url,
    }),
};

const getOrdersSchema = {
    query: Joi.object({
        ...commonSchemas.pagination,
        status: Joi.string().valid(
            'pending',
            'confirmed',
            'processing',
            'shipped',
            'delivered',
            'cancelled',
            'refunded',
            'failed',
        ),
        paymentStatus: Joi.string().valid(
            'pending',
            'paid',
            'failed',
            'refunded',
            'partially_refunded',
        ),
    }),
};

const orderIdSchema = {
    params: Joi.object({
        id: commonSchemas.uuid,
    }),
};

/**
 * Routes
 */

// @route   GET /api/orders
// @desc    Get all orders
// @access  Private (Admin sees all, Customer sees own)
router.get(
    '/',
    authenticate,
    apiLimiter,
    validate(getOrdersSchema),
    orderController.getOrders,
);

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Private (Admin or Order Owner)
router.get(
    '/:id',
    authenticate,
    validate(orderIdSchema),
    orderController.getOrder,
);

// @route   POST /api/orders
// @desc    Create order from cart
// @access  Private
router.post(
    '/',
    authenticate,
    validate(createOrderSchema),
    orderController.createOrder,
);

// @route   PATCH /api/orders/:id/status
// @desc    Update order status
// @access  Private (Admin, Vendor)
router.patch(
    '/:id/status',
    authenticate,
    authorize('admin', 'vendor'),
    validate(updateStatusSchema),
    orderController.updateOrderStatus,
);

// @route   POST /api/orders/:id/cancel
// @desc    Cancel order
// @access  Private (Admin or Order Owner)
router.post(
    '/:id/cancel',
    authenticate,
    validate(cancelOrderSchema),
    orderController.cancelOrder,
);

// @route   POST /api/orders/:id/ship
// @desc    Mark order as shipped
// @access  Private (Admin, Vendor)
router.post(
    '/:id/ship',
    authenticate,
    authorize('admin', 'vendor'),
    validate(shipOrderSchema),
    orderController.shipOrder,
);

// @route   POST /api/orders/:id/deliver
// @desc    Mark order as delivered
// @access  Private (Admin, Vendor)
router.post(
    '/:id/deliver',
    authenticate,
    authorize('admin', 'vendor'),
    validate(orderIdSchema),
    orderController.deliverOrder,
);

module.exports = router;
