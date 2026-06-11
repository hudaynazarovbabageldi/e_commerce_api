const express = require('express');
const router = express.Router();

const bannerController = require('../../controllers/client/banner.controller');

const { apiLimiter } = require('../../middlewares/rateLimiter.middleware');

/**
 * @openapi
 * /v1/banners:
 *   get:
 *     tags:
 *       - Client Banners
 *     summary: List banners
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Banners retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 statusCode:
 *                   type: integer
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Banner'
 *                 totalPage:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 size:
 *                   type: integer
 *                 totalItems:
 *                   type: integer
 */

router.get('/', apiLimiter, bannerController.getBanners);

/**
 * @openapi
 * /v1/banners/{id}:
 *   get:
 *     tags:
 *       - Client Banners
 *     summary: Get banner by id
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

router.get('/:id', bannerController.getBannerById);

module.exports = router;
