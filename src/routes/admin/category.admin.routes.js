const express = require('express');
const router = express.Router();

const adminCategoryController = require('../../controllers/admin/category.admin.controller');
const {
    authenticate,
    authorize,
} = require('../../middlewares/auth.middleware');
const {
    validate,
    commonSchemas,
} = require('../../middlewares/validate.middleware');
const { apiLimiter } = require('../../middlewares/rateLimiter.middleware');

router.get(
    '/',
    authenticate,
    authorize('admin'),
    apiLimiter,
    adminCategoryController.getCategories,
);

router.get('/:id', authenticate, adminCategoryController.getCategoryById);
router.post('/', authenticate, adminCategoryController.createCategory);
router.put('/:id', authenticate, adminCategoryController.updateCategory);
router.delete('/:id', authenticate, adminCategoryController.deleteCategory);

router.get(
    '/:id/products',
    authenticate,
    adminCategoryController.getCategoryProducts,
);

module.exports = router;

//    getCategories,
//     getCategoryTree,
//     getCategoryById,
//     getCategoryBySlug,
//     createCategory,
//     updateCategory,
//     deleteCategory,
//     getCategoryProducts,
