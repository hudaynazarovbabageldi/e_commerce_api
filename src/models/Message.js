const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
    class Message extends Model {}

    Message.init(
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
            senderId: {
                type: DataTypes.UUID,
                allowNull: false,
                field: 'sender_id',
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            type: {
                type: DataTypes.ENUM('text', 'image', 'file', 'system'),
                allowNull: false,
                defaultValue: 'text',
            },
            content: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            attachments: {
                type: DataTypes.JSONB,
                allowNull: true,
            },
            replyToMessageId: {
                type: DataTypes.UUID,
                allowNull: true,
                field: 'reply_to_message_id',
            },
            isEdited: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                field: 'is_edited',
            },
            editedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'edited_at',
            },
            isDeleted: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
                field: 'is_deleted',
            },
            deletedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                field: 'deleted_at',
            },
            metadata: {
                type: DataTypes.JSONB,
                allowNull: true,
            },
        },
        {
            sequelize,
            modelName: 'Message',
            tableName: 'messages',
            timestamps: true,
            underscored: true,
            indexes: [
                { fields: ['conversation_id', 'created_at'] },
                { fields: ['sender_id'] },
                { fields: ['reply_to_message_id'] },
            ],
        },
    );

    return Message;
};
