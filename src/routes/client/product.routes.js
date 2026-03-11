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

router.get(
    '/',
    searchLimiter,
    validate(getProductsSchema),
    productController.getProducts,
);

router.get('/:id', validate(productIdSchema), productController.getProduct);

module.exports = router;
