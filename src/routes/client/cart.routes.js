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

/**
 * @openapi
 * /v1/cart:
 *   get:
 *     tags:
 *       - Client Cart
 *     summary: Get current user's cart
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Cart'
 */

// @route   GET /api/cart
// @desc    Get user's cart
// @access  Private
router.get('/', authenticate, cartController.getCart);

/**
 * @openapi
 * /v1/cart/items:
 *   post:
 *     tags:
 *       - Client Cart
 *     summary: Add item to cart
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CartAddItemRequest'
 *     responses:
 *       200:
 *         description: Item added to cart successfully.
 */

// @route   POST /api/cart/items
// @desc    Add item to cart
// @access  Private
router.post(
    '/items',
    authenticate,
    validate(addToCartSchema),
    cartController.addToCart,
);

/**
 * @openapi
 * /v1/cart/items/{itemId}:
 *   put:
 *     tags:
 *       - Client Cart
 *     summary: Update cart item quantity
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CartUpdateItemRequest'
 *     responses:
 *       200:
 *         description: Cart item updated successfully.
 */

// @route   PUT /api/cart/items/:itemId
// @desc    Update cart item quantity
// @access  Private
router.put(
    '/items/:itemId',
    authenticate,
    validate(updateCartItemSchema),
    cartController.updateCartItem,
);

/**
 * @openapi
 * /v1/cart/items/{itemId}:
 *   delete:
 *     tags:
 *       - Client Cart
 *     summary: Remove item from cart
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Item removed from cart successfully.
 */

// @route   DELETE /api/cart/items/:itemId
// @desc    Remove item from cart
// @access  Private
router.delete(
    '/items/:itemId',
    authenticate,
    validate(cartItemIdSchema),
    cartController.removeFromCart,
);

/**
 * @openapi
 * /v1/cart:
 *   delete:
 *     tags:
 *       - Client Cart
 *     summary: Clear current user's cart
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared successfully.
 */

// @route   DELETE /api/cart
// @desc    Clear cart
// @access  Private
router.delete('/', authenticate, cartController.clearCart);

/**
 * @openapi
 * /v1/cart/coupon:
 *   post:
 *     tags:
 *       - Client Cart
 *     summary: Apply coupon to cart
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CartCouponRequest'
 *     responses:
 *       200:
 *         description: Coupon applied successfully.
 */

// @route   POST /api/cart/coupon
// @desc    Apply coupon to cart
// @access  Private
router.post(
    '/coupon',
    authenticate,
    validate(applyCouponSchema),
    cartController.applyCoupon,
);

/**
 * @openapi
 * /v1/cart/coupon:
 *   delete:
 *     tags:
 *       - Client Cart
 *     summary: Remove coupon from cart
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Coupon removed successfully.
 */

// @route   DELETE /api/cart/coupon
// @desc    Remove coupon from cart
// @access  Private
router.delete('/coupon', authenticate, cartController.removeCoupon);

/**
 * @openapi
 * /v1/cart/items/{itemId}/increment:
 *   post:
 *     tags:
 *       - Client Cart
 *     summary: Increment cart item quantity
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Quantity incremented successfully.
 */

// @route   POST /api/cart/items/:itemId/increment
// @desc    Increment item quantity
// @access  Private
router.post(
    '/items/:itemId/increment',
    authenticate,
    validate(cartItemIdSchema),
    cartController.incrementItem,
);

/**
 * @openapi
 * /v1/cart/items/{itemId}/decrement:
 *   post:
 *     tags:
 *       - Client Cart
 *     summary: Decrement cart item quantity
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Quantity decremented successfully.
 */

// @route   POST /api/cart/items/:itemId/decrement
// @desc    Decrement item quantity
// @access  Private
router.post(
    '/items/:itemId/decrement',
    authenticate,
    validate(cartItemIdSchema),
    cartController.decrementItem,
);

/**
 * @openapi
 * /v1/cart/sync:
 *   post:
 *     tags:
 *       - Client Cart
 *     summary: Sync guest cart items to user cart
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CartSyncRequest'
 *     responses:
 *       200:
 *         description: Cart synced successfully.
 */

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
