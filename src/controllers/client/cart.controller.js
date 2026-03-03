const { Cart, CartItem, Product } = require('../../models');
const { ApiError } = require('../../utils/ApiError');
const { ApiResponse } = require('../../utils/ApiResponse');
const { asyncHandler } = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

/**
 * Get user's cart
 * @route GET /api/cart
 */
const getCart = asyncHandler(async (req, res) => {
    let cart = await Cart.findByUser(req.user.id);

    if (!cart) {
        // Create cart if doesn't exist
        cart = await Cart.create({ userId: req.user.id });
    }

    // Get cart items with product details
    const items = await CartItem.findAll({
        where: { cartId: cart.id },
        include: [
            {
                model: Product,
                as: 'product',
                attributes: [
                    'id',
                    'name',
                    'slug',
                    'sku',
                    'price',
                    'comparePrice',
                    'images',
                    'thumbnail',
                    'stock',
                    'isActive',
                    'isDigital',
                ],
            },
        ],
        order: [['createdAt', 'ASC']],
    });

    const cartData = {
        ...cart.toJSON(),
        items,
    };

    res.json(new ApiResponse(200, cartData, 'Cart retrieved successfully'));
});

/**
 * Add item to cart
 * @route POST /api/cart/items
 */
const addToCart = asyncHandler(async (req, res) => {
    const { productId, quantity = 1 } = req.body;

    // Find or create cart
    let cart = await Cart.findByUser(req.user.id);
    if (!cart) {
        cart = await Cart.create({ userId: req.user.id });
    }

    // Get product
    const product = await Product.findByPk(productId);
    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    if (!product.isActive) {
        throw new ApiError(400, 'Product is not available');
    }

    // Check stock
    if (!product.isDigital && product.stock < quantity) {
        throw new ApiError(
            400,
            `Only ${product.stock} items available in stock`,
        );
    }

    // Check if item already exists in cart
    let cartItem = await CartItem.findOne({
        where: { cartId: cart.id, productId },
    });

    if (cartItem) {
        // Update quantity
        const newQuantity = cartItem.quantity + quantity;

        if (!product.isDigital && product.stock < newQuantity) {
            throw new ApiError(
                400,
                `Only ${product.stock} items available in stock`,
            );
        }

        await cartItem.updateQuantity(newQuantity);
    } else {
        // Create new cart item
        cartItem = await CartItem.create({
            cartId: cart.id,
            productId,
            quantity,
            price: product.price,
            comparePrice: product.comparePrice,
        });
    }

    // Reload cart with items
    await cart.calculateTotals();

    logger.logBusinessEvent('item_added_to_cart', {
        userId: req.user.id,
        productId,
        quantity,
    });

    res.json(new ApiResponse(200, cartItem, 'Item added to cart successfully'));
});

/**
 * Update cart item quantity
 * @route PUT /api/cart/items/:itemId
 */
const updateCartItem = asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
        throw new ApiError(400, 'Quantity must be at least 1');
    }

    const cartItem = await CartItem.findByPk(itemId, {
        include: [
            {
                model: Cart,
                as: 'cart',
                where: { userId: req.user.id },
            },
            {
                model: Product,
                as: 'product',
            },
        ],
    });

    if (!cartItem) {
        throw new ApiError(404, 'Cart item not found');
    }

    // Check stock
    const product = cartItem.product;
    if (!product.isDigital && product.stock < quantity) {
        throw new ApiError(
            400,
            `Only ${product.stock} items available in stock`,
        );
    }

    await cartItem.updateQuantity(quantity);

    res.json(new ApiResponse(200, cartItem, 'Cart item updated successfully'));
});

/**
 * Remove item from cart
 * @route DELETE /api/cart/items/:itemId
 */
const removeFromCart = asyncHandler(async (req, res) => {
    const { itemId } = req.params;

    const cartItem = await CartItem.findByPk(itemId, {
        include: [
            {
                model: Cart,
                as: 'cart',
                where: { userId: req.user.id },
            },
        ],
    });

    if (!cartItem) {
        throw new ApiError(404, 'Cart item not found');
    }

    await cartItem.destroy();

    logger.logBusinessEvent('item_removed_from_cart', {
        userId: req.user.id,
        itemId,
    });

    res.json(new ApiResponse(200, null, 'Item removed from cart successfully'));
});

