const express = require('express');
const router = express.Router();
const Joi = require('joi');

const productController = require('../../controllers/admin/product.admin.controller');
const {
    authenticate,
    authorize,
    optionalAuthenticate,
} = require('../../middlewares/auth.middleware');
const {
    validate,
    commonSchemas,
} = require('../../middlewares/Validate.middleware');
const {
    apiLimiter,
    searchLimiter,
} = require('../../middlewares/rateLimiter.middleware');
const {
    uploadProductImages,
    attachFileUrls,
} = require('../../middlewares/upload.middleware');

const localeSchema = Joi.string()
    .pattern(/^[a-z]{2}(?:-[a-z]{2})?$/i)
    .optional();

const getProductsSchema = {
    query: Joi.object({
        ...commonSchemas.pagination,
        ...commonSchemas.priceRange,
        categoryId: commonSchemas.uuid.optional(),
        search: commonSchemas.search,
        tags: Joi.alternatives().try(
            Joi.string(),
            Joi.array().items(Joi.string()),
        ),
        isFeatured: commonSchemas.boolean,
        isDigital: commonSchemas.boolean,
        inStock: commonSchemas.boolean,
        locale: localeSchema,
        fallbackLocale: localeSchema,
        sort: Joi.string().valid(
            'name',
            'price',
            'rating',
            'createdAt',
            'soldCount',
            'viewCount',
            '-name',
            '-price',
            '-rating',
            '-createdAt',
            '-soldCount',
            '-viewCount',
        ),
    }),
};

const productIdSchema = {
    params: Joi.object({
        id: commonSchemas.uuid,
    }),
};

/**
 * @openapi
 * /v1/products:
 *   get:
 *     tags:
 *       - Client Products
 *     summary: List products
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
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: locale
 *         schema:
 *           type: string
 *       - in: query
 *         name: fallbackLocale
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Products retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ProductListData'
 */

router.get(
    '/',
    searchLimiter,
    validate(getProductsSchema),
    productController.getProducts,
);

/**
 * @openapi
 * /v1/products/{id}:
 *   get:
 *     tags:
 *       - Client Products
 *     summary: Get product by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: locale
 *         schema:
 *           type: string
 *       - in: query
 *         name: fallbackLocale
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Product'
 */

router.get('/:id', validate(productIdSchema), productController.getProduct);

module.exports = router;
