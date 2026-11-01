const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');

// GET /api/search?q=water
router.get('/search', (req, res, next) => {
    try {
        const { q, category } = req.query;

        if (!q || q.trim().length === 0) {
            const results = dbService.getAllStandards(category, null);
            return res.json({ query: '', count: results.length, results });
        }

        const results = dbService.getAllStandards(category, q.trim());
        res.json({
            query: q.trim(),
            category: category || 'All',
            count: results.length,
            results
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
