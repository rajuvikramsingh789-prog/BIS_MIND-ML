const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');

// GET /api/services
router.get('/services', (req, res, next) => {
    try {
        const services = dbService.getAllServices();
        res.json({
            total: services.length,
            services
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/services/:id
router.get('/services/:id', (req, res, next) => {
    try {
        const { id } = req.params;
        const service = dbService.getServiceById(id);
        if (!service) {
            return res.status(404).json({ error: `Service '${id}' not found.` });
        }
        res.json(service);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
