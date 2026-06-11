const express = require('express');
const router = express.Router();

const bannerController = require('../../controllers/admin/banner.admin.controller');
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
 * /v1/admin/banners:
 *   get:
 *     tags:
 *       - Admin Banners
 *     summary: List banners (admin)
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
 *         description: Banners retrieved successfully.
 */

router.get(
    '/',
    authenticate,
    authorize('admin'),
    apiLimiter,
    bannerController.getBanners,
);

router.get('/:id', authenticate, bannerController.getBannerById);

/**
 * @openapi
 * /v1/admin/banners/{id}:
 *   get:
 *     tags:
 *       - Admin Banners
 *     summary: Get banner by id (admin)
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
 *         description: Banner retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Banner'
 */

/**
 * @openapi
 * /v1/admin/banners:
 *   post:
 *     tags:
 *       - Admin Banners
 *     summary: Create banner (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BannerWriteRequest'
 *     responses:
 *       201:
 *         description: Banner created successfully.
 */
router.post('/', authenticate, bannerController.createBanner);

/**
 * @openapi
 * /v1/admin/banners/{id}:
 *   put:
 *     tags:
 *       - Admin Banners
 *     summary: Update banner (admin)
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
 *             $ref: '#/components/schemas/BannerWriteRequest'
 *     responses:
 *       200:
 *         description: Banner updated successfully.
 */
router.put('/:id', authenticate, bannerController.updateBanner);

/**
 * @openapi
 * /v1/admin/banners/{id}:
 *   delete:
 *     tags:
 *       - Admin Banners
 *     summary: Delete banner (admin)
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
 *         description: Banner deleted successfully.
 */
router.delete('/:id', authenticate, bannerController.deleteBanner);

// router.delete(
//     '/:id',
//     authenticate,
//     authorize('admin'),
//     validate(userIdSchema),
//     bannerController.deleteUser,
// );

module.exports = router;
