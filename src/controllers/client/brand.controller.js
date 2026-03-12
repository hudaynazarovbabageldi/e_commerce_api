const { Brand } = require('../../models');
const { ApiResponse } = require('../../utils/ApiResponse');
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

module.exports = {
    getBrands,
    getBrandById,
};
