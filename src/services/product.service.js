const { Product, Category, Inventory } = require('../models');
const { ApiError } = require('../utils/ApiError');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class ProductService {
    /**
     * Get all products with filters and pagination
     */
    async getProducts(filters = {}, pagination = {}) {
        const {
            categoryId,
            minPrice,
            maxPrice,
            search,
            tags,
            isFeatured,
            isDigital,
            inStock,
            sort,
        } = filters;
        const { page = 1, limit = 20 } = pagination;
        const offset = (page - 1) * limit;

        // Build where clause
        const where = { isActive: true };

        if (categoryId) {
            where.categoryId = categoryId;
        }

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
            const tagArray = Array.isArray(tags) ? tags : [tags];
            where.tags = { [Op.overlap]: tagArray };
        }

        if (isFeatured !== undefined) {
            where.isFeatured = isFeatured;
        }

        if (isDigital !== undefined) {
            where.isDigital = isDigital;
        }

        if (inStock === true) {
            where.stock = { [Op.gt]: 0 };
        }

        // Build order clause
        let order = [['createdAt', 'DESC']];
        if (sort) {
            const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
            const sortDir = sort.startsWith('-') ? 'DESC' : 'ASC';
            order = [[sortField, sortDir]];
        }

        const { count, rows } = await Product.findAndCountAll({
            where,
            include: [
                { model: Category, as: 'category', attributes: ['id', 'name'] },
            ],
            order,
            limit,
            offset,
        });

        return {
            data: rows,
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit),
            },
        };
    }

    /**
     * Get product by ID with category details
     */
    async getProductById(productId) {
        const product = await Product.findByPk(productId, {
            include: [
                { model: Category, as: 'category', attributes: ['id', 'name'] },
            ],
        });

        if (!product) {
            throw new ApiError(404, 'Product not found');
        }

        if (!product.isActive) {
            throw new ApiError(400, 'Product is not available');
        }

        // Increment view count
        await product.incrementViewCount();

        return product.toJSON();
    }

    /**
     * Get product with availability details
     */
    async getProductWithAvailability(productId) {
        const product = await Product.findByPk(productId, {
            include: [
                { model: Category, as: 'category' },
                { model: Inventory, as: 'inventory' },
            ],
        });
        if (!product) throw new ApiError(404, 'Product not found');

        return {
            ...product.toJSON(),
            available: product.inventory
                ? product.inventory.available
                : product.stock,
        };
    }

    /**
     * Create a new product
     */
    async createProduct(data) {
        try {
            // Check if SKU already exists
            const existingSku = await Product.findOne({
                where: { sku: data.sku },
            });
            if (existingSku) {
                throw new ApiError(400, 'Product with this SKU already exists');
            }

            // Check if category exists
            if (data.categoryId) {
                const category = await Category.findByPk(data.categoryId);
                if (!category) {
                    throw new ApiError(400, 'Category not found');
                }
            }

            const product = await Product.create(data);

            logger.logBusinessEvent('product_created', {
                productId: product.id,
                productName: product.name,
            });

            return product.toJSON();
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(
                400,
                error.message || 'Failed to create product',
            );
        }
    }

    /**
     * Update product by ID
     */
    async updateProduct(productId, data) {
        try {
            const product = await Product.findByPk(productId);
            if (!product) {
                throw new ApiError(404, 'Product not found');
            }

            // Check if SKU is being changed and if new SKU already exists
            if (data.sku && data.sku !== product.sku) {
                const existingSku = await Product.findOne({
                    where: { sku: data.sku },
                });
                if (existingSku) {
                    throw new ApiError(
                        400,
                        'Product with this SKU already exists',
                    );
                }
            }

            // Check if category exists
            if (data.categoryId && data.categoryId !== product.categoryId) {
                const category = await Category.findByPk(data.categoryId);
                if (!category) {
                    throw new ApiError(400, 'Category not found');
                }
            }

            await product.update(data);

            logger.logBusinessEvent('product_updated', {
                productId: product.id,
                productName: product.name,
                changedFields: Object.keys(data),
            });

            return product.toJSON();
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(
                400,
                error.message || 'Failed to update product',
            );
        }
    }

    /**
     * Delete product by ID
     */
    async deleteProduct(productId) {
        try {
            const product = await Product.findByPk(productId);
            if (!product) {
                throw new ApiError(404, 'Product not found');
            }

            const productName = product.name;
            await product.destroy();

            logger.logBusinessEvent('product_deleted', {
                productId,
                productName,
            });

            return true;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(
                400,
                error.message || 'Failed to delete product',
            );
        }
    }

    /**
     * Check product availability
     */
    async checkAvailability(productId, quantity) {
        const product = await Product.findByPk(productId);
        if (!product) throw new ApiError(404, 'Product not found');
        if (!product.isActive)
            throw new ApiError(400, 'Product is not available');
        if (product.isDigital) return true;
        return product.stock >= quantity;
    }

    /**
     * Update product stock
     */
    async updateStock(productId, quantity, action = 'set') {
        const product = await Product.findByPk(productId);
        if (!product) throw new ApiError(404, 'Product not found');

        const inventory = await Inventory.findOne({ where: { productId } });

        switch (action) {
            case 'set':
                if (inventory) await inventory.updateCount(quantity);
                product.stock = quantity;
                break;
            case 'add':
                if (inventory) await inventory.restock(quantity);
                product.stock += quantity;
                break;
            case 'subtract':
                if (product.stock < quantity)
                    throw new ApiError(400, 'Insufficient stock');
                if (inventory) await inventory.deduct(quantity);
                product.stock -= quantity;
                break;
            default:
                throw new ApiError(400, 'Invalid action');
        }

        await product.save();
        logger.logBusinessEvent('stock_updated', {
            productId,
            action,
            quantity,
            newStock: product.stock,
        });
        return product.stock;
    }

    /**
     * Get low stock products
     */
    async getLowStockProducts() {
        const products = await Product.findAll({
            where: { isActive: true, isDigital: false },
            include: [{ model: Inventory, as: 'inventory', required: false }],
        });
        return products.filter((product) => product.isLowStock());
    }

    /**
     * Get featured products
     */
    async getFeaturedProducts(limit = 10) {
        const products = await Product.findAll({
            where: { isFeatured: true, isActive: true },
            include: [
                { model: Category, as: 'category', attributes: ['id', 'name'] },
            ],
            limit,
            order: [['createdAt', 'DESC']],
        });
        return products;
    }

    /**
     * Get product by slug
     */
    async getProductBySlug(slug) {
        const product = await Product.findOne({
            where: { slug, isActive: true },
            include: [
                { model: Category, as: 'category', attributes: ['id', 'name'] },
            ],
        });

        if (!product) {
            throw new ApiError(404, 'Product not found');
        }

        // Increment view count
        await product.incrementViewCount();

        return product.toJSON();
    }
}

module.exports = new ProductService();
