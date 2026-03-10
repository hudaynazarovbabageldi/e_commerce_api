const {
    Product,
    Category,
    Inventory,
    Review,
    User,
    OrderItem,
} = require('../models');
const { Op } = require('sequelize');

class ProductRepository {
    async findById(productId, options = {}) {
        const {
            includeCategory = false,
            includeInventory = false,
            includeReviews = false,
        } = options;
        const queryOptions = { where: { id: productId } };
        const include = [];

        if (includeCategory) {
            include.push({
                model: Category,
                as: 'category',
                attributes: ['id', 'name', 'slug'],
            });
        }

        if (includeInventory) {
            include.push({ model: Inventory, as: 'inventory' });
        }

        if (includeReviews) {
            include.push({
                model: Review,
                as: 'reviews',
                where: { isApproved: true },
                required: false,
                include: [
                    {
                        model: User,
                        as: 'user',
                        attributes: ['id', 'firstName', 'lastName', 'avatar'],
                    },
                ],
            });
        }

        if (include.length > 0) queryOptions.include = include;
        return await Product.findOne(queryOptions);
    }

    async findBySlug(slug) {
        return await Product.findOne({
            where: { slug, isActive: true },
            include: [
                { model: Category, as: 'category' },
                { model: Inventory, as: 'inventory' },
            ],
        });
    }

    async findBySku(sku) {
        return await Product.findOne({ where: { sku } });
    }

