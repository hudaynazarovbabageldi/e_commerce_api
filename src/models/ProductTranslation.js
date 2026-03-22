const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
    class ProductTranslation extends Model {}

    ProductTranslation.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },

            productId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'product_id',
            },

            locale: {
                type: DataTypes.STRING(10),
                allowNull: false,
            },

            name: {
                type: DataTypes.STRING(200),
                allowNull: false,
            },

            slug: {
                type: DataTypes.STRING(250),
                allowNull: false,
            },

            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            shortDescription: {
                type: DataTypes.STRING(500),
                field: 'short_description',
            },

            metaTitle: {
                type: DataTypes.STRING(200),
                field: 'meta_title',
            },

            metaDescription: {
                type: DataTypes.TEXT,
                field: 'meta_description',
            },
        },
        {
            sequelize,
            modelName: 'ProductTranslation',
            tableName: 'product_translations',
            timestamps: true,
            underscored: true,
            indexes: [
                { unique: true, fields: ['product_id', 'locale'] },
                { unique: true, fields: ['locale', 'slug'] },
                { fields: ['product_id'] },
                { fields: ['locale'] },
            ],
            hooks: {
                beforeValidate: (translation) => {
                    if (translation.locale) {
                        translation.locale = translation.locale
                            .toLowerCase()
                            .trim();
                    }

                    if (translation.name && !translation.slug) {
                        translation.slug = translation.name
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/(^-|-$)/g, '');
                    }
                },
            },
        },
    );

    return ProductTranslation;
};
