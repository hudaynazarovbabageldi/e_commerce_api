const express = require('express');
const Joi = require('joi');
const chatController = require('../../controllers/client/chat.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const {
    validate,
    commonSchemas,
} = require('../../middlewares/Validate.middleware');

const router = express.Router();

const conversationIdSchema = {
    params: Joi.object({
        conversationId: commonSchemas.uuid,
    }),
};

const messageIdSchema = {
    params: Joi.object({
        messageId: commonSchemas.uuid,
    }),
};

const createConversationSchema = {
    body: Joi.object({
        type: Joi.string()
            .valid('direct', 'group', 'support')
            .default('direct'),
        title: Joi.string().max(255).allow('', null),
        participantIds: Joi.array().items(commonSchemas.uuid).min(1).required(),
        initialMessage: Joi.string().max(5000).allow('', null),
        metadata: Joi.object().optional(),
    }),
};

const listConversationsSchema = {
    query: Joi.object({
        ...commonSchemas.pagination,
        archived: Joi.boolean().optional(),
    }),
};

const listMessagesSchema = {
    params: Joi.object({
        conversationId: commonSchemas.uuid,
    }),
    query: Joi.object({
        ...commonSchemas.pagination,
        beforeMessageId: commonSchemas.optionalUuid,
    }),
};

const sendMessageSchema = {
    params: Joi.object({
        conversationId: commonSchemas.uuid,
    }),
    body: Joi.object({
        type: Joi.string()
            .valid('text', 'image', 'file', 'system')
            .default('text'),
        content: Joi.string().min(1).max(5000).required(),
        attachments: Joi.array().items(Joi.object()).optional(),
        replyToMessageId: commonSchemas.optionalUuid,
        metadata: Joi.object().optional(),
    }),
};

const editMessageSchema = {
    params: Joi.object({
        messageId: commonSchemas.uuid,
    }),
    body: Joi.object({
        content: Joi.string().min(1).max(5000).required(),
    }),
};

const markAsReadSchema = {
    params: Joi.object({
        conversationId: commonSchemas.uuid,
    }),
    body: Joi.object({
        messageId: commonSchemas.optionalUuid,
    }),
};

const updateSettingsSchema = {
    params: Joi.object({
        conversationId: commonSchemas.uuid,
    }),
    body: Joi.object({
        isMuted: commonSchemas.boolean,
        isPinned: commonSchemas.boolean,
        isArchived: commonSchemas.boolean,
    }).min(1),
};

const addParticipantsSchema = {
    params: Joi.object({
        conversationId: commonSchemas.uuid,
    }),
    body: Joi.object({
        userIds: Joi.array().items(commonSchemas.uuid).min(1).required(),
    }),
};

const removeParticipantSchema = {
    params: Joi.object({
        conversationId: commonSchemas.uuid,
        userId: commonSchemas.uuid,
    }),
};

router.use(authenticate);

router.post(
    '/conversations',
    validate(createConversationSchema),
    chatController.createConversation,
);

router.get(
    '/conversations',
    validate(listConversationsSchema),
    chatController.listConversations,
);

router.get('/conversations/unread-overview', chatController.getUnreadOverview);

router.get(
    '/conversations/:conversationId',
    validate(conversationIdSchema),
    chatController.getConversation,
);

router.get(
    '/conversations/:conversationId/messages',
    validate(listMessagesSchema),
    chatController.getConversationMessages,
);

router.post(
    '/conversations/:conversationId/messages',
    validate(sendMessageSchema),
    chatController.sendMessage,
);

router.patch(
    '/messages/:messageId',
    validate(editMessageSchema),
    chatController.editMessage,
);

router.delete(
    '/messages/:messageId',
    validate(messageIdSchema),
    chatController.deleteMessage,
);

router.post(
    '/conversations/:conversationId/read',
    validate(markAsReadSchema),
    chatController.markAsRead,
);

router.patch(
    '/conversations/:conversationId/settings',
    validate(updateSettingsSchema),
    chatController.updateSettings,
);

router.post(
    '/conversations/:conversationId/participants',
    validate(addParticipantsSchema),
    chatController.addParticipants,
);

router.delete(
    '/conversations/:conversationId/participants/:userId',
    validate(removeParticipantSchema),
    chatController.removeParticipant,
);

module.exports = router;
