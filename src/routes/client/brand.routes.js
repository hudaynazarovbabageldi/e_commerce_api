const express = require('express');
const router = express.Router();

const brandController = require('../../controllers/client/brand.controller');
const { apiLimiter } = require('../../middlewares/rateLimiter.middleware');

/**
 * @openapi
 * /v1/brands:
 *   get:
 *     tags:
 *       - Client Brands
 *     summary: List brands
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

router.get('/', apiLimiter, brandController.getBrands);

/**
 * @openapi
 * /v1/brands/{id}:
 *   get:
 *     tags:
 *       - Client Brands
 *     summary: Get brand by id
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
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Brand'
 */

router.get('/:id', brandController.getBrandById);

module.exports = router;
