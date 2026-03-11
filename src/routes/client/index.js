const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const cartRoutes = require('./cart.routes');

// Public — no JWT needed
router.use('/auth', authRoutes);

// Protected — JWT required
router.use(authenticate);
router.use('/users', userRoutes);
router.use('/cart', cartRoutes);
// router.use('/orders',  orderRoutes);

module.exports = router;
