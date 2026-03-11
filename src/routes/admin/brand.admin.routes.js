const express = require('express');
const router = express.Router();

const adminBrandController = require('../../controllers/admin/brand.admin.controller');
const {
    authenticate,
    authorize,
} = require('../../middlewares/auth.middleware');
const { apiLimiter } = require('../../middlewares/rateLimiter.middleware');

router.get(
    '/',
    authenticate,
    authorize('admin'),
    apiLimiter,
    adminBrandController.getBrands,
);

router.get('/:id', authenticate, adminBrandController.getBrandById);
router.post('/', authenticate, adminBrandController.createBrand);
router.put('/:id', authenticate, adminBrandController.updateBrand);
router.delete('/:id', authenticate, adminBrandController.deleteBrand);

module.exports = router;
