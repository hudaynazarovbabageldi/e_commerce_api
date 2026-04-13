const {
    sequelize,
    Sequelize,
    User,
    Conversation,
    ConversationParticipant,
    Message,
} = require('../models');
const { ApiError } = require('../utils/ApiError');

const { Op } = Sequelize;

class ChatService {
    async ensureUserExists(userId) {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }
        return user;
    }

    async ensureParticipant(conversationId, userId, options = {}) {
        const participant = await ConversationParticipant.findOne({
            where: {
                conversationId,
                userId,
            },
            ...options,
        });

        if (!participant || participant.leftAt) {
            throw new ApiError(
                403,
                'You are not an active participant in this conversation',
            );
        }

        return participant;
    }

    async createConversation(creatorId, payload) {
        await this.ensureUserExists(creatorId);

        const {
            type = 'direct',
            title,
            participantIds = [],
            initialMessage,
            metadata,
        } = payload;

        const normalizedParticipantIds = [
            ...new Set([creatorId, ...participantIds]),
        ];

        if (type === 'direct' && normalizedParticipantIds.length !== 2) {
            throw new ApiError(
                400,
                'Direct conversations must contain exactly two participants',
            );
        }

        if (
            ['group', 'support'].includes(type) &&
            normalizedParticipantIds.length < 2
        ) {
            throw new ApiError(
                400,
                'Group or support conversation needs at least two participants',
            );
        }

        const usersCount = await User.count({
            where: {
                id: {
                    [Op.in]: normalizedParticipantIds,
                },
            },
        });

        if (usersCount !== normalizedParticipantIds.length) {
            throw new ApiError(404, 'One or more participants were not found');
        }

        if (type === 'direct') {
            const existingDirect = await this.findExistingDirectConversation(
                normalizedParticipantIds,
            );

            if (existingDirect) {
                return await this.getConversationById(
                    creatorId,
                    existingDirect.id,
                );
            }
        }

        const conversation = await sequelize.transaction(
            async (transaction) => {
                const createdConversation = await Conversation.create(
                    {
                        type,
                        title: title || null,
                        createdBy: creatorId,
                        metadata: metadata || null,
                        lastMessageAt: null,
                        lastMessagePreview: null,
                    },
                    { transaction },
                );

                const participantsPayload = normalizedParticipantIds.map(
                    (id) => ({
                        conversationId: createdConversation.id,
                        userId: id,
                        role: id === creatorId ? 'owner' : 'member',
                        joinedAt: new Date(),
                        lastReadAt: null,
                    }),
                );

                await ConversationParticipant.bulkCreate(participantsPayload, {
                    transaction,
                });

                if (initialMessage && initialMessage.trim()) {
                    const message = await Message.create(
                        {
                            conversationId: createdConversation.id,
                            senderId: creatorId,
                            type: 'text',
                            content: initialMessage.trim(),
                        },
                        { transaction },
                    );

                    await createdConversation.update(
                        {
                            lastMessageAt: message.createdAt,
                            lastMessagePreview: this.buildMessagePreview(
                                message.content,
                            ),
                        },
                        { transaction },
                    );

                    await ConversationParticipant.update(
                        {
                            lastReadMessageId: message.id,
                            lastReadAt: new Date(),
                        },
                        {
                            where: {
                                conversationId: createdConversation.id,
                                userId: creatorId,
                            },
                            transaction,
                        },
                    );
                }

                return createdConversation;
            },
        );

        return await this.getConversationById(creatorId, conversation.id);
    }

    async findExistingDirectConversation(participantIds) {
        const conversations = await Conversation.findAll({
            where: { type: 'direct' },
            include: [
                {
                    model: ConversationParticipant,
                    as: 'participants',
                    attributes: ['userId', 'leftAt'],
                },
            ],
        });

        const target = [...participantIds].sort().join('|');

        for (const conversation of conversations) {
            const active = conversation.participants
                .filter((participant) => !participant.leftAt)
                .map((participant) => participant.userId)
                .sort()
                .join('|');

            if (active === target) {
                return conversation;
            }
        }

        return null;
    }

    async listConversations(userId, query = {}) {
        const page = Math.max(parseInt(query.page, 10) || 1, 1);
        const limit = Math.min(
            Math.max(parseInt(query.limit, 10) || 20, 1),
            100,
        );
        const offset = (page - 1) * limit;
        const archived = query.archived;

        const participantWhere = {
            userId,
            leftAt: null,
        };

        if (typeof archived === 'boolean') {
            participantWhere.isArchived = archived;
        }

        const { rows, count } = await Conversation.findAndCountAll({
            include: [
                {
                    model: ConversationParticipant,
                    as: 'participants',
                    where: participantWhere,
                    attributes: [
                        'id',
                        'userId',
                        'role',
                        'isMuted',
                        'isPinned',
                        'isArchived',
                        'lastReadMessageId',
                        'lastReadAt',
                    ],
                    required: true,
                },
            ],
            limit,
            offset,
            order: [
                [
                    { model: ConversationParticipant, as: 'participants' },
                    'isPinned',
                    'DESC',
                ],
                ['lastMessageAt', 'DESC'],
                ['updatedAt', 'DESC'],
            ],
            distinct: true,
        });

        const conversationIds = rows.map((conversation) => conversation.id);
        const hydrated = await this.hydrateConversationsForList(
            conversationIds,
            userId,
        );

        return {
            items: hydrated,
            pagination: {
                totalItems: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                itemsPerPage: limit,
            },
        };
    }

    async hydrateConversationsForList(conversationIds, userId) {
        if (!conversationIds.length) {
            return [];
        }

        const conversations = await Conversation.findAll({
            where: { id: { [Op.in]: conversationIds } },
            include: [
                {
                    model: ConversationParticipant,
                    as: 'participants',
                    where: { leftAt: null },
                    required: false,
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: [
                                'id',
                                'firstName',
                                'lastName',
                                'email',
                                'avatar',
                                'role',
                            ],
                        },
                    ],
                },
            ],
            order: [
                ['lastMessageAt', 'DESC'],
                ['updatedAt', 'DESC'],
            ],
        });

        const lastMessages = await Message.findAll({
            where: { conversationId: { [Op.in]: conversationIds } },
            include: [
                {
                    model: User,
                    as: 'sender',
                    attributes: ['id', 'firstName', 'lastName', 'avatar'],
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        const byConversation = new Map();
        for (const message of lastMessages) {
            if (
                !byConversation.has(message.conversationId) &&
                !message.isDeleted
            ) {
                byConversation.set(message.conversationId, message);
            }
        }

        return conversations
            .sort((a, b) => {
                if (a.lastMessageAt && b.lastMessageAt) {
                    return (
                        new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
                    );
                }
                return new Date(b.updatedAt) - new Date(a.updatedAt);
            })
            .map((conversation) => {
                const me = conversation.participants.find(
                    (participant) => participant.userId === userId,
                );

                const unreadCount = this.calculateUnreadCountForConversation(
                    conversation,
                    me,
                    lastMessages,
                );

                return {
                    ...conversation.toJSON(),
                    currentUserParticipant: me || null,
                    unreadCount,
                    lastMessage: byConversation.get(conversation.id) || null,
                };
            });
    }

    calculateUnreadCountForConversation(conversation, me, messages) {
        if (!me) {
            return 0;
        }

        return messages.filter((message) => {
            if (message.conversationId !== conversation.id) {
                return false;
            }

            if (message.isDeleted || message.senderId === me.userId) {
                return false;
            }

            if (!me.lastReadAt) {
                return true;
            }

            return new Date(message.createdAt) > new Date(me.lastReadAt);
        }).length;
    }

    async getConversationById(userId, conversationId) {
        await this.ensureParticipant(conversationId, userId);

        const conversation = await Conversation.findByPk(conversationId, {
            include: [
                {
                    model: ConversationParticipant,
                    as: 'participants',
                    where: { leftAt: null },
                    required: false,
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: [
                                'id',
                                'firstName',
                                'lastName',
                                'email',
                                'avatar',
                                'role',
                            ],
                        },
                    ],
                },
            ],
        });

        if (!conversation) {
            throw new ApiError(404, 'Conversation not found');
        }

        const latestMessage = await Message.findOne({
            where: {
                conversationId,
            },
            include: [
                {
                    model: User,
                    as: 'sender',
                    attributes: ['id', 'firstName', 'lastName', 'avatar'],
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        return {
            ...conversation.toJSON(),
            lastMessage: latestMessage,
        };
    }

    async getMessages(userId, conversationId, query = {}) {
        await this.ensureParticipant(conversationId, userId);

        const page = Math.max(parseInt(query.page, 10) || 1, 1);
        const limit = Math.min(
            Math.max(parseInt(query.limit, 10) || 30, 1),
            100,
        );
        const offset = (page - 1) * limit;

        const where = { conversationId };
        if (query.beforeMessageId) {
            const beforeMessage = await Message.findByPk(query.beforeMessageId);
            if (
                beforeMessage &&
                beforeMessage.conversationId === conversationId
            ) {
                where.createdAt = { [Op.lt]: beforeMessage.createdAt };
            }
        }

        const { rows, count } = await Message.findAndCountAll({
            where,
            include: [
                {
                    model: User,
                    as: 'sender',
                    attributes: [
                        'id',
                        'firstName',
                        'lastName',
                        'avatar',
                        'role',
                    ],
                },
                {
                    model: Message,
                    as: 'replyTo',
                    required: false,
                    include: [
                        {
                            model: User,
                            as: 'sender',
                            attributes: [
                                'id',
                                'firstName',
                                'lastName',
                                'avatar',
                            ],
                        },
                    ],
                },
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });

        return {
            items: rows,
            pagination: {
                totalItems: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                itemsPerPage: limit,
            },
        };
    }

    async sendMessage(userId, conversationId, payload) {
        await this.ensureParticipant(conversationId, userId);

        const {
            type = 'text',
            content,
            attachments,
            replyToMessageId,
            metadata,
        } = payload;

        if (!content || !String(content).trim()) {
            throw new ApiError(400, 'Message content is required');
        }

        if (replyToMessageId) {
            const repliedMessage = await Message.findByPk(replyToMessageId);
            if (
                !repliedMessage ||
                repliedMessage.conversationId !== conversationId
            ) {
                throw new ApiError(
                    400,
                    'Reply message does not belong to this conversation',
                );
            }
        }

        const message = await sequelize.transaction(async (transaction) => {
            const createdMessage = await Message.create(
                {
                    conversationId,
                    senderId: userId,
                    type,
                    content: String(content).trim(),
                    attachments: attachments || null,
                    replyToMessageId: replyToMessageId || null,
                    metadata: metadata || null,
                },
                { transaction },
            );

            await Conversation.update(
                {
                    lastMessageAt: createdMessage.createdAt,
                    lastMessagePreview: this.buildMessagePreview(
                        createdMessage.content,
                    ),
                },
                {
                    where: { id: conversationId },
                    transaction,
                },
            );

            await ConversationParticipant.update(
                {
                    lastReadMessageId: createdMessage.id,
                    lastReadAt: new Date(),
                },
                {
                    where: {
                        conversationId,
                        userId,
                    },
                    transaction,
                },
            );

            return createdMessage;
        });

        return await Message.findByPk(message.id, {
            include: [
                {
                    model: User,
                    as: 'sender',
                    attributes: [
                        'id',
                        'firstName',
                        'lastName',
                        'avatar',
                        'role',
                    ],
                },
                {
                    model: Message,
                    as: 'replyTo',
                    required: false,
                },
            ],
        });
    }

    async editMessage(userId, messageId, content) {
        const message = await Message.findByPk(messageId);
        if (!message || message.isDeleted) {
            throw new ApiError(404, 'Message not found');
        }

        await this.ensureParticipant(message.conversationId, userId);

        if (message.senderId !== userId) {
            throw new ApiError(403, 'You can edit only your own messages');
        }

        if (!content || !String(content).trim()) {
            throw new ApiError(400, 'Message content is required');
        }

        message.content = String(content).trim();
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();

        return message;
    }

    async deleteMessage(userId, messageId, allowAdmin = false) {
        const message = await Message.findByPk(messageId);
        if (!message || message.isDeleted) {
            throw new ApiError(404, 'Message not found');
        }

        if (!allowAdmin) {
            await this.ensureParticipant(message.conversationId, userId);
        }

        if (!allowAdmin && message.senderId !== userId) {
            throw new ApiError(403, 'You can delete only your own messages');
        }

        message.isDeleted = true;
        message.deletedAt = new Date();
        message.content = '[deleted message]';
        await message.save();

        return { success: true };
    }

    async markConversationAsRead(userId, conversationId, messageId = null) {
        await this.ensureParticipant(conversationId, userId);

        let lastMessage = null;

        if (messageId) {
            lastMessage = await Message.findByPk(messageId);
            if (!lastMessage || lastMessage.conversationId !== conversationId) {
                throw new ApiError(
                    400,
                    'Message does not belong to this conversation',
                );
            }
        } else {
            lastMessage = await Message.findOne({
                where: { conversationId },
                order: [['createdAt', 'DESC']],
            });
        }

        await ConversationParticipant.update(
            {
                lastReadMessageId: lastMessage ? lastMessage.id : null,
                lastReadAt: new Date(),
            },
            {
                where: {
                    conversationId,
                    userId,
                },
            },
        );

        return {
            conversationId,
            messageId: lastMessage ? lastMessage.id : null,
            readAt: new Date().toISOString(),
        };
    }

    async updateParticipantSettings(userId, conversationId, settings) {
        const participant = await this.ensureParticipant(
            conversationId,
            userId,
        );

        if (typeof settings.isMuted === 'boolean') {
            participant.isMuted = settings.isMuted;
        }

        if (typeof settings.isPinned === 'boolean') {
            participant.isPinned = settings.isPinned;
        }

        if (typeof settings.isArchived === 'boolean') {
            participant.isArchived = settings.isArchived;
        }

        await participant.save();
        return participant;
    }

    async addParticipants(requestUserId, conversationId, userIds = []) {
        const requester = await this.ensureParticipant(
            conversationId,
            requestUserId,
        );

        if (!['owner', 'admin'].includes(requester.role)) {
            throw new ApiError(403, 'Only owner/admin can add participants');
        }

        if (!Array.isArray(userIds) || !userIds.length) {
            throw new ApiError(400, 'At least one participant is required');
        }

        const uniqueUserIds = [...new Set(userIds)];
        const usersCount = await User.count({
            where: { id: { [Op.in]: uniqueUserIds } },
        });

        if (usersCount !== uniqueUserIds.length) {
            throw new ApiError(404, 'One or more users were not found');
        }

        await sequelize.transaction(async (transaction) => {
            for (const userId of uniqueUserIds) {
                const existing = await ConversationParticipant.findOne({
                    where: { conversationId, userId },
                    transaction,
                });

                if (!existing) {
                    await ConversationParticipant.create(
                        {
                            conversationId,
                            userId,
                            role: 'member',
                            joinedAt: new Date(),
                        },
                        { transaction },
                    );
                } else if (existing.leftAt) {
                    existing.leftAt = null;
                    existing.joinedAt = new Date();
                    await existing.save({ transaction });
                }
            }
        });

        return await this.getConversationById(requestUserId, conversationId);
    }

    async removeParticipant(requestUserId, conversationId, targetUserId) {
        const requester = await this.ensureParticipant(
            conversationId,
            requestUserId,
        );
        const target = await ConversationParticipant.findOne({
            where: { conversationId, userId: targetUserId },
        });

        if (!target || target.leftAt) {
            throw new ApiError(404, 'Participant not found');
        }

        const selfRemoval = requestUserId === targetUserId;
        if (!selfRemoval && !['owner', 'admin'].includes(requester.role)) {
            throw new ApiError(403, 'Only owner/admin can remove participants');
        }

        if (target.role === 'owner' && !selfRemoval) {
            throw new ApiError(
                400,
                'Owner cannot be removed by another participant',
            );
        }

        target.leftAt = new Date();
        await target.save();

        return { success: true };
    }

    async getUnreadOverview(userId) {
        const memberships = await ConversationParticipant.findAll({
            where: {
                userId,
                leftAt: null,
            },
            attributes: ['conversationId', 'lastReadAt'],
        });

        if (!memberships.length) {
            return {
                totalUnread: 0,
                conversations: [],
            };
        }

        const conversationIds = memberships.map((item) => item.conversationId);

        const messages = await Message.findAll({
            where: {
                conversationId: { [Op.in]: conversationIds },
                senderId: { [Op.ne]: userId },
                isDeleted: false,
            },
            attributes: ['id', 'conversationId', 'createdAt'],
        });

        const mapReadAt = new Map(
            memberships.map((membership) => [
                membership.conversationId,
                membership.lastReadAt ? new Date(membership.lastReadAt) : null,
            ]),
        );

        const unreadByConversation = new Map();
        for (const message of messages) {
            const lastReadAt = mapReadAt.get(message.conversationId);
            if (!lastReadAt || new Date(message.createdAt) > lastReadAt) {
                unreadByConversation.set(
                    message.conversationId,
                    (unreadByConversation.get(message.conversationId) || 0) + 1,
                );
            }
        }

        const conversations = Array.from(unreadByConversation.entries()).map(
            ([conversationId, unreadCount]) => ({
                conversationId,
                unreadCount,
            }),
        );

        const totalUnread = conversations.reduce(
            (acc, item) => acc + item.unreadCount,
            0,
        );

        return {
            totalUnread,
            conversations,
        };
    }

    buildMessagePreview(content) {
        const raw = String(content || '').trim();
        if (!raw) {
            return null;
        }

        if (raw.length <= 120) {
            return raw;
        }

        return `${raw.slice(0, 117)}...`;
    }

    async adminListConversations(query = {}) {
        const page = Math.max(parseInt(query.page, 10) || 1, 1);
        const limit = Math.min(
            Math.max(parseInt(query.limit, 10) || 20, 1),
            100,
        );
        const offset = (page - 1) * limit;

        const where = {};
        if (query.type) {
            where.type = query.type;
        }

        const { rows, count } = await Conversation.findAndCountAll({
            where,
            include: [
                {
                    model: ConversationParticipant,
                    as: 'participants',
                    where: query.userId
                        ? {
                              userId: query.userId,
                              leftAt: null,
                          }
                        : undefined,
                    required: Boolean(query.userId),
                },
            ],
            order: [
                ['lastMessageAt', 'DESC'],
                ['updatedAt', 'DESC'],
            ],
            limit,
            offset,
            distinct: true,
        });

        return {
            items: rows,
            pagination: {
                totalItems: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                itemsPerPage: limit,
            },
        };
    }

    async adminGetConversationById(conversationId) {
        const conversation = await Conversation.findByPk(conversationId, {
            include: [
                {
                    model: ConversationParticipant,
                    as: 'participants',
                    required: false,
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: [
                                'id',
                                'firstName',
                                'lastName',
                                'email',
                                'avatar',
                                'role',
                            ],
                        },
                    ],
                },
            ],
        });

        if (!conversation) {
            throw new ApiError(404, 'Conversation not found');
        }

        return conversation;
    }

    async adminGetMessages(conversationId, query = {}) {
        const page = Math.max(parseInt(query.page, 10) || 1, 1);
        const limit = Math.min(
            Math.max(parseInt(query.limit, 10) || 50, 1),
            100,
        );
        const offset = (page - 1) * limit;

        const { rows, count } = await Message.findAndCountAll({
            where: { conversationId },
            include: [
                {
                    model: User,
                    as: 'sender',
                    attributes: [
                        'id',
                        'firstName',
                        'lastName',
                        'email',
                        'role',
                    ],
                },
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });

        return {
            items: rows,
            pagination: {
                totalItems: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                itemsPerPage: limit,
            },
        };
    }
}

module.exports = new ChatService();
