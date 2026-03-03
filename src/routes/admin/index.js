const express = require('express');
const router = express.Router();
const {
    authenticate,
    authorize,
} = require('../../middlewares/auth.middleware');

const authAdminRoutes = require('./auth.admin.routes');
const adminUserRoutes = require('./user.admin.routes');

// Public — no JWT needed
router.use('/auth', authAdminRoutes);
router.use('/users', adminUserRoutes);
// Protected — JWT required
router.use(authenticate);
router.use(authorize('admin'));
// router.use('/products',  adminProductRoutes);
// router.use('/orders',    adminOrderRoutes);
// router.use('/dashboard', adminDashboardRoutes);

module.exports = router;
