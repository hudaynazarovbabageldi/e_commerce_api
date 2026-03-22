const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
    class Product extends Model {
        // Instance methods
        toJSON() {
            const values = { ...this.get() };

            if (values.comparePrice && values.comparePrice > values.price) {
                values.discountPercentage = Math.round(
                    ((values.comparePrice - values.price) /
                        values.comparePrice) *
                        100,
                );
            }

            values.inStock = values.stock > 0;
            values.isLowStock =
                values.stock > 0 && values.stock <= values.lowStockThreshold;

            return values;
        }

        isInStock() {
            return this.stock > 0;
        }

        isLowStock() {
            return this.stock > 0 && this.stock <= this.lowStockThreshold;
        }

        async incrementViewCount() {
            this.viewCount += 1;
            await this.save();
        }

        async incrementSoldCount(quantity = 1) {
            this.soldCount += quantity;
            await this.save();
        }

        async decreaseStock(quantity) {
            if (this.stock < quantity) {
                throw new Error('Insufficient stock');
            }
            this.stock -= quantity;
            await this.save();
        }

        async increaseStock(quantity) {
            this.stock += quantity;
            await this.save();
        }

        async updateRating(newRating) {
            const totalRating = this.rating * this.reviewCount;

            this.reviewCount += 1;
            this.rating = (totalRating + newRating) / this.reviewCount;

            await this.save();
        }

        // Static methods
        static async findBySlug(slug) {
            return await this.findOne({ where: { slug } });
        }

        static async findBySku(sku) {
            return await this.findOne({ where: { sku } });
        }

        static async findFeatured(limit = 10) {
            return await this.findAll({
                where: { isFeatured: true, isActive: true },
                limit,
                order: [['createdAt', 'DESC']],
            });
        }

        static async findLowStock() {
            return await this.findAll({
                where: sequelize.literal(
                    'stock > 0 AND stock <= low_stock_threshold',
                ),
                order: [['stock', 'ASC']],
            });
        }
    }

    Product.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },

            name: {
                type: DataTypes.STRING(200),
                allowNull: true,
            },

            slug: {
                type: DataTypes.STRING(250),
                allowNull: true,
                unique: true,
            },

            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            shortDescription: {
                type: DataTypes.STRING(500),
                field: 'short_description',
            },

            sku: {
                type: DataTypes.STRING(100),
                allowNull: false,
                unique: true,
            },

            price: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },

            comparePrice: {
                type: DataTypes.DECIMAL(10, 2),
                field: 'compare_price',
            },

            costPrice: {
                type: DataTypes.DECIMAL(10, 2),
                field: 'cost_price',
            },

            stock: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },

            lowStockThreshold: {
                type: DataTypes.INTEGER,
                defaultValue: 10,
                field: 'low_stock_threshold',
            },

            weight: {
                type: DataTypes.DECIMAL(10, 2),
            },

            dimensions: {
                type: DataTypes.JSON,
            },

            images: {
                type: DataTypes.ARRAY(DataTypes.STRING),
                defaultValue: [],
            },

            thumbnail: {
                type: DataTypes.STRING,
            },

            categoryId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'category_id',
            },

            vendorId: {
                type: DataTypes.UUID,
                field: 'vendor_id',
            },

            brandId: {
                type: DataTypes.UUID,
                allowNull: true,
                field: 'brand_id',
            },

            tags: {
                type: DataTypes.ARRAY(DataTypes.STRING),
                defaultValue: [],
            },

            isActive: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
                field: 'is_active',
            },

            isFeatured: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                field: 'is_featured',
            },

            isDigital: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                field: 'is_digital',
            },

            downloadUrl: {
                type: DataTypes.STRING,
                field: 'download_url',
            },

            taxable: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
            },

            taxRate: {
                type: DataTypes.DECIMAL(5, 2),
                defaultValue: 0,
                field: 'tax_rate',
            },

            rating: {
                type: DataTypes.DECIMAL(3, 2),
                defaultValue: 0,
            },

            reviewCount: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                field: 'review_count',
            },

            viewCount: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                field: 'view_count',
            },

            soldCount: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                field: 'sold_count',
            },

            publishedAt: {
                type: DataTypes.DATE,
                field: 'published_at',
            },
        },
        {
            sequelize,
            modelName: 'Product',
            tableName: 'products',
            timestamps: true,
            underscored: true,

            indexes: [
                { unique: true, fields: ['slug'] },
                { unique: true, fields: ['sku'] },
                { fields: ['category_id'] },
                { fields: ['vendor_id'] },
                { fields: ['is_active'] },
                { fields: ['is_featured'] },
                { fields: ['price'] },
                { fields: ['rating'] },
                { fields: ['created_at'] },
                { type: 'GIN', fields: ['tags'] },
            ],

            hooks: {
                beforeValidate: (product) => {
                    if (product.name && !product.slug) {
                        product.slug = product.name
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/(^-|-$)/g, '');
                    }
                },

                beforeCreate: (product) => {
                    if (!product.thumbnail && product.images?.length) {
                        product.thumbnail = product.images[0];
                    }
                },
            },
        },
    );

    return Product;
};
