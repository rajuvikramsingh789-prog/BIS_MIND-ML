const express = require('express');
const router = express.Router();
const { getDatabase } = require('../../database/init');
const { GEMINI_API_KEY } = require('../config/env');

router.get('/health', (req, res) => {
    try {
        const db = getDatabase();
        const stdCount = db.prepare(`SELECT COUNT(*) as count FROM standards`).get().count;
        const chunkCount = db.prepare(`SELECT COUNT(*) as count FROM document_chunks`).get().count;

        res.json({
            status: 'healthy',
            application: 'Know Your BIS AI Platform',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            database: {
                connected: true,
                totalStandards: stdCount,
                totalChunks: chunkCount
            },
            aiProvider: GEMINI_API_KEY ? 'Google Gemini API' : 'Offline Grounded Engine'
        });
    } catch (err) {
        res.status(500).json({
            status: 'unhealthy',
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
