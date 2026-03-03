const { Payment, Order, User } = require('../../models');
const { ApiError } = require('../../utils/ApiError');
const { ApiResponse } = require('../../utils/ApiResponse');
const { asyncHandler } = require('../../utils/asyncHandler');
const pagination = require('../../utils/pagination');
const logger = require('../../utils/logger');

/**
 * Create payment
 * @route POST /api/payments
 */
const createPayment = asyncHandler(async (req, res) => {
    const { orderId, paymentMethod, paymentProvider, amount } = req.body;

    // Verify order exists and belongs to user
    const order = await Order.findByPk(orderId);
    if (!order) {
        throw new ApiError(404, 'Order not found');
    }

    if (order.userId !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError(403, 'Access denied');
    }

    if (order.paymentStatus === 'paid') {
        throw new ApiError(400, 'Order is already paid');
    }

    // Create payment record
    const payment = await Payment.create({
        orderId,
        userId: req.user.id,
        paymentMethod,
        paymentProvider,
        amount: amount || order.total,
        currency: order.currency,
        status: 'pending',
    });

    // TODO: Process payment with payment gateway
    // For now, simulate successful payment
    await payment.markAsPaid();
    await order.markAsPaid();

    logger.logPayment(orderId, payment.amount, 'completed', paymentProvider);

    res.status(201).json(
        new ApiResponse(201, payment, 'Payment processed successfully'),
    );
});

/**
 * Get payments
 * @route GET /api/payments
 */
const getPayments = asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination.validatePaginationParams(
        req.query,
    );

    const where = {};

    // Non-admin users can only see their own payments
    if (req.user.role !== 'admin') {
        where.userId = req.user.id;
    }

    // Filter by order
    if (req.query.orderId) {
        where.orderId = req.query.orderId;
    }

    // Filter by status
    if (req.query.status) {
        where.status = req.query.status;
    }

    const { rows: payments, count } = await Payment.findAndCountAll({
        where,
        include: [
            {
                model: Order,
                as: 'order',
                attributes: ['id', 'orderNumber', 'total', 'status'],
            },
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
        payments,
        count,
        page,
        limit,
    );

    res.json(
        new ApiResponse(200, response.data, 'Payments retrieved successfully', {
            pagination: response.pagination,
        }),
    );
});

/**
 * Get payment by ID
 * @route GET /api/payments/:id
 */
const getPayment = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const payment = await Payment.findByPk(id, {
        include: [
            {
                model: Order,
                as: 'order',
            },
            {
                model: User,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email'],
            },
        ],
    });

    if (!payment) {
        throw new ApiError(404, 'Payment not found');
    }

    // Check permissions
    if (req.user.role !== 'admin' && payment.userId !== req.user.id) {
        throw new ApiError(403, 'Access denied');
    }

    res.json(new ApiResponse(200, payment, 'Payment retrieved successfully'));
});

/**
 * Refund payment
 * @route POST /api/payments/:id/refund
 */
const refundPayment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, reason } = req.body;

    const payment = await Payment.findByPk(id, {
        include: [{ model: Order, as: 'order' }],
    });

    if (!payment) {
        throw new ApiError(404, 'Payment not found');
    }

    if (payment.status !== 'completed') {
        throw new ApiError(400, 'Only completed payments can be refunded');
    }

    const refundAmount = amount || payment.amount;

    if (refundAmount > payment.amount) {
        throw new ApiError(400, 'Refund amount cannot exceed payment amount');
    }

    // Refund payment
    await payment.refund(refundAmount);

    // Refund order
    await payment.order.refund(refundAmount, reason);

    logger.logPayment(
        payment.orderId,
        refundAmount,
        'refunded',
        payment.paymentProvider,
    );

    res.json(new ApiResponse(200, payment, 'Payment refunded successfully'));
});

module.exports = {
    createPayment,
    getPayments,
    getPayment,
    refundPayment,
};
