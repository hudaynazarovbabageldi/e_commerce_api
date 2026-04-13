const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
    class ConversationParticipant extends Model {}

    ConversationParticipant.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            conversationId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'conversation_id',
                references: {
                    model: 'conversations',
                    key: 'id',
                },
            },
            userId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'user_id',
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            role: {
                type: DataTypes.ENUM('owner', 'admin', 'member'),
                allowNull: false,
                defaultValue: 'member',
            },
            joinedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                field: 'joined_at',
            },
            leftAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'left_at',
            },
            lastReadMessageId: {
                type: DataTypes.UUID,
                allowNull: true,
                field: 'last_read_message_id',
            },
            lastReadAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'last_read_at',
            },
            isMuted: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                field: 'is_muted',
            },
            isPinned: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                field: 'is_pinned',
            },
            isArchived: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                field: 'is_archived',
            },
        },
        {
            sequelize,
            modelName: 'ConversationParticipant',
            tableName: 'conversation_participants',
            timestamps: true,
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ['conversation_id', 'user_id'],
                },
                { fields: ['user_id'] },
                { fields: ['conversation_id'] },
                { fields: ['is_archived'] },
                { fields: ['last_read_at'] },
            ],
        },
    );

    return ConversationParticipant;
};
