const express = require('express');
const Joi = require('joi');
const chatAdminController = require('../../controllers/admin/chat.admin.controller');
const {
    authenticate,
    authorize,
} = require('../../middlewares/auth.middleware');
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

const listConversationsSchema = {
    query: Joi.object({
        ...commonSchemas.pagination,
        type: Joi.string().valid('direct', 'group', 'support').optional(),
        userId: commonSchemas.optionalUuid,
    }),
};

const getMessagesSchema = {
    params: Joi.object({
        conversationId: commonSchemas.uuid,
    }),
    query: Joi.object({
        ...commonSchemas.pagination,
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

const messageIdSchema = {
    params: Joi.object({
        messageId: commonSchemas.uuid,
    }),
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

router.use(authenticate, authorize('admin'));

router.get(
    '/conversations',
    validate(listConversationsSchema),
    chatAdminController.listConversations,
);

router.get(
    '/conversations/:conversationId',
    validate(conversationIdSchema),
    chatAdminController.getConversation,
);

router.get(
    '/conversations/:conversationId/messages',
    validate(getMessagesSchema),
    chatAdminController.getMessages,
);

router.post(
    '/conversations/:conversationId/messages',
    validate(sendMessageSchema),
    chatAdminController.sendMessage,
);

router.delete(
    '/messages/:messageId',
    validate(messageIdSchema),
    chatAdminController.deleteMessage,
);

router.post(
    '/conversations/:conversationId/participants',
    validate(addParticipantsSchema),
    chatAdminController.addParticipants,
);

router.delete(
    '/conversations/:conversationId/participants/:userId',
    validate(removeParticipantSchema),
    chatAdminController.removeParticipant,
);

module.exports = router;
