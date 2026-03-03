const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
    class Banner extends Model {}

    Banner.init(
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
            link: {
                type: DataTypes.STRING(500),
                allowNull: true,
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
            startDate: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'start_date',
            },
            endDate: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'end_date',
            },
        },
        {
            sequelize,
            modelName: 'Banner',
            tableName: 'banners',
            timestamps: true,
            underscored: true,
            indexes: [{ fields: ['is_active'] }, { fields: ['position'] }],
        },
    );

    return Banner;
};
