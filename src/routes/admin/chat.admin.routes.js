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

/**
 * @openapi
 * /v1/admin/chat/conversations:
 *   get:
 *     tags:
 *       - Admin Chat
 *     summary: List conversations (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [direct, group, support]
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully.
 */

router.get(
    '/conversations',
    validate(listConversationsSchema),
    chatAdminController.listConversations,
);

/**
 * @openapi
 * /v1/admin/chat/conversations/{conversationId}:
 *   get:
 *     tags:
 *       - Admin Chat
 *     summary: Get a conversation by id (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Conversation retrieved successfully.
 */

router.get(
    '/conversations/:conversationId',
    validate(conversationIdSchema),
    chatAdminController.getConversation,
);

/**
 * @openapi
 * /v1/admin/chat/conversations/{conversationId}/messages:
 *   get:
 *     tags:
 *       - Admin Chat
 *     summary: List messages in a conversation (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Messages retrieved successfully.
 */

router.get(
    '/conversations/:conversationId/messages',
    validate(getMessagesSchema),
    chatAdminController.getMessages,
);

/**
 * @openapi
 * /v1/admin/chat/conversations/{conversationId}/messages:
 *   post:
 *     tags:
 *       - Admin Chat
 *     summary: Send message to a conversation (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMessageRequest'
 *     responses:
 *       201:
 *         description: Message sent successfully.
 */

router.post(
    '/conversations/:conversationId/messages',
    validate(sendMessageSchema),
    chatAdminController.sendMessage,
);

/**
 * @openapi
 * /v1/admin/chat/messages/{messageId}:
 *   delete:
 *     tags:
 *       - Admin Chat
 *     summary: Delete message by id (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Message deleted successfully.
 */

router.delete(
    '/messages/:messageId',
    validate(messageIdSchema),
    chatAdminController.deleteMessage,
);

/**
 * @openapi
 * /v1/admin/chat/conversations/{conversationId}/participants:
 *   post:
 *     tags:
 *       - Admin Chat
 *     summary: Add participants to conversation (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddParticipantsRequest'
 *     responses:
 *       200:
 *         description: Participants added successfully.
 */

router.post(
    '/conversations/:conversationId/participants',
    validate(addParticipantsSchema),
    chatAdminController.addParticipants,
);

/**
 * @openapi
 * /v1/admin/chat/conversations/{conversationId}/participants/{userId}:
 *   delete:
 *     tags:
 *       - Admin Chat
 *     summary: Remove participant from conversation (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Participant removed successfully.
 */

router.delete(
    '/conversations/:conversationId/participants/:userId',
    validate(removeParticipantSchema),
    chatAdminController.removeParticipant,
);

module.exports = router;
