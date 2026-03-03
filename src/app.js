const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const routes = require('./routes/index');
const errorHandler = require('./middlewares/Error.middleware');
const { ApiError } = require('./utils/ApiError');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

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

// API routes
app.use('/api', routes);

// 404 handler
app.use((req, res, next) => {
    next(new ApiError(404, 'Route not found'));
});

console.log('errorHandler: ', errorHandler);
// Error handler
app.use(errorHandler.errorHandler);

module.exports = app;
