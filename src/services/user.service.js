const { User, Order, Review, Address } = require('../models');
const { ApiError } = require('../utils/ApiError');
const logger = require('../utils/logger');

class UserService {
    async getUserById(userId) {
        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password'] },
            include: [{ model: Address, as: 'addresses' }],
        });
        if (!user) throw new ApiError(404, 'User not found');
        return user;
    }

    async updateProfile(userId, updateData) {
        const user = await User.findByPk(userId);
        if (!user) throw new ApiError(404, 'User not found');

        ['firstName', 'lastName', 'phone', 'dateOfBirth', 'avatar'].forEach(
            field => {
                if (updateData[field] !== undefined)
                    user[field] = updateData[field];
            }
        );

        await user.save();
        return user.toJSON();
    }

    async getUserStats(userId) {
        const [orderCount, reviewCount, totalSpent] = await Promise.all([
            Order.count({ where: { userId } }),
            Review.count({ where: { userId } }),
            Order.sum('total', {
                where: { userId, status: 'delivered', paymentStatus: 'paid' },
            }),
        ]);

        return { userId, orderCount, reviewCount, totalSpent: totalSpent || 0 };
    }
}

module.exports = new UserService();
