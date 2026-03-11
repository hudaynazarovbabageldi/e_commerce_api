const { Sequelize } = require('sequelize');
require('dotenv').config();

// Initialize Sequelize
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000,
        },
    },
);

// Import models
const User = require('./User')(sequelize);
const Banner = require('./Banner')(sequelize);
const Category = require('./Category')(sequelize);
const Product = require('./Product')(sequelize);
const Order = require('./Order')(sequelize);
const OrderItem = require('./OrderItem')(sequelize);

// Define associations

// Category self-referencing associations
Category.belongsTo(Category, {
    foreignKey: 'parentId',
    as: 'parent',
    allowNull: true,
});

Category.hasMany(Category, {
    foreignKey: 'parentId',
    as: 'children',
});

// Product associations
Product.belongsTo(Category, {
    foreignKey: 'categoryId',
    as: 'category',
});

Category.hasMany(Product, {
    foreignKey: 'categoryId',
    as: 'products',
});

// User associations

// Order associations
Order.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
});

User.hasMany(Order, {
    foreignKey: 'userId',
    as: 'orders',
});

// OrderItem associations
OrderItem.belongsTo(Order, {
    foreignKey: 'orderId',
    as: 'order',
});

Order.hasMany(OrderItem, {
    foreignKey: 'orderId',
    as: 'items',
});

OrderItem.belongsTo(Product, {
    foreignKey: 'productId',
    as: 'product',
});

Product.hasMany(OrderItem, {
    foreignKey: 'productId',
    as: 'orderItems',
});

// Export models and sequelize instance
module.exports = {
    sequelize,
    Sequelize,
    User,
    Banner,
    Category,
    Product,
    Order,
    OrderItem,
};
