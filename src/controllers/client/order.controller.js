const {
    Order,
    OrderItem,
    Product,
    User,
    Address,
    Cart,
    Payment,
    Inventory,
} = require('../../../models');
const { ApiError } = require('../../utils/ApiError');
const { ApiResponse } = require('../../utils/ApiResponse');
const { asyncHandler } = require('../../utils/asyncHandler');
const pagination = require('../../utils/pagination');
const logger = require('../../utils/logger');
const { sequelize } = require('../../../models');

/**
 * Get all orders
 * @route GET /api/orders
 */
const getOrders = asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination.validatePaginationParams(
        req.query,
    );

    const where = {};

    // Admin can see all, vendors see their products' orders, customers see their own
    if (req.user.role === 'customer') {
        where.userId = req.user.id;
    }

    // Filter by status
    if (req.query.status) {
        where.status = req.query.status;
    }

    // Filter by payment status
    if (req.query.paymentStatus) {
        where.paymentStatus = req.query.paymentStatus;
    }

    const { rows: orders, count } = await Order.findAndCountAll({
        where,
        include: [
            {
                model: User,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email'],
            },
        ],
        limit,
        offset,
        order: [['createdAt', 'DESC']],
    });

    const response = pagination.createPaginatedResponse(
        orders,
        count,
        page,
        limit,
    );

    res.json(
        new ApiResponse(200, response.data, 'Orders retrieved successfully', {
            pagination: response.pagination,
        }),
    );
});

/**
 * Get order by ID
 * @route GET /api/orders/:id
 */
const getOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const order = await Order.findByPk(id, {
        include: [
            {
                model: User,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
            },
            {
                model: OrderItem,
                as: 'items',
                include: [
                    {
                        model: Product,
                        as: 'product',
                        attributes: [
                            'id',
                            'name',
                            'slug',
                            'images',
                            'isActive',
                        ],
                    },
                ],
            },
            {
                model: Payment,
                as: 'payments',
            },
        ],
    });

    if (!order) {
        throw new ApiError(404, 'Order not found');
    }

    // Check permissions
    if (req.user.role === 'customer' && order.userId !== req.user.id) {
        throw new ApiError(403, 'Access denied');
    }

    res.json(new ApiResponse(200, order, 'Order retrieved successfully'));
});

/**
 * Create order from cart
 * @route POST /api/orders
 */
