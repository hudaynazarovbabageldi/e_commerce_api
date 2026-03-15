const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const routes = require('./routes/index');
const errorHandler = require('./middlewares/Error.middleware');
const { ApiError } = require('./utils/ApiError');
const config = require('./config/env');
const path = require('path');
const app = express();

const configuredOrigins = (process.env.CORS_ORIGINS || config.frontendUrl || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            callback(null, true);
            return;
        }

        const isConfigured = configuredOrigins.includes(origin);
        const isLocalhostDev =
            config.env !== 'production' &&
            /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

        if (isConfigured || isLocalhostDev) {
            callback(null, true);
            return;
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'x-file-name',
    ],
};

// Security middleware
app.use(helmet());
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined'));

// Compression
app.use(compression());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// uploads:
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api', routes);

// 404 handler
app.use((req, res, next) => {
    next(new ApiError(404, 'Route not found'));
});

// Error handler
app.use(errorHandler.corsErrorHandler);
app.use(errorHandler.errorHandler);

module.exports = app;
