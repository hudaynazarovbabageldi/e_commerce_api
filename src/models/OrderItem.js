'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class OrderItem extends Model {
        calculateTotal() {
            this.total = (this.quantity * this.price).toFixed(2);
        }
    }

    OrderItem.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            orderId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'order_id',
                references: {
                    model: 'orders',
                    key: 'id',
                },
            },
            productId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'product_id',
                references: {
                    model: 'products',
                    key: 'id',
                },
            },
            quantity: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: {
                    min: {
                        args: [1],
                        msg: 'Quantity must be at least 1',
                    },
                },
            },
            price: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Price must be >= 0',
                    },
                },
            },
            total: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Total must be >= 0',
                    },
                },
            },
            discount: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Discount must be >= 0',
                    },
                },
            },
            tax: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0,
                validate: {
                    min: {
                        args: [0],
                        msg: 'Tax must be >= 0',
                    },
                },
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
        },
        {
            sequelize,
            modelName: 'OrderItem',
            tableName: 'order_items',
            timestamps: true,
            underscored: true,
            indexes: [{ fields: ['order_id'] }, { fields: ['product_id'] }],
        },
    );

    return OrderItem;
};