const createOrder = asyncHandler(async (req, res) => {
    const {
        shippingAddressId,
        billingAddressId,
        paymentMethod,
        shippingMethod,
        customerNotes,
    } = req.body;

    const transaction = await sequelize.transaction();

    try {
        // Get user's cart
        const cart = await Cart.findByUser(req.user.id);
        if (!cart || cart.isEmpty()) {
            throw new ApiError(400, 'Cart is empty');
        }

        // Get cart items with products
        const cartItems = await cart.getItems({
            include: [
                {
                    model: Product,
                    as: 'product',
                },
            ],
            transaction,
        });

        if (cartItems.length === 0) {
            throw new ApiError(400, 'No items in cart');
        }

        // Verify stock availability and reserve inventory
        for (const item of cartItems) {
            const product = item.product;

            if (!product.isActive) {
                throw new ApiError(
                    400,
                    `Product ${product.name} is no longer available`,
                );
            }

            if (!product.isDigital && product.stock < item.quantity) {
                throw new ApiError(
                    400,
                    `Insufficient stock for ${product.name}`,
                );
            }

            // Reserve inventory
            if (!product.isDigital) {
                const inventory = await Inventory.findOne({
                    where: { productId: product.id },
                    transaction,
                });

                if (inventory) {
                    await inventory.reserve(item.quantity);
                }
            }
        }

        // Get addresses
        const shippingAddress = await Address.findByPk(shippingAddressId, {
            transaction,
        });
        const billingAddress = billingAddressId
            ? await Address.findByPk(billingAddressId, { transaction })
            : shippingAddress;

        if (!shippingAddress || !billingAddress) {
            throw new ApiError(404, 'Address not found');
        }

        // Calculate totals
        const subtotal = cartItems.reduce(
            (sum, item) => sum + parseFloat(item.subtotal),
            0,
        );
        const tax = cartItems.reduce(
            (sum, item) => sum + parseFloat(item.tax),
            0,
        );
        const shippingCost = 10.0; // TODO: Calculate based on shipping method
        const discount = parseFloat(cart.discount) || 0;
        const total = subtotal + tax + shippingCost - discount;

        // Create order
        const order = await Order.create(
            {
                userId: req.user.id,
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
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            },
            { transaction },
        );

        // Create order items
        const orderItems = await Promise.all(
            cartItems.map((item) => {
                const product = item.product;
                return OrderItem.create(
                    {
                        orderId: order.id,
                        productId: product.id,
                        productName: product.name,
                        productSku: product.sku,
                        productImage: product.thumbnail,
                        quantity: item.quantity,
                        price: item.price,
                        comparePrice: item.comparePrice,
                        discount: item.discount,
                        tax: item.tax,
                        subtotal: item.subtotal,
                        total: item.total,
                        weight: product.weight,
                        isDigital: product.isDigital,
                        downloadUrl: product.downloadUrl,
                    },
                    { transaction },
                );
            }),
        );

        // Clear cart
        await cart.clear({ transaction });

        // Commit transaction
        await transaction.commit();

        logger.logBusinessEvent('order_created', {
            orderId: order.id,
            userId: req.user.id,
            total: order.total,
            itemCount: orderItems.length,
        });

        // Load order with relations
        const createdOrder = await Order.findByPk(order.id, {
            include: [
                {
                    model: OrderItem,
                    as: 'items',
                },
            ],
        });

        res.status(201).json(
            new ApiResponse(201, createdOrder, 'Order created successfully'),
        );
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
});

/**
 * Update order status
 * @route PATCH /api/orders/:id/status
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
        throw new ApiError(404, 'Order not found');
    }

    const validStatuses = [
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
    ];
    if (!validStatuses.includes(status)) {
        throw new ApiError(400, 'Invalid status');
    }

    order.status = status;
    await order.save();

    logger.logBusinessEvent('order_status_updated', {
        orderId: id,
        status,
        updatedBy: req.user.id,
    });

    res.json(new ApiResponse(200, order, 'Order status updated successfully'));
});

/**
 * Cancel order
 * @route POST /api/orders/:id/cancel
 */
const cancelOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findByPk(id, {
        include: [{ model: OrderItem, as: 'items' }],
    });

    if (!order) {
        throw new ApiError(404, 'Order not found');
    }

    // Check permissions
    if (req.user.role === 'customer' && order.userId !== req.user.id) {
        throw new ApiError(403, 'Access denied');
    }

    if (!order.canBeCancelled()) {
        throw new ApiError(400, 'Order cannot be cancelled in current status');
    }

    const transaction = await sequelize.transaction();

    try {
        // Release reserved inventory
        for (const item of order.items) {
            const inventory = await Inventory.findOne({
                where: { productId: item.productId },
                transaction,
            });

            if (inventory) {
                await inventory.release(item.quantity);
            }
        }

        // Cancel order
        await order.cancel(reason);

        await transaction.commit();

        logger.logBusinessEvent('order_cancelled', {
            orderId: id,
            cancelledBy: req.user.id,
            reason,
        });

        res.json(new ApiResponse(200, order, 'Order cancelled successfully'));
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
});

/**
 * Mark order as shipped
 * @route POST /api/orders/:id/ship
 */
const shipOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { trackingNumber, trackingUrl } = req.body;

    const order = await Order.findByPk(id, {
        include: [{ model: OrderItem, as: 'items' }],
    });

    if (!order) {
        throw new ApiError(404, 'Order not found');
    }

    const transaction = await sequelize.transaction();

    try {
        // Deduct inventory
        for (const item of order.items) {
            if (!item.isDigital) {
                const inventory = await Inventory.findOne({
                    where: { productId: item.productId },
                    transaction,
                });

                if (inventory) {
                    await inventory.deduct(item.quantity);
                }

                // Update product sold count
                const product = await Product.findByPk(item.productId, {
                    transaction,
                });
                if (product) {
                    await product.incrementSoldCount(item.quantity);
                }
            }
        }

        // Mark as shipped
        await order.markAsShipped(trackingNumber, trackingUrl);

        await transaction.commit();

        logger.logBusinessEvent('order_shipped', {
            orderId: id,
            trackingNumber,
            shippedBy: req.user.id,
        });

        res.json(new ApiResponse(200, order, 'Order marked as shipped'));
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
});

/**
 * Mark order as delivered
 * @route POST /api/orders/:id/deliver
 */
const deliverOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const order = await Order.findByPk(id);
    if (!order) {
        throw new ApiError(404, 'Order not found');
    }

    await order.markAsDelivered();

    logger.logBusinessEvent('order_delivered', {
        orderId: id,
        deliveredBy: req.user.id,
    });

    res.json(new ApiResponse(200, order, 'Order marked as delivered'));
});

module.exports = {
    getOrders,
    getOrder,
    createOrder,
    updateOrderStatus,
    cancelOrder,
    shipOrder,
    deliverOrder,
};
