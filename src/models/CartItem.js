const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
    class CartItem extends Model {
        // Instance methods
        toJSON() {
            const values = { ...this.get() };

            values.unitPrice = values.price;
            values.lineTotal = values.total;

            values.discountPercentage =
                values.comparePrice && values.comparePrice > values.price
                    ? Math.round(
                          ((values.comparePrice - values.price) /
                              values.comparePrice) *
                              100,
                      )
                    : 0;

            return values;
        }

        calculateTotals() {
            this.subtotal = (parseFloat(this.price) * this.quantity).toFixed(2);

            this.total = (
                parseFloat(this.subtotal) +
                parseFloat(this.tax || 0) -
                parseFloat(this.discount || 0)
            ).toFixed(2);
        }

        async updateQuantity(quantity) {
            if (quantity < 1) {
                throw new Error('Quantity must be at least 1');
            }

            const { Product } = sequelize.models;

            const product = await Product.findByPk(this.productId);

            if (!product) {
                throw new Error('Product not found');
            }

            if (!product.isInStock()) {
                throw new Error('Product is out of stock');
            }

            if (product.stock < quantity) {
                throw new Error(
                    `Only ${product.stock} items available in stock`,
                );
            }

            this.quantity = quantity;
            this.calculateTotals();

            await this.save();
        }

        async incrementQuantity(amount = 1) {
            await this.updateQuantity(this.quantity + amount);
        }

        async decrementQuantity(amount = 1) {
            const newQuantity = this.quantity - amount;

            if (newQuantity < 1) {
                await this.destroy();
            } else {
                await this.updateQuantity(newQuantity);
            }
        }

        // Static methods
        static async findByCart(cartId) {
            return this.findAll({
                where: { cartId },
                order: [['createdAt', 'ASC']],
            });
        }

        static async findByCartAndProduct(cartId, productId) {
            return this.findOne({
                where: { cartId, productId },
            });
        }

        static async addOrUpdate(cartId, productId, quantity, price) {
            const existingItem = await this.findByCartAndProduct(
                cartId,
                productId,
            );

            if (existingItem) {
                await existingItem.updateQuantity(
                    existingItem.quantity + quantity,
                );

                return existingItem;
            }

            return this.create({
                cartId,
                productId,
                quantity,
                price,
            });
        }
    }

    CartItem.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },

            cartId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'cart_id',
                references: {
                    model: 'carts',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },

            productId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'product_id',
                references: {
                    model: 'products',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },

            quantity: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1,
                validate: {
                    min: {
                        args: [1],
                        msg: 'Quantity must be at least 1',
                    },
                    isInt: {
                        msg: 'Quantity must be an integer',
                    },
                },
            },

            price: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: 'Unit price at time of adding to cart',
                validate: {
                    min: {
                        args: [0],
                        msg: 'Price must be greater than or equal to 0',
                    },
                },
            },

            comparePrice: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                field: 'compare_price',
            },

            discount: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0,
                allowNull: false,
            },

            tax: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0,
                allowNull: false,
            },

            subtotal: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: 'price * quantity',
            },

            total: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: 'subtotal + tax - discount',
            },

            metadata: {
                type: DataTypes.JSON,
                allowNull: true,
                comment: 'Additional data like variants',
            },
        },
        {
            sequelize,
            modelName: 'CartItem',
            tableName: 'cart_items',
            timestamps: true,
            underscored: true,

            indexes: [
                { fields: ['cart_id'] },
                { fields: ['product_id'] },
                {
                    unique: true,
                    fields: ['cart_id', 'product_id'],
                    name: 'cart_product_unique',
                },
            ],

            hooks: {
                beforeValidate: (item) => {
                    if (item.price && item.quantity) {
                        item.subtotal = (
                            parseFloat(item.price) * item.quantity
                        ).toFixed(2);
                    }

                    if (item.subtotal !== undefined) {
                        item.total = (
                            parseFloat(item.subtotal) +
                            parseFloat(item.tax || 0) -
                            parseFloat(item.discount || 0)
                        ).toFixed(2);
                    }
                },

                afterCreate: async (item) => {
                    const { Cart } = sequelize.models;
                    const cart = await Cart.findByPk(item.cartId);

                    if (cart) {
                        await cart.calculateTotals();
                    }
                },

                afterUpdate: async (item) => {
                    const { Cart } = sequelize.models;
                    const cart = await Cart.findByPk(item.cartId);

                    if (cart) {
                        await cart.calculateTotals();
                    }
                },

                afterDestroy: async (item) => {
                    const { Cart } = sequelize.models;
                    const cart = await Cart.findByPk(item.cartId);

                    if (cart) {
                        await cart.calculateTotals();
                    }
                },
            },
        },
    );

    return CartItem;
};
