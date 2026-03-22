const productService = require('../../services/product.service');
const { ApiResponse } = require('../../utils/ApiResponse');
const { asyncHandler } = require('../../utils/asyncHandler');

class ProductController {
    getProducts = asyncHandler(async (req, res) => {
        const filters = {
            categoryId: req.query.categoryId,
            minPrice: req.query.minPrice,
            maxPrice: req.query.maxPrice,
            search: req.query.search,
        };

        const options = {
            locale: req.query.locale,
            fallbackLocale: req.query.fallbackLocale,
        };

        const pagination = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
        };

        const result = await productService.getProducts(
            filters,
            pagination,
            options,
        );

        res.json(
            new ApiResponse(200, result, 'Products retrieved successfully'),
        );
    });

    getProduct = asyncHandler(async (req, res) => {
        const product = await productService.getProductById(req.params.id, {
            locale: req.query.locale,
            fallbackLocale: req.query.fallbackLocale,
        });

        res.json(
            new ApiResponse(200, product, 'Product retrieved successfully'),
        );
    });

    createProduct = asyncHandler(async (req, res) => {
        const product = await productService.createProduct(req.body);

        res.status(201).json(
            new ApiResponse(201, product, 'Product created successfully'),
        );
    });

    updateProduct = asyncHandler(async (req, res) => {
        const product = await productService.updateProduct(
            req.params.id,
            req.body,
        );

        res.json(new ApiResponse(200, product, 'Product updated successfully'));
    });

    deleteProduct = asyncHandler(async (req, res) => {
        await productService.deleteProduct(req.params.id);

        res.json(new ApiResponse(200, null, 'Product deleted successfully'));
    });
}

module.exports = new ProductController();
