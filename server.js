const app = require('./src/app');
const { sequelize } = require('./src/models');
const logger = require('./src/utils/logger');
const config = require('./src/config/env');
const { getRedisClient, closeRedis } = require('./src/config/redis');

const PORT = config.port || 5000;

const startServer = async () => {
    try {
        getRedisClient();

        // Test database connection
        await sequelize.authenticate();
        logger.info('Database connection established successfully');

        // Sync models (use migrations in production)
        if (config.env === 'development') {
            await sequelize.sync({ alter: true });
            logger.info('Database models synchronized');
        }

        // Start server
        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT} in ${config.env} mode`);
        });
    } catch (error) {
        logger.error('Unable to start server:', error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing server...');
    await closeRedis();
    await sequelize.close();
    process.exit(0);
});

startServer();
