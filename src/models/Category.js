const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
    class Category extends Model {
        // Instance methods
        toJSON() {
            const values = { ...this.get() };
            values.hasChildren = values.productCount > 0;
            return values;
        }

        async getParent() {
            if (!this.parentId) return null;
            return await Category.findByPk(this.parentId);
        }

        async getChildren() {
            return await Category.findAll({
                where: { parentId: this.id, isActive: true },
                order: [
                    ['sortOrder', 'ASC'],
                    ['name', 'ASC'],
                ],
            });
        }

        async getFullPath() {
            const path = [this.name];
            let current = this;

            while (current.parentId) {
                current = await Category.findByPk(current.parentId);
                if (current) path.unshift(current.name);
            }

            return path.join(' > ');
        }

        // Static methods
        static async findBySlug(slug) {
            return await this.findOne({
                where: { slug, isActive: true },
            });
        }

        static async findRootCategories() {
            return await this.findAll({
                where: { parentId: null, isActive: true },
                order: [
                    ['sortOrder', 'ASC'],
                    ['name', 'ASC'],
                ],
            });
        }

        static async findFeatured(limit = 10) {
            return await this.findAll({
                where: { isFeatured: true, isActive: true },
                limit,
                order: [['sortOrder', 'ASC']],
            });
        }
    }

    Category.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },

            name: {
                type: DataTypes.STRING(100),
                allowNull: false,
                validate: {
                    notEmpty: {
                        msg: 'Category name is required',
                    },
                    len: {
                        args: [2, 100],
                        msg: 'Category name must be between 2 and 100 characters',
                    },
                },
            },

            slug: {
                type: DataTypes.STRING(120),
                allowNull: false,
                unique: true,
            },

            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            image: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            parentId: {
                type: DataTypes.UUID,
                allowNull: true,
                field: 'parent_id',
            },

            level: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },

            sortOrder: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                field: 'sort_order',
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

            productCount: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                field: 'product_count',
            },

            metaTitle: {
                type: DataTypes.STRING(200),
                field: 'meta_title',
            },

            metaDescription: {
                type: DataTypes.TEXT,
                field: 'meta_description',
            },

            metaKeywords: {
                type: DataTypes.ARRAY(DataTypes.STRING),
                defaultValue: [],
                field: 'meta_keywords',
            },
        },
        {
            sequelize,
            modelName: 'Category',
            tableName: 'categories',
            timestamps: true,
            underscored: true,

            indexes: [
                { unique: true, fields: ['slug'] },
                { fields: ['parent_id'] },
                { fields: ['is_active'] },
                { fields: ['is_featured'] },
            ],

            hooks: {
                beforeValidate: (category) => {
                    if (category.name && !category.slug) {
                        category.slug = category.name
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/(^-|-$)/g, '');
                    }
                },

                beforeCreate: async (category) => {
                    if (category.parentId) {
                        const parent = await Category.findByPk(
                            category.parentId,
                        );
                        if (parent) {
                            category.level = parent.level + 1;
                        }
                    }
                },
            },
        },
    );

    return Category;
};
