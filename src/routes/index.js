const router = require('express').Router();
const clientRoutes = require('./client');
const adminRoutes = require('./admin');

router.get('/v1/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});

router.get('/v1', (req, res) => {
    res.json({
        success: true,
        message: 'E-Commerce API',
        version: '1.0.0',
        endpoints: {
            client: {
                auth: '/api/v1/auth',
                users: '/api/v1/users',
                banners: '/api/v1/banners',
            },
            admin: {
                auth: '/api/v1/admin/auth',
                users: '/api/v1/admin/users',
                banners: '/api/v1/admin/banners',
                categories: '/api/v1/admin/categories',
                products: '/api/v1/admin/products',
                orders: '/api/v1/admin/orders',
                brands: 'api/v1/admin/brands',
            },
        },
    });
});

router.use('/v1/admin', adminRoutes);
router.use('/v1', clientRoutes);

module.exports = router;
