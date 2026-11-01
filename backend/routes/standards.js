const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');

// GET /api/standards
router.get('/standards', (req, res, next) => {
    try {
        const { category, search } = req.query;
        const standards = dbService.getAllStandards(category, search);
        res.json({
            total: standards.length,
            standards
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/standards/:id
router.get('/standards/:id', (req, res, next) => {
    try {
        const { id } = req.params;
        const standard = dbService.getStandardByIdOrNumber(id);
        if (!standard) {
            return res.status(404).json({ error: `Standard '${id}' not found.` });
        }
        res.json(standard);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
