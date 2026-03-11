const { Brand } = require('../../models');
const { ApiResponse } = require('../../utils/ApiResponse');
const { ApiError } = require('../../utils/ApiError');
const { asyncHandler } = require('../../utils/asyncHandler');
const pagination = require('../../utils/pagination');
const { getById } = require('../../utils/EntityResolver');

const getBrands = asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination.validatePaginationParams(
        req.query,
    );

    const filters = pagination.parseFilterParams(req.query, ['isActive']);

    const where = {};
    if (filters.role) where.role = filters.role;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (req.query.search) {
        const { Op } = require('sequelize');
        where[Op.or] = [{ search: { [Op.iLike]: `%${req.query.search}%` } }];
    }

    const { rows: brands, count } = await Brand.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
    });

    const response = pagination.createPaginatedResponse(
        brands,
        count,
        page,
        limit,
    );

    res.json({
        success: true,
        statusCode: 200,
        message: 'Brands retrieved successfully',
        data: response.data,
        totalPage: response.pagination.totalPages,
        currentPage: response.pagination.currentPage,
        size: response.pagination.itemsPerPage,
        totalItems: response.pagination.totalItems,
    });
});

const getBrandById = asyncHandler(async (req, res) => {
    const user = await getById(Brand, req.params.id);

    res.json(new ApiResponse(200, user, 'Brand retrieved successfully'));
});

const createBrand = asyncHandler(async (req, res) => {
    const { title, description, imageUrl, position, isActive } = req.body;

    if (!title || !imageUrl) {
        throw new ApiError(400, 'Title and imageUrl are required');
    }

    const brand = await Brand.create({
        title,
        description,
        imageUrl,
        position,
        isActive,
    });

    res.status(201).json(
        new ApiResponse(201, brand, 'Brand created successfully'),
    );
});

const updateBrand = asyncHandler(async (req, res) => {
    const brand = await getById(Brand, req.params.id);

    const { title, description, imageUrl, position, isActive } = req.body;

    await brand.update({
        title: title ?? brand.title,
        description: description ?? brand.description,
        imageUrl: imageUrl ?? brand.imageUrl,
        position: position ?? brand.position,
        isActive: isActive ?? brand.isActive,
    });

    res.json(new ApiResponse(200, brand, 'Brand updated successfully'));
});

const deleteBrand = asyncHandler(async (req, res) => {
    const banner = await getById(Brand, req.params.id);

    await banner.destroy();

    res.json(new ApiResponse(200, null, 'Brand deleted successfully'));
});

module.exports = {
    getBrands,
    getBrandById,
    createBrand,
    updateBrand,
    deleteBrand,
};
