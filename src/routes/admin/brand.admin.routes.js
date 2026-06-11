const express = require('express');
const router = express.Router();

const adminBrandController = require('../../controllers/admin/brand.admin.controller');
const {
    authenticate,
    authorize,
} = require('../../middlewares/auth.middleware');
const { apiLimiter } = require('../../middlewares/rateLimiter.middleware');

/**
 * @openapi
 * /v1/admin/brands:
 *   get:
 *     tags:
 *       - Admin Brands
 *     summary: List brands (admin)
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
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Brands retrieved successfully.
 */

router.get(
    '/',
    authenticate,
    authorize('admin'),
    apiLimiter,
    adminBrandController.getBrands,
);

router.get('/:id', authenticate, adminBrandController.getBrandById);

/**
 * @openapi
 * /v1/admin/brands/{id}:
 *   get:
 *     tags:
 *       - Admin Brands
 *     summary: Get brand by id (admin)
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
 *         description: Brand retrieved successfully.
 */

/**
 * @openapi
 * /v1/admin/brands:
 *   post:
 *     tags:
 *       - Admin Brands
 *     summary: Create brand (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BrandWriteRequest'
 *     responses:
 *       201:
 *         description: Brand created successfully.
 */
router.post('/', authenticate, adminBrandController.createBrand);

/**
 * @openapi
 * /v1/admin/brands/{id}:
 *   put:
 *     tags:
 *       - Admin Brands
 *     summary: Update brand (admin)
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
 *             $ref: '#/components/schemas/BrandWriteRequest'
 *     responses:
 *       200:
 *         description: Brand updated successfully.
 */
router.put('/:id', authenticate, adminBrandController.updateBrand);

/**
 * @openapi
 * /v1/admin/brands/{id}:
 *   delete:
 *     tags:
 *       - Admin Brands
 *     summary: Delete brand (admin)
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
 *         description: Brand deleted successfully.
 */
router.delete('/:id', authenticate, adminBrandController.deleteBrand);

module.exports = router;
