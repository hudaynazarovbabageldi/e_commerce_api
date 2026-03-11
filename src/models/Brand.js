const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
    class Brand extends Model {}

    Brand.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            title: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            imageUrl: {
                type: DataTypes.STRING(500),
                allowNull: false,
                field: 'image_url',
            },
            position: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },
            isActive: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
                field: 'is_active',
            },
        },
        {
            sequelize,
            modelName: 'Brand',
            tableName: 'brands',
            timestamps: true,
            underscored: true,
            indexes: [{ fields: ['is_active'] }, { fields: ['position'] }],
        },
    );

    return Brand;
};
