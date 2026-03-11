const { DataTypes, Model, Op } = require('sequelize');

module.exports = (sequelize) => {
    class Cart extends Model {
        // Instance methods
        toJSON() {
            const values = { ...this.get() };
            values.isEmpty = values.itemCount === 0;
            values.isExpired =
                values.expiresAt && new Date() > new Date(values.expiresAt);
            return values;
        }

        async calculateTotals() {
            const { CartItem } = sequelize.models;

            const items = await CartItem.findAll({
                where: { cartId: this.id },
            });

            this.subtotal = items
                .reduce((sum, item) => sum + parseFloat(item.subtotal), 0)
                .toFixed(2);

            this.tax = items
                .reduce((sum, item) => sum + parseFloat(item.tax), 0)
                .toFixed(2);

            this.total = (
                parseFloat(this.subtotal) +
                parseFloat(this.tax) -
                parseFloat(this.discount)
            ).toFixed(2);

            this.itemCount = items.reduce(
                (sum, item) => sum + item.quantity,
                0,
            );

            await this.save();
        }

        async clear() {
            const { CartItem } = sequelize.models;

            await CartItem.destroy({
                where: { cartId: this.id },
            });

            await this.calculateTotals();
        }

        isEmpty() {
            return this.itemCount === 0;
        }

        async applyCoupon(couponCode, discountAmount) {
            this.couponCode = couponCode;
            this.discount = discountAmount;

            this.total = (
                parseFloat(this.subtotal) +
                parseFloat(this.tax) -
                parseFloat(this.discount)
            ).toFixed(2);

            await this.save();
        }

        async removeCoupon() {
            this.couponCode = null;
            this.discount = 0;

            this.total = (
                parseFloat(this.subtotal) + parseFloat(this.tax)
            ).toFixed(2);

            await this.save();
        }

        // Static methods
        static async findByUser(userId) {
            return this.findOne({ where: { userId } });
        }

        static async findBySession(sessionId) {
            return this.findOne({ where: { sessionId } });
        }

        static async findOrCreateByUser(userId) {
            const [cart] = await this.findOrCreate({
                where: { userId },
                defaults: { userId },
            });

            return cart;
        }

        static async cleanupExpired() {
            return this.destroy({
                where: {
                    expiresAt: {
                        [Op.lt]: new Date(),
                    },
                },
            });
        }
    }

    Cart.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },

            userId: {
                type: DataTypes.UUID,
                allowNull: false,
                unique: true,
                field: 'user_id',
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },

            sessionId: {
                type: DataTypes.STRING(100),
                allowNull: true,
                field: 'session_id',
                comment: 'For guest carts',
            },

            subtotal: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0,
                allowNull: false,
            },

            tax: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0,
                allowNull: false,
            },

            discount: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0,
                allowNull: false,
            },

            total: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0,
                allowNull: false,
            },

            itemCount: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                field: 'item_count',
            },

            couponCode: {
                type: DataTypes.STRING(50),
                allowNull: true,
                field: 'coupon_code',
            },

            expiresAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'expires_at',
                comment: 'For guest carts',
            },
        },
        {
            sequelize,
            modelName: 'Cart',
            tableName: 'carts',
            timestamps: true,
            underscored: true,
            indexes: [
                { unique: true, fields: ['user_id'] },
                { fields: ['session_id'] },
                { fields: ['expires_at'] },
            ],
        },
    );

    return Cart;
};
