const { Cart, CartItem, Product } = require('../models');
const { ApiError } = require('../utils/ApiError');
const logger = require('../utils/logger');

class CartService {
    async addToCart(userId, productId, quantity = 1) {
        let cart = await Cart.findOne({ where: { userId } });
        if (!cart) cart = await Cart.create({ userId });

        const product = await Product.findByPk(productId);
        if (!product || !product.isActive) {
            throw new ApiError(404, 'Product not found or unavailable');
        }

        if (!product.isDigital && product.stock < quantity) {
            throw new ApiError(400, `Only ${product.stock} items available`);
        }

        let cartItem = await CartItem.findOne({
            where: { cartId: cart.id, productId },
        });

        if (cartItem) {
            const newQuantity = cartItem.quantity + quantity;
            if (!product.isDigital && product.stock < newQuantity) {
                throw new ApiError(
                    400,
                    `Only ${product.stock} items available`,
                );
            }
            await cartItem.updateQuantity(newQuantity);
        } else {
            cartItem = await CartItem.create({
                cartId: cart.id,
                productId,
                quantity,
                price: product.price,
                comparePrice: product.comparePrice,
            });
        }

        await cart.calculateTotals();
        logger.logBusinessEvent('item_added_to_cart', {
            userId,
            productId,
            quantity,
        });

        return cartItem;
    }

    async getCart(userId) {
        let cart = await Cart.findOne({ where: { userId } });
        if (!cart) cart = await Cart.create({ userId });

        const items = await CartItem.findAll({
            where: { cartId: cart.id },
            include: [{ model: Product, as: 'product' }],
        });

        return { ...cart.toJSON(), items };
    }

    async clearCart(userId) {
        const cart = await Cart.findOne({ where: { userId } });
        if (cart) {
            await cart.clear();
            logger.logBusinessEvent('cart_cleared', { userId });
        }
    }

    async removeItem(userId, cartItemId) {
        const cartItem = await CartItem.findByPk(cartItemId, {
            include: [{ model: Cart, as: 'cart', where: { userId } }],
        });

        if (!cartItem) throw new ApiError(404, 'Cart item not found');

        await cartItem.destroy();
        logger.logBusinessEvent('item_removed_from_cart', {
            userId,
            cartItemId,
        });
    }
}

module.exports = new CartService();