    async findAll(filters = {}, pagination = {}) {
        const {
            categoryId,
            search,
            minPrice,
            maxPrice,
            tags,
            isFeatured,
            isActive,
            inStock,
            brand,
        } = filters;
        const {
            limit = 20,
            offset = 0,
            orderBy = 'createdAt',
            orderDirection = 'DESC',
        } = pagination;

        const where = {};

        if (categoryId) where.categoryId = categoryId;
        if (isFeatured !== undefined) where.isFeatured = isFeatured;
        if (isActive !== undefined) where.isActive = isActive;
        if (brand) where.brand = brand;

        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice) where.price[Op.gte] = minPrice;
            if (maxPrice) where.price[Op.lte] = maxPrice;
        }

        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { description: { [Op.iLike]: `%${search}%` } },
                { sku: { [Op.iLike]: `%${search}%` } },
            ];
        }

        if (tags && tags.length > 0) {
            where.tags = { [Op.overlap]: tags };
        }

        if (inStock) {
            where.stock = { [Op.gt]: 0 };
        }

        return await Product.findAndCountAll({
            where,
            include: [
                {
                    model: Category,
                    as: 'category',
                    attributes: ['id', 'name', 'slug'],
                },
            ],
            limit,
            offset,
            order: [[orderBy, orderDirection]],
            distinct: true,
        });
    }

    async create(productData) {
        return await Product.create(productData);
    }

    async update(productId, updateData) {
        const product = await Product.findByPk(productId);
        if (!product) return null;

        Object.keys(updateData).forEach((key) => {
            product[key] = updateData[key];
        });

        await product.save();
        return product;
    }

    async delete(productId) {
        const deleted = await Product.destroy({ where: { id: productId } });
        return deleted > 0;
    }

    async findFeatured(limit = 10) {
        return await Product.findAll({
            where: { isFeatured: true, isActive: true },
            include: [
                {
                    model: Category,
                    as: 'category',
                    attributes: ['id', 'name', 'slug'],
                },
            ],
            limit,
            order: [['createdAt', 'DESC']],
        });
    }

    async findLowStock() {
        return await Product.findAll({
            where: {
                isActive: true,
                isDigital: false,
                [Op.and]: [
                    Product.sequelize.literal('stock > 0'),
                    Product.sequelize.literal('stock <= low_stock_threshold'),
                ],
            },
            include: [{ model: Inventory, as: 'inventory' }],
            order: [['stock', 'ASC']],
        });
    }

    async findOutOfStock() {
        return await Product.findAll({
            where: { isActive: true, isDigital: false, stock: 0 },
            order: [['updatedAt', 'DESC']],
        });
    }

    async findByCategory(categoryId, pagination = {}) {
        const { limit = 20, offset = 0 } = pagination;
        return await Product.findAndCountAll({
            where: { categoryId, isActive: true },
            limit,
            offset,
            order: [['createdAt', 'DESC']],
        });
    }

    async findByVendor(vendorId, pagination = {}) {
        const { limit = 20, offset = 0 } = pagination;
        return await Product.findAndCountAll({
            where: { vendorId },
            include: [
                {
                    model: Category,
                    as: 'category',
                    attributes: ['id', 'name', 'slug'],
                },
            ],
            limit,
            offset,
            order: [['createdAt', 'DESC']],
        });
    }

    async findRelated(productId, limit = 5) {
        const product = await Product.findByPk(productId);
        if (!product) return [];

        return await Product.findAll({
            where: {
                id: { [Op.ne]: productId },
                categoryId: product.categoryId,
                isActive: true,
            },
            limit,
            order: [['rating', 'DESC']],
        });
    }

    async findBestSelling(limit = 10) {
        return await Product.findAll({
            where: { isActive: true },
            limit,
            order: [['soldCount', 'DESC']],
        });
    }

    async findMostViewed(limit = 10) {
        return await Product.findAll({
            where: { isActive: true },
            limit,
            order: [['viewCount', 'DESC']],
        });
    }

    async findTopRated(limit = 10) {
        return await Product.findAll({
            where: { isActive: true, reviewCount: { [Op.gt]: 0 } },
            limit,
            order: [
                ['rating', 'DESC'],
                ['reviewCount', 'DESC'],
            ],
        });
    }

    async findNewArrivals(limit = 10, days = 30) {
        const date = new Date();
        date.setDate(date.getDate() - days);

        return await Product.findAll({
            where: { isActive: true, createdAt: { [Op.gte]: date } },
            limit,
            order: [['createdAt', 'DESC']],
        });
    }

    async findOnSale(pagination = {}) {
        const { limit = 20, offset = 0 } = pagination;
        return await Product.findAndCountAll({
            where: {
                isActive: true,
                comparePrice: { [Op.gt]: Product.sequelize.col('price') },
            },
            limit,
            offset,
            order: [
                [
                    Product.sequelize.literal(
                        '((compare_price - price) / compare_price) * 100',
                    ),
                    'DESC',
                ],
            ],
        });
    }

    async search(query, pagination = {}) {
        const { limit = 20, offset = 0 } = pagination;
        return await Product.findAndCountAll({
            where: {
                isActive: true,
                [Op.or]: [
                    { name: { [Op.iLike]: `%${query}%` } },
                    { description: { [Op.iLike]: `%${query}%` } },
                    { tags: { [Op.contains]: [query.toLowerCase()] } },
                ],
            },
            include: [
                {
                    model: Category,
                    as: 'category',
                    attributes: ['id', 'name', 'slug'],
                },
            ],
            limit,
            offset,
            order: [
                ['rating', 'DESC'],
                ['soldCount', 'DESC'],
            ],
        });
    }

    async incrementViewCount(productId) {
        await Product.increment('viewCount', { where: { id: productId } });
    }

    async incrementSoldCount(productId, quantity = 1) {
        await Product.increment('soldCount', {
            by: quantity,
            where: { id: productId },
        });
    }

    async updateStock(productId, quantity) {
        await Product.update({ stock: quantity }, { where: { id: productId } });
    }

    async bulkUpdate(productIds, updateData) {
        const [updated] = await Product.update(updateData, {
            where: { id: { [Op.in]: productIds } },
        });
        return updated;
    }

    async countByCategory() {
        return await Product.findAll({
            attributes: [
                'categoryId',
                [
                    Product.sequelize.fn('COUNT', Product.sequelize.col('id')),
                    'count',
                ],
            ],
            where: { isActive: true },
            group: ['categoryId'],
            include: [
                { model: Category, as: 'category', attributes: ['name'] },
            ],
        });
    }

    async getTopRevenueProducts(startDate, endDate, limit = 10) {
        return await Product.findAll({
            attributes: [
                'id',
                'name',
                'sku',
                [
                    Product.sequelize.fn(
                        'SUM',
                        Product.sequelize.col('orderItems.total'),
                    ),
                    'revenue',
                ],
                [
                    Product.sequelize.fn(
                        'SUM',
                        Product.sequelize.col('orderItems.quantity'),
                    ),
                    'quantitySold',
                ],
            ],
            include: [
                {
                    model: OrderItem,
                    as: 'orderItems',
                    attributes: [],
                    required: true,
                    where: {
                        createdAt: { [Op.between]: [startDate, endDate] },
                    },
                },
            ],
            group: ['Product.id'],
            order: [[Product.sequelize.literal('revenue'), 'DESC']],
            limit,
            subQuery: false,
        });
    }

    async skuExists(sku, excludeProductId = null) {
        const where = { sku };
        if (excludeProductId) {
            where.id = { [Op.ne]: excludeProductId };
        }
        const count = await Product.count({ where });
        return count > 0;
    }
}

module.exports = new ProductRepository();
