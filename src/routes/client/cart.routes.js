const express = require('express');
const router = express.Router();
const Joi = require('joi');

const cartController = require('../../controllers/client/cart.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const {
    validate,
    commonSchemas,
} = require('../../middlewares/Validate.middleware');

const addToCartSchema = {
    body: Joi.object({
        productId: commonSchemas.uuid,
        quantity: Joi.number().integer().min(1).default(1),
    }),
};

const updateCartItemSchema = {
    params: Joi.object({
        itemId: commonSchemas.uuid,
    }),
    body: Joi.object({
        quantity: Joi.number().integer().min(1).required(),
    }),
};

const cartItemIdSchema = {
    params: Joi.object({
        itemId: commonSchemas.uuid,
    }),
};

const applyCouponSchema = {
    body: Joi.object({
        couponCode: Joi.string().required(),
    }),
};

const syncCartSchema = {
    body: Joi.object({
        items: Joi.array()
            .items(
                Joi.object({
                    productId: commonSchemas.uuid,
                    quantity: Joi.number().integer().min(1).required(),
                }),
            )
            .required(),
    }),
};

/**
 * Routes
 */

// @route   GET /api/cart
// @desc    Get user's cart
// @access  Private
router.get('/', authenticate, cartController.getCart);

// @route   POST /api/cart/items
// @desc    Add item to cart
// @access  Private
router.post(
    '/items',
    authenticate,
    validate(addToCartSchema),
    cartController.addToCart,
);

// @route   PUT /api/cart/items/:itemId
// @desc    Update cart item quantity
// @access  Private
router.put(
    '/items/:itemId',
    authenticate,
    validate(updateCartItemSchema),
    cartController.updateCartItem,
);

// @route   DELETE /api/cart/items/:itemId
// @desc    Remove item from cart
// @access  Private
router.delete(
    '/items/:itemId',
    authenticate,
    validate(cartItemIdSchema),
    cartController.removeFromCart,
);

// @route   DELETE /api/cart
// @desc    Clear cart
// @access  Private
router.delete('/', authenticate, cartController.clearCart);

// @route   POST /api/cart/coupon
// @desc    Apply coupon to cart
// @access  Private
router.post(
    '/coupon',
    authenticate,
    validate(applyCouponSchema),
    cartController.applyCoupon,
);

// @route   DELETE /api/cart/coupon
// @desc    Remove coupon from cart
// @access  Private
router.delete('/coupon', authenticate, cartController.removeCoupon);

// @route   POST /api/cart/items/:itemId/increment
// @desc    Increment item quantity
// @access  Private
router.post(
    '/items/:itemId/increment',
    authenticate,
    validate(cartItemIdSchema),
    cartController.incrementItem,
);

// @route   POST /api/cart/items/:itemId/decrement
// @desc    Decrement item quantity
// @access  Private
router.post(
    '/items/:itemId/decrement',
    authenticate,
    validate(cartItemIdSchema),
    cartController.decrementItem,
);

// @route   POST /api/cart/sync
// @desc    Sync guest cart with user cart
// @access  Private
router.post(
    '/sync',
    authenticate,
    validate(syncCartSchema),
    cartController.syncCart,
);

module.exports = router;
