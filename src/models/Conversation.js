const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
    class Conversation extends Model {
        static async findByType(type, options = {}) {
            return await this.findAll({
                where: { type },
                ...options,
            });
        }
    }

    Conversation.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            type: {
                type: DataTypes.ENUM('direct', 'group', 'support'),
                allowNull: false,
                defaultValue: 'direct',
            },
            title: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },
            createdBy: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'created_by',
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            lastMessageAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'last_message_at',
            },
            lastMessagePreview: {
                type: DataTypes.STRING(500),
                allowNull: true,
                field: 'last_message_preview',
            },
            metadata: {
                type: DataTypes.JSONB,
                allowNull: true,
            },
        },
        {
            sequelize,
            modelName: 'Conversation',
            tableName: 'conversations',
            timestamps: true,
            underscored: true,
            indexes: [
                { fields: ['type'] },
                { fields: ['created_by'] },
                { fields: ['last_message_at'] },
            ],
        },
    );

    return Conversation;
};
