const { Category, Product } = require('../../models');
const { ApiError } = require('../../utils/ApiError');
const { ApiResponse } = require('../../utils/ApiResponse');
const { asyncHandler } = require('../../utils/asyncHandler');
const pagination = require('../../utils/pagination');
const logger = require('../../utils/logger');

// ============================================
// CATEGORY CONTROLLER
// ============================================

/**
 * Get all categories
 * @route GET /api/categories
 */
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
 * Create category
 * @route POST /api/categories
 */
const createCategory = asyncHandler(async (req, res) => {
    const {
        name,
        description,
        parentId,
        image,
        icon,
        sortOrder,
        isFeatured,
        metaTitle,
        metaDescription,
        metaKeywords,
    } = req.body;

    // Verify parent exists if specified
    if (parentId) {
        const parent = await Category.findByPk(parentId);
        if (!parent) {
            throw new ApiError(404, 'Parent category not found');
        }
    }

    const category = await Category.create({
        name,
        description,
        parentId,
        image,
        icon,
        sortOrder,
        isFeatured,
        metaTitle,
        metaDescription,
        metaKeywords,
    });

    logger.logBusinessEvent('category_created', {
        categoryId: category.id,
        createdBy: req.user.id,
    });

    res.status(201).json(
        new ApiResponse(201, category, 'Category created successfully'),
    );
});

/**
 * Update category
 * @route PUT /api/categories/:id
 */
const updateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const category = await Category.findByPk(id);
    if (!category) {
        throw new ApiError(404, 'Category not found');
    }

    // Prevent setting self as parent
    if (req.body.parentId === id) {
        throw new ApiError(400, 'Category cannot be its own parent');
    }

    // Update allowed fields
    const allowedFields = [
        'name',
        'description',
        'parentId',
        'image',
        'icon',
        'sortOrder',
        'isFeatured',
        'isActive',
        'metaTitle',
        'metaDescription',
        'metaKeywords',
    ];

    allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
            category[field] = req.body[field];
        }
    });

    await category.save();

    logger.logBusinessEvent('category_updated', {
        categoryId: id,
        updatedBy: req.user.id,
    });

    res.json(new ApiResponse(200, category, 'Category updated successfully'));
});

/**
 * Delete category
 * @route DELETE /api/categories/:id
 */
const deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const category = await Category.findByPk(id);
    if (!category) {
        throw new ApiError(404, 'Category not found');
    }

    // Check if category has children
    const childCount = await Category.count({ where: { parentId: id } });
    if (childCount > 0) {
        throw new ApiError(400, 'Cannot delete category with subcategories');
    }

    // Check if category has products
    if (category.productCount > 0) {
        throw new ApiError(400, 'Cannot delete category with products');
    }

    await category.destroy();

    logger.logBusinessEvent('category_deleted', {
        categoryId: id,
        deletedBy: req.user.id,
    });

    res.json(new ApiResponse(200, null, 'Category deleted successfully'));
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
    getCategoryTree,
    getCategoryById,
    getCategoryBySlug,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryProducts,
};
