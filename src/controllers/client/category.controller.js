const { Category, Product } = require('../../models');
const { ApiError } = require('../../utils/ApiError');
const { ApiResponse } = require('../../utils/ApiResponse');
const { asyncHandler } = require('../../utils/asyncHandler');
const pagination = require('../../utils/pagination');
const logger = require('../../utils/logger');

const getCategories = asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination.validatePaginationParams(
        req.query,
    );

    const where = { isActive: true };

    // Filter by parent
    if (req.query.parentId) {
        where.parentId = req.query.parentId;
    } else if (req.query.rootOnly === 'true') {
        where.parentId = null;
    }

    const { rows: categories, count } = await Category.findAndCountAll({
        where,
        limit,
        offset,
        order: [
            ['sortOrder', 'ASC'],
            ['name', 'ASC'],
        ],
    });

    const response = pagination.createPaginatedResponse(
        categories,
        count,
        page,
        limit,
    );

    res.json(
        new ApiResponse(
            200,
            response.data,
            'Categories retrieved successfully',
            { pagination: response.pagination },
        ),
    );
});

/**
 * Get category tree
 * @route GET /api/categories/tree
 */
const getCategoryTree = asyncHandler(async (req, res) => {
    const tree = await Category.buildTree();

    res.json(
        new ApiResponse(200, tree, 'Category tree retrieved successfully'),
    );
});

/**
 * Get category by ID
 * @route GET /api/categories/:id
 */
const getCategoryById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const category = await Category.findByPk(id, {
        include: [
            {
                model: Category,
                as: 'parent',
                attributes: ['id', 'name', 'slug'],
            },
            {
                model: Category,
                as: 'children',
                where: { isActive: true },
                required: false,
                attributes: ['id', 'name', 'slug', 'productCount'],
            },
        ],
    });

    if (!category) {
        throw new ApiError(404, 'Category not found');
    }

    res.json(new ApiResponse(200, category, 'Category retrieved successfully'));
});

/**
 * Get category by slug
 * @route GET /api/categories/slug/:slug
 */
const getCategoryBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;

    const category = await Category.findBySlug(slug);

    if (!category) {
        throw new ApiError(404, 'Category not found');
    }

    res.json(new ApiResponse(200, category, 'Category retrieved successfully'));
});

/**
 * Get category products
 * @route GET /api/categories/:id/products
 */
const getCategoryProducts = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page, limit, offset } = pagination.validatePaginationParams(
        req.query,
    );

    const category = await Category.findByPk(id);
    if (!category) {
        throw new ApiError(404, 'Category not found');
    }

    const { rows: products, count } = await Product.findAndCountAll({
        where: { categoryId: id, isActive: true },
        limit,
        offset,
        order: [['createdAt', 'DESC']],
    });

    const response = pagination.createPaginatedResponse(
        products,
        count,
        page,
        limit,
    );

    res.json(
        new ApiResponse(200, response.data, 'Products retrieved successfully', {
            pagination: response.pagination,
        }),
    );
});

module.exports = {
    getCategories,
    getCategoryById,
    getCategoryTree,
    getCategoryBySlug,
    getCategoryProducts,
};
