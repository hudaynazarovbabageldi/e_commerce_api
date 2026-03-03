const { Banners } = require('../..models');
const { ApiResponse } = require('../../utils/ApiResponse');
const { asyncHandler } = require('../../utils/asyncHandler');
const pagination = require('../../utils/pagination');
const { getById } = require('../../utils/EntityResolver');

const getBanners = asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination.validatePaginationParams(
        req.query,
    );

    const filters = pagination.parseFilterParams(req.query, [
        'role',
        'isActive',
    ]);

    const where = {};
    if (filters.role) where.role = filters.role;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (req.query.search) {
        const { Op } = require('sequelize');
        where[Op.or] = [
            { email: { [Op.iLike]: `%${req.query.search}%` } },
            { firstName: { [Op.iLike]: `%${req.query.search}%` } },
            { lastName: { [Op.iLike]: `%${req.query.search}%` } },
        ];
    }

    const { rows: users, count } = await User.findAndCountAll({
        where,
        attributes: {
            exclude: ['password', 'resetPasswordToken', 'verificationToken'],
        },
        limit,
        offset,
        order: [['createdAt', 'DESC']],
    });

    const response = pagination.createPaginatedResponse(
        users,
        count,
        page,
        limit,
    );

    res.json({
        success: true,
        statusCode: 200,
        message: 'Users retrieved successfully',
        data: response.data,
        totalPage: response.pagination.totalPages,
        currentPage: response.pagination.currentPage,
        size: response.pagination.itemsPerPage,
        totalItems: response.pagination.totalItems,
    });
});

const getBannerById = asyncHandler(async (req, res) => {
    const user = await getById(User, req.params.id, {
        attributes: {
            exclude: ['password', 'resetPasswordToken', 'verificationToken'],
        },
    });

    console.log('user: ', user);

    res.json(new ApiResponse(200, user, 'User retrieved successfully'));
});

module.exports = {
    getBanners,
    getBannerById,
};
