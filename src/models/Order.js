const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
    class Order extends Model {
        toJSON() {
            const values = { ...this.get() };

            values.isCompleted = ['delivered', 'refunded'].includes(
                values.status,
            );
            values.isCancellable = ['pending', 'confirmed'].includes(
                values.status,
            );
            values.isRefundable = ['delivered'].includes(values.status);

            return values;
        }

        calculateTotal() {
            this.total = (
                parseFloat(this.subtotal) +
                parseFloat(this.tax) +
                parseFloat(this.shippingCost) -
                parseFloat(this.discount)
            ).toFixed(2);
        }

        canBeCancelled() {
            return ['pending', 'confirmed'].includes(this.status);
        }

        canBeRefunded() {
            return this.status === 'delivered' && this.paymentStatus === 'paid';
        }

        async markAsPaid() {
            this.paymentStatus = 'paid';
            if (this.status === 'pending') {
                this.status = 'confirmed';
            }
            await this.save();
        }

        async markAsShipped(trackingNumber, trackingUrl) {
            this.status = 'shipped';
            this.shippedAt = new Date();
            if (trackingNumber) this.trackingNumber = trackingNumber;
            if (trackingUrl) this.trackingUrl = trackingUrl;
            await this.save();
        }

        async markAsDelivered() {
            this.status = 'delivered';
            this.deliveredAt = new Date();
            await this.save();
        }

        async cancel(reason) {
            if (!this.canBeCancelled()) {
                throw new Error('Order cannot be cancelled in current status');
            }

            this.status = 'cancelled';
            this.cancelledAt = new Date();
            this.cancellationReason = reason;

            await this.save();
        }

        async refund(amount, reason) {
            if (!this.canBeRefunded()) {
                throw new Error('Order cannot be refunded');
            }

            this.status = 'refunded';
            this.paymentStatus =
                amount >= this.total ? 'refunded' : 'partially_refunded';

            this.refundedAt = new Date();
            this.refundAmount = amount;
            this.refundReason = reason;

            await this.save();
        }

        // ========================
        // Static Methods
        // ========================

        static async findByOrderNumber(orderNumber) {
            return await this.findOne({ where: { orderNumber } });
        }

        static async findByUser(userId, options = {}) {
            const { limit = 10, offset = 0 } = options;

            return await this.findAll({
                where: { userId },
                limit,
                offset,
                order: [['createdAt', 'DESC']],
            });
        }

        static async findPending() {
            return await this.findAll({
                where: { status: 'pending' },
                order: [['createdAt', 'ASC']],
            });
        }

        static async calculateRevenue(startDate, endDate) {
            const { Op } = require('sequelize');

            const result = await this.sum('total', {
                where: {
                    status: 'delivered',
                    paymentStatus: 'paid',
                    createdAt: {
                        [Op.between]: [startDate, endDate],
                    },
                },
            });

            return result || 0;
        }
    }

    Order.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },

            orderNumber: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
                field: 'order_number',
            },

            userId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'user_id',
                references: {
                    model: 'users',
                    key: 'id',
                },
            },

            status: {
                type: DataTypes.ENUM(
                    'pending',
                    'confirmed',
                    'processing',
                    'shipped',
                    'delivered',
                    'cancelled',
                    'refunded',
                    'failed',
                ),
                defaultValue: 'pending',
                allowNull: false,
            },

            paymentStatus: {
                type: DataTypes.ENUM(
                    'pending',
                    'paid',
                    'failed',
                    'refunded',
                    'partially_refunded',
                ),
                defaultValue: 'pending',
                allowNull: false,
                field: 'payment_status',
            },

            paymentMethod: {
                type: DataTypes.STRING(50),
                field: 'payment_method',
            },

            shippingMethod: {
                type: DataTypes.STRING(50),
                field: 'shipping_method',
            },

            subtotal: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },

            tax: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0,
            },

            shippingCost: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0,
                field: 'shipping_cost',
            },

            discount: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0,
            },

            total: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },

            currency: {
                type: DataTypes.STRING(3),
                defaultValue: 'USD',
            },

            couponCode: {
                type: DataTypes.STRING(50),
                field: 'coupon_code',
            },

            notes: {
                type: DataTypes.TEXT,
            },

            customerNotes: {
                type: DataTypes.TEXT,
                field: 'customer_notes',
            },

            shippingAddress: {
                type: DataTypes.JSON,
                field: 'shipping_address',
            },

            billingAddress: {
                type: DataTypes.JSON,
                field: 'billing_address',
            },

            trackingNumber: {
                type: DataTypes.STRING(100),
                field: 'tracking_number',
            },

            trackingUrl: {
                type: DataTypes.STRING,
                field: 'tracking_url',
            },

            shippedAt: {
                type: DataTypes.DATE,
                field: 'shipped_at',
            },

            deliveredAt: {
                type: DataTypes.DATE,
                field: 'delivered_at',
            },

            cancelledAt: {
                type: DataTypes.DATE,
                field: 'cancelled_at',
            },

            refundedAt: {
                type: DataTypes.DATE,
                field: 'refunded_at',
            },

            refundAmount: {
                type: DataTypes.DECIMAL(10, 2),
                field: 'refund_amount',
            },

            refundReason: {
                type: DataTypes.TEXT,
                field: 'refund_reason',
            },

            ipAddress: {
                type: DataTypes.STRING(45),
                field: 'ip_address',
            },

            userAgent: {
                type: DataTypes.TEXT,
                field: 'user_agent',
            },
        },
        {
            sequelize,
            modelName: 'Order',
            tableName: 'orders',
            timestamps: true,
            underscored: true,

            indexes: [
                { unique: true, fields: ['order_number'] },
                { fields: ['user_id'] },
                { fields: ['status'] },
                { fields: ['payment_status'] },
                { fields: ['created_at'] },
                { fields: ['total'] },
            ],

            hooks: {
                beforeCreate: async (order) => {
                    if (!order.orderNumber) {
                        const timestamp = Date.now();
                        const random = Math.floor(Math.random() * 1000)
                            .toString()
                            .padStart(3, '0');

                        order.orderNumber = `ORD-${timestamp}-${random}`;
                    }
                },

                beforeUpdate: (order) => {
                    if (order.changed('status')) {
                        const now = new Date();

                        if (order.status === 'shipped' && !order.shippedAt) {
                            order.shippedAt = now;
                        }

                        if (
                            order.status === 'delivered' &&
                            !order.deliveredAt
                        ) {
                            order.deliveredAt = now;
                        }

                        if (
                            order.status === 'cancelled' &&
                            !order.cancelledAt
                        ) {
                            order.cancelledAt = now;
                        }
                    }

                    if (
                        order.changed('paymentStatus') &&
                        order.paymentStatus === 'refunded'
                    ) {
                        if (!order.refundedAt) {
                            order.refundedAt = new Date();
                        }
                    }
                },
            },
        },
    );

    return Order;
};
