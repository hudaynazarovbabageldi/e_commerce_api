const {
    Product,
    Category,
    ProductTranslation,
    Inventory,
} = require('../models');
const { ApiError } = require('../utils/ApiError');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class ProductService {
    defaultLocale = 'en';

    normalizeLocale(locale) {
        if (!locale || typeof locale !== 'string') {
            return null;
        }

        const normalized = locale.toLowerCase().trim();
        return normalized || null;
    }

    resolveLocales(locale, fallbackLocale) {
        const requestedLocale = this.normalizeLocale(locale);
        const fallback =
            this.normalizeLocale(fallbackLocale) || this.defaultLocale;

        if (!requestedLocale) {
            return [fallback];
        }

        return requestedLocale === fallback
            ? [requestedLocale]
            : [requestedLocale, fallback];
    }

    pickTranslation(translations = [], locale, fallbackLocale) {
        if (!translations.length) {
            return null;
        }

        const locales = this.resolveLocales(locale, fallbackLocale);

        for (const itemLocale of locales) {
            const translation = translations.find(
                (item) => item.locale === itemLocale,
            );
            if (translation) {
                return translation;
            }
        }

        return translations[0];
    }

    applyTranslation(product, locale, fallbackLocale) {
        const data = product.toJSON ? product.toJSON() : { ...product };
        const selected = this.pickTranslation(
            data.translations || [],
            locale,
            fallbackLocale,
        );

        if (selected) {
            data.name = selected.name || data.name;
            data.slug = selected.slug || data.slug;
            data.description = selected.description || data.description;
            data.shortDescription =
                selected.shortDescription || data.shortDescription;
            data.metaTitle = selected.metaTitle || data.metaTitle;
            data.metaDescription =
                selected.metaDescription || data.metaDescription;
            data.locale = selected.locale;
        } else {
            data.locale = this.resolveLocales(locale, fallbackLocale)[0];
        }

        delete data.translations;
        return data;
    }

    buildTranslationPayload(payload = {}) {
        return {
            name: payload.name,
            slug: payload.slug,
            description: payload.description,
            shortDescription: payload.shortDescription,
            metaTitle: payload.metaTitle,
            metaDescription: payload.metaDescription,
        };
    }

    async ensureUniqueTranslationSlug(locale, slug, productId) {
        if (!slug) return;

        const existing = await ProductTranslation.findOne({
            where: {
                locale,
                slug,
                ...(productId ? { productId: { [Op.ne]: productId } } : {}),
            },
        });

        if (existing) {
            throw new ApiError(
                400,
                `Slug '${slug}' already exists for locale '${locale}'`,
            );
        }
    }

    /**
     * Get all products with filters and pagination
     */
    async getProducts(filters = {}, pagination = {}, options = {}) {
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
        const { locale, fallbackLocale } = options;
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
                { '$translations.name$': { [Op.iLike]: `%${search}%` } },
                {
                    '$translations.description$': {
                        [Op.iLike]: `%${search}%`,
                    },
                },
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
                {
                    model: ProductTranslation,
                    as: 'translations',
                    required: false,
                    where: {
                        locale: {
                            [Op.in]: this.resolveLocales(
                                locale,
                                fallbackLocale,
                            ),
                        },
                    },
                },
            ],
            order,
            limit,
            offset,
            distinct: true,
        });

        const localizedRows = rows.map((product) =>
            this.applyTranslation(product, locale, fallbackLocale),
        );

        return {
            data: localizedRows,
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
    async getProductById(productId, options = {}) {
        const { locale, fallbackLocale } = options;
        const product = await Product.findByPk(productId, {
            include: [
                { model: Category, as: 'category', attributes: ['id', 'name'] },
                {
                    model: ProductTranslation,
                    as: 'translations',
                    required: false,
                    where: {
                        locale: {
                            [Op.in]: this.resolveLocales(
                                locale,
                                fallbackLocale,
                            ),
                        },
                    },
                },
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

        return this.applyTranslation(product, locale, fallbackLocale);
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
        console.log('data: ', data);
        try {
            const { locale, translation, translations } = data;
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

            const productPayload = { ...data };

            console.log('new: ', productPayload);
            delete productPayload.locale;
            delete productPayload.translation;
            delete productPayload.translations;

            console.log('productPayload: ', productPayload);
            const product = await Product.create(productPayload);

            const baseLocale =
                this.normalizeLocale(locale) || this.defaultLocale;
            const translationData = translation || {
                locale: baseLocale,
                ...this.buildTranslationPayload(data),
            };

            if (translationData.name && translationData.slug) {
                const normalizedLocale =
                    this.normalizeLocale(translationData.locale) || baseLocale;

                await this.ensureUniqueTranslationSlug(
                    normalizedLocale,
                    translationData.slug,
                );

                await ProductTranslation.create({
                    productId: product.id,
                    locale: normalizedLocale,
                    ...this.buildTranslationPayload(translationData),
                });
            }

            if (Array.isArray(translations)) {
                for (const item of translations) {
                    const itemLocale = this.normalizeLocale(item.locale);
                    if (!itemLocale || !item.name || !item.slug) continue;

                    await this.ensureUniqueTranslationSlug(
                        itemLocale,
                        item.slug,
                    );

                    await ProductTranslation.upsert({
                        productId: product.id,
                        locale: itemLocale,
                        ...this.buildTranslationPayload(item),
                    });
                }
            }

            logger.logBusinessEvent('product_created', {
                productId: product.id,
                productName: product.name,
            });

            const productWithTranslations = await Product.findByPk(product.id, {
                include: [
                    {
                        model: ProductTranslation,
                        as: 'translations',
                        required: false,
                    },
                ],
            });

            return this.applyTranslation(
                productWithTranslations,
                baseLocale,
                this.defaultLocale,
            );
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
            const { locale, translation, translations } = data;
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

            const productPayload = { ...data };
            delete productPayload.locale;
            delete productPayload.translation;
            delete productPayload.translations;

            await product.update(productPayload);

            if (translation) {
                const translationLocale =
                    this.normalizeLocale(translation.locale || locale) ||
                    this.defaultLocale;

                if (!translation.name || !translation.slug) {
                    throw new ApiError(
                        400,
                        'Translation requires both name and slug',
                    );
                }

                await this.ensureUniqueTranslationSlug(
                    translationLocale,
                    translation.slug,
                    productId,
                );

                await ProductTranslation.upsert({
                    productId,
                    locale: translationLocale,
                    ...this.buildTranslationPayload(translation),
                });
            }

            if (Array.isArray(translations)) {
                for (const item of translations) {
                    const itemLocale = this.normalizeLocale(item.locale);
                    if (!itemLocale) continue;

                    if (!item.name || !item.slug) {
                        throw new ApiError(
                            400,
                            'Each translation must include locale, name and slug',
                        );
                    }

                    await this.ensureUniqueTranslationSlug(
                        itemLocale,
                        item.slug,
                        productId,
                    );

                    await ProductTranslation.upsert({
                        productId,
                        locale: itemLocale,
                        ...this.buildTranslationPayload(item),
                    });
                }
            }

            logger.logBusinessEvent('product_updated', {
                productId: product.id,
                productName: product.name,
                changedFields: Object.keys(data),
            });

            const requestedLocale = this.normalizeLocale(locale);
            const productWithTranslations = await Product.findByPk(product.id, {
                include: [
                    {
                        model: ProductTranslation,
                        as: 'translations',
                        required: false,
                        where: {
                            locale: {
                                [Op.in]: this.resolveLocales(
                                    requestedLocale,
                                    this.defaultLocale,
                                ),
                            },
                        },
                    },
                ],
            });

            return this.applyTranslation(
                productWithTranslations,
                requestedLocale,
                this.defaultLocale,
            );
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

    async getProductTranslations(productId) {
        const product = await Product.findByPk(productId, {
            attributes: ['id', 'name', 'slug'],
        });

        if (!product) {
            throw new ApiError(404, 'Product not found');
        }

        const translations = await ProductTranslation.findAll({
            where: { productId },
            order: [['locale', 'ASC']],
        });

        return {
            productId,
            defaultName: product.name,
            defaultSlug: product.slug,
            translations,
        };
    }

    async upsertProductTranslation(productId, locale, payload = {}) {
        const product = await Product.findByPk(productId);
        if (!product) {
            throw new ApiError(404, 'Product not found');
        }

        const normalizedLocale = this.normalizeLocale(locale);
        if (!normalizedLocale) {
            throw new ApiError(400, 'Locale is required');
        }

        if (!payload.name || !payload.slug) {
            throw new ApiError(400, 'Translation requires both name and slug');
        }

        await this.ensureUniqueTranslationSlug(
            normalizedLocale,
            payload.slug,
            productId,
        );

        await ProductTranslation.upsert({
            productId,
            locale: normalizedLocale,
            ...this.buildTranslationPayload(payload),
        });

        const savedTranslation = await ProductTranslation.findOne({
            where: {
                productId,
                locale: normalizedLocale,
            },
        });

        logger.logBusinessEvent('product_translation_upserted', {
            productId,
            locale: normalizedLocale,
        });

        return savedTranslation;
    }
}

module.exports = new ProductService();
