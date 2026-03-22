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

const createProductSchema = {
    body: Joi.object({
        name: Joi.string().min(3).max(200),
        description: Joi.string().min(10),
        shortDescription: Joi.string().max(500),
        sku: Joi.string().required(),
        price: Joi.number().min(0).required(),
        comparePrice: Joi.number().min(0),
        costPrice: Joi.number().min(0),
        stock: Joi.number().integer().min(0).required(),
        lowStockThreshold: Joi.number().integer().min(0).default(10),
        categoryId: commonSchemas.uuid,
        images: commonSchemas.stringArray,
        thumbnail: commonSchemas.url,
        tags: commonSchemas.stringArray,
        brand: Joi.string().max(100),
        weight: Joi.number().min(0),
        dimensions: Joi.object({
            length: Joi.number().min(0),
            width: Joi.number().min(0),
            height: Joi.number().min(0),
        }),
        isDigital: commonSchemas.boolean,
        downloadUrl: commonSchemas.url,
        isFeatured: commonSchemas.boolean,
        metaTitle: Joi.string().max(200),
        metaDescription: Joi.string(),
        metaKeywords: commonSchemas.stringArray,
        brandId: commonSchemas.uuid,
        vendorId: commonSchemas.uuid.required(),
        locale: localeSchema,
        translation: Joi.object({
            locale: localeSchema,
            name: Joi.string().min(3).max(200).required(),
            slug: Joi.string().max(250).required(),
            description: Joi.string().allow(''),
            shortDescription: Joi.string().max(500).allow(''),
            metaTitle: Joi.string().max(200).allow(''),
            metaDescription: Joi.string().allow(''),
        }).optional(),
        translations: Joi.array()
            .items(
                Joi.object({
                    locale: localeSchema.required(),
                    name: Joi.string().min(3).max(200).required(),
                    slug: Joi.string().max(250).required(),
                    description: Joi.string().allow(''),
                    shortDescription: Joi.string().max(500).allow(''),
                    metaTitle: Joi.string().max(200).allow(''),
                    metaDescription: Joi.string().allow(''),
                }),
            )
            .optional(),
    }).or('name', 'translation', 'translations'),
};

const updateProductSchema = {
    params: Joi.object({
        id: commonSchemas.uuid,
    }),
    body: Joi.object({
        name: Joi.string().min(3).max(200),
        description: Joi.string().min(10),
        shortDescription: Joi.string().max(500),
        price: Joi.number().min(0),
        comparePrice: Joi.number().min(0),
        costPrice: Joi.number().min(0),
        stock: Joi.number().integer().min(0),
        lowStockThreshold: Joi.number().integer().min(0),
        categoryId: commonSchemas.uuid,
        images: commonSchemas.stringArray,
        thumbnail: commonSchemas.url,
        tags: commonSchemas.stringArray,
        brand: Joi.string().max(100),
        weight: Joi.number().min(0),
        dimensions: Joi.object({
            length: Joi.number().min(0),
            width: Joi.number().min(0),
            height: Joi.number().min(0),
        }),
        isDigital: commonSchemas.boolean,
        downloadUrl: commonSchemas.url,
        isFeatured: commonSchemas.boolean,
        isActive: commonSchemas.boolean,
        metaTitle: Joi.string().max(200),
        metaDescription: Joi.string(),
        metaKeywords: commonSchemas.stringArray,
        locale: localeSchema,
        translation: Joi.object({
            locale: localeSchema,
            name: Joi.string().min(3).max(200),
            slug: Joi.string().max(250),
            description: Joi.string().allow(''),
            shortDescription: Joi.string().max(500).allow(''),
            metaTitle: Joi.string().max(200).allow(''),
            metaDescription: Joi.string().allow(''),
        }).optional(),
        translations: Joi.array()
            .items(
                Joi.object({
                    locale: localeSchema.required(),
                    name: Joi.string().min(3).max(200).required(),
                    slug: Joi.string().max(250).required(),
                    description: Joi.string().allow(''),
                    shortDescription: Joi.string().max(500).allow(''),
                    metaTitle: Joi.string().max(200).allow(''),
                    metaDescription: Joi.string().allow(''),
                }),
            )
            .optional(),
    }).min(1),
};

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

const getFeaturedProductsSchema = {
    query: Joi.object({
        limit: Joi.number().integer().min(1).max(50).default(10),
    }),
};

const getProductReviewsSchema = {
    params: Joi.object({ id: commonSchemas.uuid }),
    query: Joi.object({
        ...commonSchemas.pagination,
        rating: Joi.number().integer().min(1).max(5),
    }),
};

const updateStockSchema = {
    params: Joi.object({
        id: commonSchemas.uuid,
    }),
    body: Joi.object({
        quantity: Joi.number().integer().min(0).required(),
        action: Joi.string().valid('set', 'add', 'subtract').required(),
    }),
};

const productIdSchema = {
    params: Joi.object({
        id: commonSchemas.uuid,
    }),
};

const slugSchema = {
    params: Joi.object({
        slug: Joi.string().required(),
    }),
};

/**
 * Routes
 */

// @route   GET /api/products
// @desc    Get all products
// @access  Public

router.get(
    '/',
    searchLimiter,
    validate(getProductsSchema),
    productController.getProducts,
);

// @route   GET /api/products/featured
// @desc    Get featured products
// @access  Public
// router.get(
//     '/featured',
//     validate(getFeaturedProductsSchema),
//     productController.getFeaturedProducts,
// );

// @route   GET /api/products/low-stock
// @desc    Get low stock products
// @access  Private (Admin, Vendor)
// router.get(
//     '/low-stock',
//     authenticate,
//     authorize('admin', 'vendor'),
//     productController.getLowStockProducts,
// );

// @route   GET /api/products/slug/:slug
// @desc    Get product by slug
// @access  Public
// router.get(
//     '/slug/:slug',
//     validate(slugSchema),
//     productController.getProductBySlug,
// );

// @route   GET /api/products/:id
// @desc    Get product by ID
// @access  Public
router.get('/:id', validate(productIdSchema), productController.getProduct);

// @route   POST /api/products
// @desc    Create product
// @access  Private (Admin, Vendor)
router.post(
    '/',
    authenticate,
    authorize('admin', 'vendor'),
    // validate(createProductSchema),
    productController.createProduct,
);

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private (Admin, Vendor - Own Products)
router.put(
    '/:id',
    authenticate,
    authorize('admin', 'vendor'),
    validate(updateProductSchema),
    productController.updateProduct,
);

// @route   DELETE /api/products/:id
// @desc    Delete product
// @access  Private (Admin)
router.delete(
    '/:id',
    authenticate,
    authorize('admin'),
    validate(productIdSchema),
    productController.deleteProduct,
);

// @route   GET /api/products/:id/reviews
// @desc    Get product reviews
// @access  Public
// router.get(
//     '/:id/reviews',
//     validate(getProductReviewsSchema),
//     productController.getProductReviews,
// );

// @route   PATCH /api/products/:id/stock
// @desc    Update product stock
// @access  Private (Admin, Vendor)
// router.patch(
//     '/:id/stock',
//     authenticate,
//     authorize('admin', 'vendor'),
//     validate(updateStockSchema),
//     productController.updateStock,
// );

// @route   POST /api/products/:id/images
// @desc    Upload product images
// @access  Private (Admin, Vendor)
// router.post(
//     '/:id/images',
//     authenticate,
//     authorize('admin', 'vendor'),
//     uploadProductImages,
//     attachFileUrls,
//     validate(productIdSchema),
//     productController.uploadImages,
// );

module.exports = router;
