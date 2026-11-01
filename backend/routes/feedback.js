const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');

// POST /api/feedback
router.post('/feedback', (req, res, next) => {
    try {
        const { messageId, queryText, rating, comments } = req.body;

        if (rating !== 1 && rating !== -1) {
            return res.status(400).json({ error: 'Rating must be 1 (thumbs up) or -1 (thumbs down).' });
        }

        const result = dbService.saveFeedback({ messageId, queryText, rating, comments });
        res.json({ success: true, feedbackId: result.id, message: 'Feedback submitted successfully.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
