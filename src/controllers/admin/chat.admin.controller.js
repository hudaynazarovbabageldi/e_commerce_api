const { ApiResponse } = require('../../utils/ApiResponse');
const { asyncHandler } = require('../../utils/asyncHandler');
const chatService = require('../../services/chat.service');

const listConversations = asyncHandler(async (req, res) => {
    const result = await chatService.adminListConversations(req.query);

    res.json(
        new ApiResponse(200, result, 'Conversations retrieved successfully'),
    );
});

const getConversation = asyncHandler(async (req, res) => {
    const conversation = await chatService.adminGetConversationById(
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

const getMessages = asyncHandler(async (req, res) => {
    const result = await chatService.adminGetMessages(
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

const deleteMessage = asyncHandler(async (req, res) => {
    await chatService.deleteMessage(req.user.id, req.params.messageId, true);
    res.json(new ApiResponse(200, null, 'Message deleted successfully'));
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

module.exports = {
    listConversations,
    getConversation,
    getMessages,
    sendMessage,
    deleteMessage,
    addParticipants,
    removeParticipant,
};