/**
 * Clear cart
 * @route DELETE /api/cart
 */
const clearCart = asyncHandler(async (req, res) => {
    const cart = await Cart.findByUser(req.user.id);

    if (!cart) {
        throw new ApiError(404, 'Cart not found');
    }

    await cart.clear();

    logger.logBusinessEvent('cart_cleared', {
        userId: req.user.id,
    });

    res.json(new ApiResponse(200, null, 'Cart cleared successfully'));
});

/**
 * Apply coupon to cart
 * @route POST /api/cart/coupon
 */
const applyCoupon = asyncHandler(async (req, res) => {
    const { couponCode } = req.body;

    const cart = await Cart.findByUser(req.user.id);
    if (!cart) {
        throw new ApiError(404, 'Cart not found');
    }

    // TODO: Validate coupon code against Coupon model
    // For now, apply a dummy discount
    const discountAmount = parseFloat(cart.subtotal) * 0.1; // 10% discount

    await cart.applyCoupon(couponCode, discountAmount);

    logger.logBusinessEvent('coupon_applied', {
        userId: req.user.id,
        couponCode,
        discount: discountAmount,
    });

    res.json(new ApiResponse(200, cart, 'Coupon applied successfully'));
});

/**
 * Remove coupon from cart
 * @route DELETE /api/cart/coupon
 */
const removeCoupon = asyncHandler(async (req, res) => {
    const cart = await Cart.findByUser(req.user.id);
    if (!cart) {
        throw new ApiError(404, 'Cart not found');
    }

    await cart.removeCoupon();

    logger.logBusinessEvent('coupon_removed', {
        userId: req.user.id,
    });

    res.json(new ApiResponse(200, cart, 'Coupon removed successfully'));
});

/**
 * Increment item quantity
 * @route POST /api/cart/items/:itemId/increment
 */
const incrementItem = asyncHandler(async (req, res) => {
    const { itemId } = req.params;

    const cartItem = await CartItem.findByPk(itemId, {
        include: [
            {
                model: Cart,
                as: 'cart',
                where: { userId: req.user.id },
            },
            {
                model: Product,
                as: 'product',
            },
        ],
    });

    if (!cartItem) {
        throw new ApiError(404, 'Cart item not found');
    }

    await cartItem.incrementQuantity();

    res.json(
        new ApiResponse(200, cartItem, 'Quantity incremented successfully'),
    );
});

/**
 * Decrement item quantity
 * @route POST /api/cart/items/:itemId/decrement
 */
const decrementItem = asyncHandler(async (req, res) => {
    const { itemId } = req.params;

    const cartItem = await CartItem.findByPk(itemId, {
        include: [
            {
                model: Cart,
                as: 'cart',
                where: { userId: req.user.id },
            },
        ],
    });

    if (!cartItem) {
        throw new ApiError(404, 'Cart item not found');
    }

    if (cartItem.quantity === 1) {
        // Remove item if quantity would be 0
        await cartItem.destroy();
        return res.json(new ApiResponse(200, null, 'Item removed from cart'));
    }

    await cartItem.decrementQuantity();

    res.json(
        new ApiResponse(200, cartItem, 'Quantity decremented successfully'),
    );
});

/**
 * Sync cart (merge guest cart with user cart)
 * @route POST /api/cart/sync
 */
const syncCart = asyncHandler(async (req, res) => {
    const { items } = req.body; // Array of { productId, quantity }

    let cart = await Cart.findByUser(req.user.id);
    if (!cart) {
        cart = await Cart.create({ userId: req.user.id });
    }

    // Add items from guest cart
    for (const item of items) {
        const product = await Product.findByPk(item.productId);
        if (!product || !product.isActive) continue;

        await CartItem.addOrUpdate(
            cart.id,
            item.productId,
            item.quantity,
            product.price,
        );
    }

    await cart.calculateTotals();

    res.json(new ApiResponse(200, cart, 'Cart synced successfully'));
});

module.exports = {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    applyCoupon,
    removeCoupon,
    incrementItem,
    decrementItem,
    syncCart,
};
