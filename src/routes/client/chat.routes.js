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

/**
 * @openapi
 * /v1/chat/conversations:
 *   post:
 *     tags:
 *       - Client Chat
 *     summary: Create a new conversation
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateConversationRequest'
 *     responses:
 *       201:
 *         description: Conversation created successfully.
 */

router.post(
    '/conversations',
    validate(createConversationSchema),
    chatController.createConversation,
);

/**
 * @openapi
 * /v1/chat/conversations:
 *   get:
 *     tags:
 *       - Client Chat
 *     summary: List user conversations
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
 *         name: archived
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully.
 */

router.get(
    '/conversations',
    validate(listConversationsSchema),
    chatController.listConversations,
);

/**
 * @openapi
 * /v1/chat/conversations/unread-overview:
 *   get:
 *     tags:
 *       - Client Chat
 *     summary: Get unread counters overview
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread counters retrieved successfully.
 */

router.get('/conversations/unread-overview', chatController.getUnreadOverview);

/**
 * @openapi
 * /v1/chat/conversations/{conversationId}:
 *   get:
 *     tags:
 *       - Client Chat
 *     summary: Get conversation by id
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
    chatController.getConversation,
);

/**
 * @openapi
 * /v1/chat/conversations/{conversationId}/messages:
 *   get:
 *     tags:
 *       - Client Chat
 *     summary: List conversation messages
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
 *       - in: query
 *         name: beforeMessageId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Messages retrieved successfully.
 */

router.get(
    '/conversations/:conversationId/messages',
    validate(listMessagesSchema),
    chatController.getConversationMessages,
);

/**
 * @openapi
 * /v1/chat/conversations/{conversationId}/messages:
 *   post:
 *     tags:
 *       - Client Chat
 *     summary: Send message to a conversation
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
    chatController.sendMessage,
);

/**
 * @openapi
 * /v1/chat/messages/{messageId}:
 *   patch:
 *     tags:
 *       - Client Chat
 *     summary: Edit own message
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EditMessageRequest'
 *     responses:
 *       200:
 *         description: Message updated successfully.
 */

router.patch(
    '/messages/:messageId',
    validate(editMessageSchema),
    chatController.editMessage,
);

/**
 * @openapi
 * /v1/chat/messages/{messageId}:
 *   delete:
 *     tags:
 *       - Client Chat
 *     summary: Delete own message
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
    chatController.deleteMessage,
);

/**
 * @openapi
 * /v1/chat/conversations/{conversationId}/read:
 *   post:
 *     tags:
 *       - Client Chat
 *     summary: Mark conversation as read
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MarkAsReadRequest'
 *     responses:
 *       200:
 *         description: Conversation marked as read.
 */

router.post(
    '/conversations/:conversationId/read',
    validate(markAsReadSchema),
    chatController.markAsRead,
);

/**
 * @openapi
 * /v1/chat/conversations/{conversationId}/settings:
 *   patch:
 *     tags:
 *       - Client Chat
 *     summary: Update participant chat settings
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
 *             $ref: '#/components/schemas/UpdateConversationSettingsRequest'
 *     responses:
 *       200:
 *         description: Conversation settings updated successfully.
 */

router.patch(
    '/conversations/:conversationId/settings',
    validate(updateSettingsSchema),
    chatController.updateSettings,
);

/**
 * @openapi
 * /v1/chat/conversations/{conversationId}/participants:
 *   post:
 *     tags:
 *       - Client Chat
 *     summary: Add participants to a conversation
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
    chatController.addParticipants,
);

/**
 * @openapi
 * /v1/chat/conversations/{conversationId}/participants/{userId}:
 *   delete:
 *     tags:
 *       - Client Chat
 *     summary: Remove participant from a conversation
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
    chatController.removeParticipant,
);

module.exports = router;
