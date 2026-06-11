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
} = require('../../middlewares/Validate.middleware');
const { apiLimiter } = require('../../middlewares/rateLimiter.middleware');

/**
 * @openapi
 * /v1/admin/categories:
 *   get:
 *     tags:
 *       - Admin Categories
 *     summary: List categories (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: parentId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: rootOnly
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Categories retrieved successfully.
 */

router.get(
    '/',
    authenticate,
    authorize('admin'),
    apiLimiter,
    adminCategoryController.getCategories,
);

router.get('/:id', authenticate, adminCategoryController.getCategoryById);

/**
 * @openapi
 * /v1/admin/categories/{id}:
 *   get:
 *     tags:
 *       - Admin Categories
 *     summary: Get category by id (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Category retrieved successfully.
 */

/**
 * @openapi
 * /v1/admin/categories:
 *   post:
 *     tags:
 *       - Admin Categories
 *     summary: Create category (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryWriteRequest'
 *     responses:
 *       201:
 *         description: Category created successfully.
 */
router.post('/', authenticate, adminCategoryController.createCategory);

/**
 * @openapi
 * /v1/admin/categories/{id}:
 *   put:
 *     tags:
 *       - Admin Categories
 *     summary: Update category (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryWriteRequest'
 *     responses:
 *       200:
 *         description: Category updated successfully.
 */
router.put('/:id', authenticate, adminCategoryController.updateCategory);

/**
 * @openapi
 * /v1/admin/categories/{id}:
 *   delete:
 *     tags:
 *       - Admin Categories
 *     summary: Delete category (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Category deleted successfully.
 */
router.delete('/:id', authenticate, adminCategoryController.deleteCategory);

/**
 * @openapi
 * /v1/admin/categories/{id}/products:
 *   get:
 *     tags:
 *       - Admin Categories
 *     summary: List products in category (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Products retrieved successfully.
 */

router.get(
    '/:id/products',
    authenticate,
    adminCategoryController.getCategoryProducts,
);

module.exports = router;
