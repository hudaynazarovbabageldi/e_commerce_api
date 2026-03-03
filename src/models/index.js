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

// Define associations

// User associations

// Export models and sequelize instance
module.exports = {
    sequelize,
    Sequelize,
    User,
    Banner,
};
