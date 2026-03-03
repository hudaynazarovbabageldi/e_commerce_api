const { Banner } = require('../../models');
const { ApiResponse } = require('../../utils/ApiResponse');
const { ApiError } = require('../../utils/ApiError');
const { asyncHandler } = require('../../utils/asyncHandler');
const pagination = require('../../utils/pagination');
const { getById } = require('../../utils/EntityResolver');

const getBanners = asyncHandler(async (req, res) => {
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

    const { rows: banners, count } = await Banner.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
    });

    const response = pagination.createPaginatedResponse(
        banners,
        count,
        page,
        limit,
    );

    res.json({
        success: true,
        statusCode: 200,
        message: 'Banners retrieved successfully',
        data: response.data,
        totalPage: response.pagination.totalPages,
        currentPage: response.pagination.currentPage,
        size: response.pagination.itemsPerPage,
        totalItems: response.pagination.totalItems,
    });
});

const getBannerById = asyncHandler(async (req, res) => {
    const user = await getById(Banner, req.params.id);

    res.json(new ApiResponse(200, user, 'Banner retrieved successfully'));
});

const createBanner = asyncHandler(async (req, res) => {
    const {
        title,
        description,
        imageUrl,
        link,
        position,
        isActive,
        startDate,
        endDate,
    } = req.body;

    if (!title || !imageUrl) {
        throw new ApiError(400, 'Title and imageUrl are required');
    }

    const banner = await Banner.create({
        title,
        description,
        imageUrl,
        link,
        position,
        isActive,
        startDate,
        endDate,
    });

    res.status(201).json(
        new ApiResponse(201, banner, 'Banner created successfully'),
    );
});

const updateBanner = asyncHandler(async (req, res) => {
    const banner = await getById(Banner, req.params.id);

    const {
        title,
        description,
        imageUrl,
        link,
        position,
        isActive,
        startDate,
        endDate,
    } = req.body;

    await banner.update({
        title: title ?? banner.title,
        description: description ?? banner.description,
        imageUrl: imageUrl ?? banner.imageUrl,
        link: link ?? banner.link,
        position: position ?? banner.position,
        isActive: isActive ?? banner.isActive,
        startDate: startDate ?? banner.startDate,
        endDate: endDate ?? banner.endDate,
    });

    res.json(new ApiResponse(200, banner, 'Banner updated successfully'));
});

const deleteBanner = asyncHandler(async (req, res) => {
    const banner = await getById(Banner, req.params.id);

    await banner.destroy();

    res.json(new ApiResponse(200, null, 'Banner deleted successfully'));
});

module.exports = {
    getBanners,
    getBannerById,
    createBanner,
    updateBanner,
    deleteBanner,
};
