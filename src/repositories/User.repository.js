const { User, Address, Order, Review } = require('../models');
const { Op } = require('sequelize');

class UserRepository {
    async findById(userId, options = {}) {
        const { includeAddresses = false, excludePassword = true } = options;
        const queryOptions = { where: { id: userId } };

        if (excludePassword) {
            queryOptions.attributes = {
                exclude: [
                    'password',
                    'resetPasswordToken',
                    'verificationToken',
                ],
            };
        }

        if (includeAddresses) {
            queryOptions.include = [
                { model: Address, as: 'addresses', required: false },
            ];
        }

        return await User.findOne(queryOptions);
    }

    async findByEmail(email) {
        return await User.findOne({ where: { email: email.toLowerCase() } });
    }

    /// JOIN INNER JOIN

    async findAll(filters = {}, pagination = {}) {
        const { role, isActive, search, emailVerified } = filters;
        const {
            limit = 20,
            offset = 0,
            orderBy = 'createdAt',
            orderDirection = 'DESC',
        } = pagination;

        const where = {};
        if (role) where.role = role;
        if (isActive !== undefined) where.isActive = isActive;
        if (emailVerified !== undefined) where.emailVerified = emailVerified;

        if (search) {
            where[Op.or] = [
                { email: { [Op.iLike]: `%${search}%` } },
                { firstName: { [Op.iLike]: `%${search}%` } },
                { lastName: { [Op.iLike]: `%${search}%` } },
            ];
        }

        return await User.findAndCountAll({
            where,
            attributes: {
                exclude: [
                    'password',
                    'resetPasswordToken',
                    'verificationToken',
                ],
            },
            limit,
            offset,
            order: [[orderBy, orderDirection]],
            distinct: true,
        });
    }

    async create(userData) {
        return await User.create(userData);
    }

    async update(userId, updateData) {
        const user = await User.findByPk(userId);
        if (!user) return null;

        Object.keys(updateData).forEach((key) => {
            user[key] = updateData[key];
        });

        await user.save();
        return user;
    }

    async delete(userId) {
        const deleted = await User.destroy({ where: { id: userId } });
        return deleted > 0;
    }

    async findByRole(role) {
        return await User.findAll({
            where: { role, isActive: true },
            attributes: {
                exclude: [
                    'password',
                    'resetPasswordToken',
                    'verificationToken',
                ],
            },
            order: [['createdAt', 'DESC']],
        });
    }

    async findActive() {
        return await User.findAll({
            where: { isActive: true },
            attributes: {
                exclude: [
                    'password',
                    'resetPasswordToken',
                    'verificationToken',
                ],
            },
        });
    }

    async findUnverifiedEmails() {
        return await User.findAll({
            where: { emailVerified: false, isActive: true },
            attributes: {
                exclude: [
                    'password',
                    'resetPasswordToken',
                    'verificationToken',
                ],
            },
        });
    }

    async findInactiveSince(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);

        return await User.findAll({
            where: { lastLoginAt: { [Op.lt]: date } },
            attributes: {
                exclude: [
                    'password',
                    'resetPasswordToken',
                    'verificationToken',
                ],
            },
        });
    }

    async countByRole() {
        const counts = await User.findAll({
            attributes: [
                'role',
                [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count'],
            ],
            group: ['role'],
        });

        return counts.reduce((acc, item) => {
            acc[item.role] = parseInt(item.get('count'));
            return acc;
        }, {});
    }

    async getUserStats(userId) {
        const user = await User.findByPk(userId);
        if (!user) return null;

        const [orderCount, reviewCount, totalSpent] = await Promise.all([
            Order.count({ where: { userId } }),
            Review.count({ where: { userId } }),
            Order.sum('total', {
                where: { userId, status: 'delivered', paymentStatus: 'paid' },
            }),
        ]);

        return {
            orderCount,
            reviewCount,
            totalSpent: totalSpent || 0,
            accountAge: Math.floor(
                (Date.now() - new Date(user.createdAt).getTime()) /
                    (1000 * 60 * 60 * 24),
            ),
            memberSince: user.createdAt,
            lastLogin: user.lastLoginAt,
        };
    }

    async findByResetToken(resetToken) {
        return await User.findOne({
            where: {
                resetPasswordToken: resetToken,
                resetPasswordExpires: { [Op.gt]: new Date() },
            },
        });
    }

    async updateLastLogin(userId) {
        await User.update(
            { lastLoginAt: new Date() },
            { where: { id: userId } },
        );
    }

    async bulkUpdate(userIds, updateData) {
        const [updated] = await User.update(updateData, {
            where: { id: { [Op.in]: userIds } },
        });
        return updated;
    }

    async emailExists(email, excludeUserId = null) {
        const where = { email: email.toLowerCase() };
        if (excludeUserId) {
            where.id = { [Op.ne]: excludeUserId };
        }
        const count = await User.count({ where });
        return count > 0;
    }

    async getNewUsersCount(startDate, endDate) {
        return await User.count({
            where: { createdAt: { [Op.between]: [startDate, endDate] } },
        });
    }

    async findTopCustomers(limit = 10) {
        return await User.findAll({
            attributes: [
                'id',
                'firstName',
                'lastName',
                'email',
                [
                    User.sequelize.fn('COUNT', User.sequelize.col('orders.id')),
                    'orderCount',
                ],
                [
                    User.sequelize.fn(
                        'SUM',
                        User.sequelize.col('orders.total'),
                    ),
                    'totalSpent',
                ],
            ],
            include: [
                {
                    model: Order,
                    as: 'orders',
                    attributes: [],
                    where: { status: 'delivered', paymentStatus: 'paid' },
                    required: true,
                },
            ],
            group: ['User.id'],
            order: [[User.sequelize.literal('totalSpent'), 'DESC']],
            limit,
            subQuery: false,
        });
    }
}

module.exports = new UserRepository();
