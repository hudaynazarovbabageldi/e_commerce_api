const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const cartRoutes = require('./cart.routes');
const bannerRoutes = require('./banner.routes');
const categoryRoutes = require('./category.routes');
const productRoutes = require('./product.routes');

// Public — no JWT needed
router.use('/auth', authRoutes);

router.use('/users', userRoutes);
router.use('/cart', cartRoutes);
router.use('/banners', bannerRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);

// router.use('/orders',  orderRoutes);

module.exports = router;
