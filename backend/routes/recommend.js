const express = require('express');
const router = express.Router();
const recommenderService = require('../services/recommenderService');
const llmService = require('../services/llmService');

// POST /api/recommend-standard
router.post('/recommend-standard', async (req, res, next) => {
    try {
        const { productDescription } = req.body;

        if (!productDescription || productDescription.trim().length === 0) {
            return res.status(400).json({ error: 'Product description is required.' });
        }

        const matchResult = await recommenderService.recommendForProduct(productDescription.trim());

        const llmAnalysis = await llmService.generateProductRecommendation({
            productDescription: productDescription.trim(),
            matchedStandards: matchResult.matchedStandards
        });

        res.json({
            query: productDescription,
            matchedStandards: matchResult.matchedStandards,
            primaryStandard: matchResult.primaryStandard,
            recommendationText: llmAnalysis.recommendationText,
            confidenceScore: Math.max(matchResult.confidenceScore, llmAnalysis.confidence || 0.7),
            totalMatchesFound: matchResult.totalMatchesFound,
            officialSource: 'Bureau of Indian Standards Repository (https://www.bis.gov.in/)'
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
