const { User, Order, Review, Address } = require('../../models');
const { ApiError } = require('../../utils/ApiError');
const { ApiResponse } = require('../../utils/ApiResponse');
const { asyncHandler } = require('../../utils/asyncHandler');
const pagination = require('../../utils/pagination');
const logger = require('../../utils/logger');
const encryption = require('../../utils/encryption');
const { getById } = require('../../utils/EntityResolver');

const getUsers = asyncHandler(async (req, res) => {
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

const getUserById = asyncHandler(async (req, res) => {
    console.log('req get by id: ', req);
    const user = await getById(User, req.params.id, {
        attributes: {
            exclude: ['password', 'resetPasswordToken', 'verificationToken'],
        },
        // TODO: Add Address include once Address model is created
        // include: [
        //     {
        //         model: Address,
        //         as: 'addresses',
        //         where: { isDefault: true },
        //         required: false,
        //     },
        // ],
    });

    console.log('user: ', user);

    res.json(new ApiResponse(200, user, 'User retrieved successfully'));
});

/**
 * Create user (Admin only)
 * @route POST /api/users
 */
const createUser = asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, phone, role, isActive } =
        req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
        throw new ApiError(409, 'Email already registered');
    }

    // Validate password strength
    const passwordValidation = encryption.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
        throw new ApiError(
            400,
            'Password does not meet requirements',
            true,
            null,
            passwordValidation.errors,
        );
    }

    // Create user
    const user = await User.create({
        email: email.toLowerCase(),
        password,
        firstName,
        lastName,
        phone,
        role: role || 'customer',
        isActive: isActive !== undefined ? isActive : true,
    });

    logger.logBusinessEvent('user_created_by_admin', {
        userId: user.id,
        createdBy: req.user.id,
        role: user.role,
    });

    res.status(201).json(
        new ApiResponse(201, user.toJSON(), 'User created successfully'),
    );
});

/**
 * Update user
 * @route PUT /api/users/:id
 */
const updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        firstName,
        lastName,
        phone,
        dateOfBirth,
        avatar,
        role,
        isActive,
        emailVerified,
    } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Check permissions - users can only update their own profile, admins can update anyone
    if (req.user.role !== 'admin' && req.user.id !== id) {
        throw new ApiError(403, 'You can only update your own profile');
    }

    // Update allowed fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (avatar) user.avatar = avatar;

    // Admin-only fields
    if (req.user.role === 'admin') {
        if (role) user.role = role;
        if (isActive !== undefined) user.isActive = isActive;
        if (emailVerified !== undefined) {
            user.emailVerified = emailVerified;
            if (emailVerified && !user.emailVerifiedAt) {
                user.emailVerifiedAt = new Date();
            }
        }
    }

    await user.save();

    logger.logBusinessEvent('user_updated', {
        userId: user.id,
        updatedBy: req.user.id,
    });

    res.json(new ApiResponse(200, user.toJSON(), 'User updated successfully'));
});

/**
 * Delete user
 * @route DELETE /api/users/:id
 */
const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Prevent deletion of own account
    if (req.user.id === id) {
        throw new ApiError(400, 'You cannot delete your own account');
    }

    await user.destroy();

    logger.logBusinessEvent('user_deleted', {
        userId: id,
        deletedBy: req.user.id,
    });

    res.json(new ApiResponse(200, null, 'User deleted successfully'));
});

/**
 * Deactivate user account
 * @route POST /api/users/:id/deactivate
 */
const deactivateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    user.isActive = false;
    await user.save();

    logger.logBusinessEvent('user_deactivated', {
        userId: id,
        deactivatedBy: req.user.id,
    });

    res.json(new ApiResponse(200, null, 'User deactivated successfully'));
});

/**
 * Activate user account
 * @route POST /api/users/:id/activate
 */
const activateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    user.isActive = true;
    await user.save();

    logger.logBusinessEvent('user_activated', {
        userId: id,
        activatedBy: req.user.id,
    });

    res.json(new ApiResponse(200, null, 'User activated successfully'));
});

/**
 * Get user orders
 * @route GET /api/users/:id/orders
 */
const getUserOrders = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page, limit, offset } = pagination.validatePaginationParams(
        req.query,
    );

    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== id) {
        throw new ApiError(403, 'Access denied');
    }

    const user = await User.findByPk(id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const { rows: orders, count } = await Order.findAndCountAll({
        where: { userId: id },
        limit,
        offset,
        order: [['createdAt', 'DESC']],
    });

    const response = pagination.createPaginatedResponse(
        orders,
        count,
        page,
        limit,
    );

    res.json(
        new ApiResponse(200, response.data, 'Orders retrieved successfully', {
            pagination: response.pagination,
        }),
    );
});

/**
 * Get user reviews
 * @route GET /api/users/:id/reviews
 */
const getUserReviews = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page, limit, offset } = pagination.validatePaginationParams(
        req.query,
    );

    const user = await User.findByPk(id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const { rows: reviews, count } = await Review.findAndCountAll({
        where: { userId: id },
        limit,
        offset,
        order: [['createdAt', 'DESC']],
    });

    const response = pagination.createPaginatedResponse(
        reviews,
        count,
        page,
        limit,
    );

    res.json(
        new ApiResponse(200, response.data, 'Reviews retrieved successfully', {
            pagination: response.pagination,
        }),
    );
});

/**
 * Get user addresses
 * @route GET /api/users/:id/addresses
 */
const getUserAddresses = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== id) {
        throw new ApiError(403, 'Access denied');
    }

    const user = await User.findByPk(id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const addresses = await Address.findAll({
        where: { userId: id },
        order: [
            ['isDefault', 'DESC'],
            ['createdAt', 'DESC'],
        ],
    });

    res.json(
        new ApiResponse(200, addresses, 'Addresses retrieved successfully'),
    );
});

/**
 * Get user statistics (Admin only)
 * @route GET /api/users/:id/stats
 */
const getUserStats = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const [orderCount, reviewCount, totalSpent] = await Promise.all([
        Order.count({ where: { userId: id } }),
        Review.count({ where: { userId: id } }),
        Order.sum('total', {
            where: {
                userId: id,
                status: 'delivered',
                paymentStatus: 'paid',
            },
        }),
    ]);

    const stats = {
        userId: id,
        orderCount,
        reviewCount,
        totalSpent: totalSpent || 0,
        accountAge: Math.floor(
            (Date.now() - new Date(user.createdAt).getTime()) /
                (1000 * 60 * 60 * 24),
        ), // days
        lastLogin: user.lastLoginAt,
        emailVerified: user.emailVerified,
    };

    res.json(
        new ApiResponse(200, stats, 'User statistics retrieved successfully'),
    );
});

/**
 * Change user role (Admin only)
 * @route PUT /api/users/:id/role
 */
const changeUserRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!['customer', 'vendor', 'admin'].includes(role)) {
        throw new ApiError(400, 'Invalid role');
    }

    const user = await User.findByPk(id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Prevent changing own role
    if (req.user.id === id) {
        throw new ApiError(400, 'You cannot change your own role');
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    logger.logBusinessEvent('user_role_changed', {
        userId: id,
        oldRole,
        newRole: role,
        changedBy: req.user.id,
    });

    res.json(
        new ApiResponse(200, user.toJSON(), 'User role updated successfully'),
    );
});

module.exports = {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    deactivateUser,
    activateUser,
    getUserOrders,
    getUserReviews,
    getUserAddresses,
    getUserStats,
    changeUserRole,
};
