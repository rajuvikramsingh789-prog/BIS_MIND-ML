const express = require('express');
const router = express.Router();
const ragEngine = require('../services/ragEngine');
const dbService = require('../services/dbService');

// POST /api/chat - Main AI Chat endpoint
router.post('/chat', async (req, res, next) => {
    try {
        const { message, conversationId } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message field is required.' });
        }

        let convId = conversationId;

        // Auto-create conversation if none provided
        if (!convId) {
            const newConv = dbService.createConversation();
            convId = newConv.id;
        }

        // Fetch existing history for context
        const historyData = dbService.getConversationHistory(convId);
        const history = historyData ? historyData.messages : [];

        // Process through RAG Pipeline
        const result = await ragEngine.processQuery({
            conversationId: convId,
            query: message.trim(),
            conversationHistory: history
        });

        res.json({
            conversationId: convId,
            messageId: result.messageId,
            answer: result.answer,
            confidenceScore: result.confidenceScore,
            citations: result.citations,
            followUpQuestions: result.followUpQuestions,
            intent: result.intent,
            llmProvider: result.llmProvider
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/chat/:conversationId - Get history
router.get('/chat/:conversationId', (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const history = dbService.getConversationHistory(conversationId);
        if (!history) {
            return res.status(404).json({ error: 'Conversation not found.' });
        }
        res.json(history);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/chat/:conversationId - Clear chat
router.delete('/chat/:conversationId', (req, res, next) => {
    try {
        const { conversationId } = req.params;
        dbService.clearConversation(conversationId);
        res.json({ success: true, message: 'Conversation history cleared.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
