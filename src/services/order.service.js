const {
    Order,
    OrderItem,
    Cart,
    CartItem,
    Product,
    Address,
    Inventory,
    User,
} = require('../models');
const { ApiError } = require('../utils/ApiError');
const logger = require('../utils/logger');
const { sequelize } = require('../models');
const emailService = require('./email.service');

class OrderService {
    async createOrderFromCart(userId, orderData) {
        const {
            shippingAddressId,
            billingAddressId,
            paymentMethod,
            shippingMethod,
            customerNotes,
        } = orderData;
        const transaction = await sequelize.transaction();

        try {
            const cart = await Cart.findOne({ where: { userId } });
            if (!cart || cart.itemCount === 0)
                throw new ApiError(400, 'Cart is empty');

            const cartItems = await CartItem.findAll({
                where: { cartId: cart.id },
                include: [{ model: Product, as: 'product' }],
                transaction,
            });

            for (const item of cartItems) {
                const product = item.product;
                if (!product.isActive)
                    throw new ApiError(
                        400,
                        `Product ${product.name} is no longer available`
                    );

                if (!product.isDigital) {
                    const inventory = await Inventory.findOne({
                        where: { productId: product.id },
                        transaction,
                    });
                    if (!inventory || inventory.available < item.quantity) {
                        throw new ApiError(
                            400,
                            `Insufficient stock for ${product.name}`
                        );
                    }
                    await inventory.reserve(item.quantity);
                }
            }

            const shippingAddress = await Address.findByPk(shippingAddressId, {
                transaction,
            });
            const billingAddress = billingAddressId
                ? await Address.findByPk(billingAddressId, { transaction })
                : shippingAddress;

            if (!shippingAddress || !billingAddress)
                throw new ApiError(404, 'Address not found');

            const subtotal = cartItems.reduce(
                (sum, item) => sum + parseFloat(item.subtotal),
                0
            );
            const tax = cartItems.reduce(
                (sum, item) => sum + parseFloat(item.tax),
                0
            );
            const shippingCost = this.calculateShippingCost(
                shippingMethod,
                subtotal
            );
            const discount = parseFloat(cart.discount) || 0;
            const total = subtotal + tax + shippingCost - discount;

            const order = await Order.create(
                {
                    userId,
                    status: 'pending',
                    paymentStatus: 'pending',
                    paymentMethod,
                    shippingMethod,
                    subtotal,
                    tax,
                    shippingCost,
                    discount,
                    total,
                    shippingAddressId,
                    billingAddressId,
                    shippingAddress: shippingAddress.toSnapshot(),
                    billingAddress: billingAddress.toSnapshot(),
                    customerNotes,
                    couponCode: cart.couponCode,
                },
                { transaction }
            );

            await Promise.all(
                cartItems.map(item =>
                    OrderItem.create(
                        {
                            orderId: order.id,
                            productId: item.product.id,
                            productName: item.product.name,
                            productSku: item.product.sku,
                            productImage: item.product.thumbnail,
                            quantity: item.quantity,
                            price: item.price,
                            comparePrice: item.comparePrice,
                            discount: item.discount,
                            tax: item.tax,
                            subtotal: item.subtotal,
                            total: item.total,
                            isDigital: item.product.isDigital,
                        },
                        { transaction }
                    )
                )
            );

            await CartItem.destroy({ where: { cartId: cart.id }, transaction });
            await cart.calculateTotals();
            await transaction.commit();

            logger.logBusinessEvent('order_created', {
                orderId: order.id,
                userId,
                total: order.total,
            });

            const user = await User.findByPk(userId);
            if (user) {
                const orderWithItems = await Order.findByPk(order.id, {
                    include: [{ model: OrderItem, as: 'items' }],
                });
                emailService
                    .sendOrderConfirmationEmail(user.email, orderWithItems)
                    .catch(err =>
                        logger.logError(
                            'Failed to send order confirmation email',
                            { error: err.message }
                        )
                    );
            }

            return order;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    calculateShippingCost(method, subtotal) {
        if (subtotal >= 100) return 0;
        const rates = { standard: 10, express: 20, overnight: 35 };
        return rates[method] || rates.standard;
    }

    async cancelOrder(orderId, reason) {
        const order = await Order.findByPk(orderId, {
            include: [{ model: OrderItem, as: 'items' }],
        });
        if (!order) throw new ApiError(404, 'Order not found');
        if (!order.canBeCancelled())
            throw new ApiError(
                400,
                'Order cannot be cancelled in current status'
            );

        const transaction = await sequelize.transaction();
        try {
            for (const item of order.items) {
                if (!item.isDigital) {
                    const inventory = await Inventory.findOne({
                        where: { productId: item.productId },
                        transaction,
                    });
                    if (inventory) await inventory.release(item.quantity);
                }
            }

            await order.cancel(reason);
            await transaction.commit();

            logger.logBusinessEvent('order_cancelled', { orderId, reason });

            const user = await User.findByPk(order.userId);
            if (user) {
                emailService
                    .sendOrderCancelledEmail(user.email, order)
                    .catch(err =>
                        logger.logError('Failed to send cancellation email', {
                            error: err.message,
                        })
                    );
            }

            return order;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async shipOrder(orderId, trackingNumber, trackingUrl) {
        const order = await Order.findByPk(orderId, {
            include: [{ model: OrderItem, as: 'items' }],
        });
        if (!order) throw new ApiError(404, 'Order not found');

        const transaction = await sequelize.transaction();
        try {
            for (const item of order.items) {
                if (!item.isDigital) {
                    const inventory = await Inventory.findOne({
                        where: { productId: item.productId },
                        transaction,
                    });
                    if (inventory) await inventory.deduct(item.quantity);

                    const product = await Product.findByPk(item.productId, {
                        transaction,
                    });
                    if (product)
                        await product.incrementSoldCount(item.quantity);
                }
            }

            await order.markAsShipped(trackingNumber, trackingUrl);
            await transaction.commit();

            logger.logBusinessEvent('order_shipped', {
                orderId,
                trackingNumber,
            });

            const user = await User.findByPk(order.userId);
            if (user) {
                emailService
                    .sendOrderShippedEmail(user.email, order)
                    .catch(err =>
                        logger.logError('Failed to send shipped email', {
                            error: err.message,
                        })
                    );
            }

            return order;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}

module.exports = new OrderService();
