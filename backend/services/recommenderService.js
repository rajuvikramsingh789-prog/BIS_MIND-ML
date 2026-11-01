const dbService = require('./dbService');

class RecommenderService {
    async recommendForProduct(productDescription) {
        if (!productDescription || productDescription.trim().length === 0) {
            throw new Error('Product description is required.');
        }

        const queryLower = productDescription.toLowerCase();
        const allStandards = dbService.getAllStandards();

        const matches = [];

        for (const std of allStandards) {
            let score = 0;

            // Direct IS Number match
            const isClean = std.isNumber.toLowerCase().replace(/\s+/g, '');
            const queryClean = queryLower.replace(/\s+/g, '');
            if (queryClean.includes(isClean)) {
                score += 50;
            }

            // Title & Scope keyword matching
            const keywords = this._extractKeywords(std.title + ' ' + std.scope + ' ' + std.category);
            for (const kw of keywords) {
                if (queryLower.includes(kw)) {
                    score += kw.length > 5 ? 12 : 6;
                }
            }

            // Domain mapping heuristics
            if (this._checkDomainMatch(queryLower, std)) {
                score += 25;
            }

            if (score > 8) {
                matches.push({ standard: std, score });
            }
        }

        // Sort matches by score descending
        matches.sort((a, b) => b.score - a.score);

        const topMatches = matches.slice(0, 3).map(m => m.standard);

        // Calculate overall confidence score
        let confidenceScore = 0.5;
        if (matches.length > 0) {
            const topScore = matches[0].score;
            confidenceScore = Math.min(0.98, Math.max(0.65, topScore / 40));
        }

        return {
            query: productDescription,
            matchedStandards: topMatches,
            primaryStandard: topMatches[0] || null,
            confidenceScore,
            totalMatchesFound: matches.length
        };
    }

    _extractKeywords(text) {
        const stopWords = new Set([
            'and', 'for', 'with', 'the', 'specification', 'general', 'requirements',
            'other', 'than', 'up', 'to', 'part', 'code', 'standard', 'indian'
        ]);

        return text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length >= 4 && !stopWords.has(w));
    }

    _checkDomainMatch(query, std) {
        const domainMap = {
            'steel': ['is-1786', 'is-2062'],
            'rebar': ['is-1786'],
            'tmt': ['is-1786'],
            'water': ['is-14543', 'is-10500'],
            'bottle': ['is-14543'],
            'mineral water': ['is-14543'],
            'gold': ['is-15820'],
            'jewel': ['is-15820'],
            'hallmark': ['is-15820'],
            'huid': ['is-15820'],
            'toy': ['is-9873'],
            'game': ['is-9873'],
            'doll': ['is-9873'],
            'cable': ['is-694'],
            'wire': ['is-694'],
            'pvc': ['is-694'],
            'laptop': ['is-13252'],
            'computer': ['is-13252'],
            'server': ['is-13252'],
            'mobile': ['is-16333'],
            'phone': ['is-16333'],
            'appliance': ['is-302'],
            'heater': ['is-302'],
            'iron': ['is-302']
        };

        for (const [key, stdIds] of Object.entries(domainMap)) {
            if (query.includes(key) && stdIds.includes(std.id)) {
                return true;
            }
        }
        return false;
    }
}

module.exports = new RecommenderService();
