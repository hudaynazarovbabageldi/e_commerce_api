const express = require('express');
const router = express.Router();

const categoryController = require('../../controllers/client/category.controller');

const { apiLimiter } = require('../../middlewares/rateLimiter.middleware');

/**
 * @openapi
 * /v1/categories:
 *   get:
 *     tags:
 *       - Client Categories
 *     summary: List categories
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
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Category'
 */

router.get('/', apiLimiter, categoryController.getCategories);

/**
 * @openapi
 * /v1/categories/{id}:
 *   get:
 *     tags:
 *       - Client Categories
 *     summary: Get category by id
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
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Category'
 */

router.get('/:id', categoryController.getCategoryById);

module.exports = router;
