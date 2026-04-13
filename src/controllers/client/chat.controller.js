const { ApiResponse } = require('../../utils/ApiResponse');
const { asyncHandler } = require('../../utils/asyncHandler');
const chatService = require('../../services/chat.service');

const createConversation = asyncHandler(async (req, res) => {
    const conversation = await chatService.createConversation(
        req.user.id,
        req.body,
    );

    res.status(201).json(
        new ApiResponse(201, conversation, 'Conversation created successfully'),
    );
});

const listConversations = asyncHandler(async (req, res) => {
    const archived =
        req.query.archived === undefined
            ? undefined
            : req.query.archived === 'true';

    const result = await chatService.listConversations(req.user.id, {
        ...req.query,
        archived,
    });

    res.json(
        new ApiResponse(200, result, 'Conversations retrieved successfully'),
    );
});

const getConversation = asyncHandler(async (req, res) => {
    const conversation = await chatService.getConversationById(
        req.user.id,
        req.params.conversationId,
    );

    res.json(
        new ApiResponse(
            200,
            conversation,
            'Conversation retrieved successfully',
        ),
    );
});

const getConversationMessages = asyncHandler(async (req, res) => {
    const result = await chatService.getMessages(
        req.user.id,
        req.params.conversationId,
        req.query,
    );

    res.json(new ApiResponse(200, result, 'Messages retrieved successfully'));
});

const sendMessage = asyncHandler(async (req, res) => {
    const message = await chatService.sendMessage(
        req.user.id,
        req.params.conversationId,
        req.body,
    );

    res.status(201).json(
        new ApiResponse(201, message, 'Message sent successfully'),
    );
});

const editMessage = asyncHandler(async (req, res) => {
    const message = await chatService.editMessage(
        req.user.id,
        req.params.messageId,
        req.body.content,
    );

    res.json(new ApiResponse(200, message, 'Message updated successfully'));
});

const deleteMessage = asyncHandler(async (req, res) => {
    await chatService.deleteMessage(req.user.id, req.params.messageId, false);
    res.json(new ApiResponse(200, null, 'Message deleted successfully'));
});

const markAsRead = asyncHandler(async (req, res) => {
    const result = await chatService.markConversationAsRead(
        req.user.id,
        req.params.conversationId,
        req.body.messageId,
    );

    res.json(new ApiResponse(200, result, 'Conversation marked as read'));
});

const updateSettings = asyncHandler(async (req, res) => {
    const participant = await chatService.updateParticipantSettings(
        req.user.id,
        req.params.conversationId,
        req.body,
    );

    res.json(
        new ApiResponse(
            200,
            participant,
            'Conversation settings updated successfully',
        ),
    );
});

const addParticipants = asyncHandler(async (req, res) => {
    const conversation = await chatService.addParticipants(
        req.user.id,
        req.params.conversationId,
        req.body.userIds,
    );

    res.json(
        new ApiResponse(200, conversation, 'Participants added successfully'),
    );
});

const removeParticipant = asyncHandler(async (req, res) => {
    await chatService.removeParticipant(
        req.user.id,
        req.params.conversationId,
        req.params.userId,
    );

    res.json(new ApiResponse(200, null, 'Participant removed successfully'));
});

const getUnreadOverview = asyncHandler(async (req, res) => {
    const data = await chatService.getUnreadOverview(req.user.id);
    res.json(
        new ApiResponse(200, data, 'Unread counters retrieved successfully'),
    );
});

module.exports = {
    createConversation,
    listConversations,
    getConversation,
    getConversationMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    markAsRead,
    updateSettings,
    addParticipants,
    removeParticipant,
    getUnreadOverview,
};
