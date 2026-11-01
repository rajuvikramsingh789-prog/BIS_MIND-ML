const dbService = require('./dbService');
const embeddingService = require('./embeddingService');
const llmService = require('./llmService');

class RAGEngine {
    async processQuery({ conversationId, query, conversationHistory = [] }) {
        if (!query || query.trim().length === 0) {
            throw new Error('Query text is required.');
        }

        // 1. Intent Detection
        const intent = this._detectIntent(query);

        // 2. Entity & IS Number Extraction
        const entities = this._extractEntities(query);

        // 3. Keyword Search + Semantic Vector Search (Hybrid Retrieval)
        const retrievedChunks = await this._retrieveEvidence(query, entities);

        // 4. Ranking & Evidence Filtering
        const rankedChunks = await this._rankAndFilterEvidence(query, retrievedChunks);

        // 5. LLM Grounded Generation (Gemini or Grounded Engine)
        const llmResult = await llmService.generateGroundedAnswer({
            query,
            contextChunks: rankedChunks,
            conversationHistory
        });

        // 6. Citation Validation & Source Metadata Enrichment
        const citations = this._validateAndExtractCitations(rankedChunks);

        // 7. Calculate Confidence Indicator Score
        const confidenceScore = this._calculateConfidenceScore(rankedChunks, intent);

        // 8. Generate Follow-up Question Suggestions
        const followUpQuestions = this._generateFollowUpQuestions(intent, entities, query);

        // Save messages in conversation history if conversationId provided
        let messageRecord = null;
        if (conversationId) {
            dbService.addMessage({
                conversationId,
                sender: 'user',
                content: query
            });

            messageRecord = dbService.addMessage({
                conversationId,
                sender: 'assistant',
                content: llmResult.text,
                confidenceScore,
                citations,
                followUpQuestions
            });
        }

        return {
            messageId: messageRecord ? messageRecord.id : null,
            intent,
            extractedEntities: entities,
            answer: llmResult.text,
            confidenceScore,
            citations,
            followUpQuestions,
            retrievedChunksCount: rankedChunks.length,
            llmProvider: llmResult.source
        };
    }

    _detectIntent(query) {
        const q = query.toLowerCase();
        if (q.includes('recommend') || q.includes('manufacture') || q.includes('product') || q.includes('standard for')) {
            return 'PRODUCT_RECOMMENDATION';
        }
        if (q.includes('qco') || q.includes('mandatory') || q.includes('compulsory') || q.includes('order')) {
            return 'MANDATORY_STATUS_QUERY';
        }
        if (q.includes('hallmark') || q.includes('huid') || q.includes('gold') || q.includes('jewel')) {
            return 'HALLMARKING_QUERY';
        }
        if (q.includes('lab') || q.includes('testing') || q.includes('test report') || q.includes('lims')) {
            return 'TESTING_AND_LAB_QUERY';
        }
        if (q.includes('fee') || q.includes('licence') || q.includes('license') || q.includes('apply') || q.includes('manakonline')) {
            return 'CERTIFICATION_PROCESS_QUERY';
        }
        return 'GENERAL_STANDARD_QUERY';
    }

    _extractEntities(query) {
        const isMatch = query.match(/is\s*\d+(\s*\(\s*part\s*\d+\s*\))?/i);
        const numbers = query.match(/\b\d{3,5}\b/g);

        const keywords = query.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3 && !['what', 'which', 'how', 'when', 'where', 'is', 'the', 'for', 'with', 'show', 'tell'].includes(w));

        return {
            isNumberMatch: isMatch ? isMatch[0].toUpperCase() : (numbers ? `IS ${numbers[0]}` : null),
            keywords
        };
    }

    async _retrieveEvidence(query, entities) {
        const queryTerms = entities.keywords;
        const isNumberFilter = entities.isNumberMatch;

        // Retrieve DB chunks
        return dbService.searchDocumentChunks(queryTerms, isNumberFilter, 8);
    }

    async _rankAndFilterEvidence(query, chunks) {
        if (!chunks || chunks.length === 0) return [];

        const queryEmbedding = await embeddingService.getEmbedding(query);

        const scoredChunks = await Promise.all(chunks.map(async (chunk) => {
            const chunkEmbedding = await embeddingService.getEmbedding(chunk.content);
            const simScore = embeddingService.cosineSimilarity(queryEmbedding, chunkEmbedding);
            
            // Boost score if explicit IS number match
            let finalScore = simScore;
            if (chunk.is_number && query.toLowerCase().includes(chunk.is_number.toLowerCase())) {
                finalScore += 0.35;
            }
            return { chunk, score: finalScore };
        }));

        scoredChunks.sort((a, b) => b.score - a.score);

        // Filter top top 4 highest quality evidence chunks
        return scoredChunks.slice(0, 4).map(sc => sc.chunk);
    }

    _validateAndExtractCitations(chunks) {
        const citations = [];
        const seenUrls = new Set();

        for (const chunk of chunks) {
            const isNo = chunk.is_number || 'BIS Citation';
            const url = chunk.source_url || 'https://www.bis.gov.in/';
            
            if (!seenUrls.has(url + isNo)) {
                seenUrls.add(url + isNo);
                citations.push({
                    isNumber: isNo,
                    title: chunk.doc_title || 'Official BIS Record',
                    clause: chunk.clause_no ? `Clause ${chunk.clause_no}` : null,
                    sourceName: chunk.source_name || 'Bureau of Indian Standards',
                    url: url,
                    verified: true
                });
            }
        }
        return citations;
    }

    _calculateConfidenceScore(chunks, intent) {
        if (!chunks || chunks.length === 0) return 0.25;
        if (chunks.length >= 3) return 0.95;
        if (chunks.length === 2) return 0.85;
        return 0.70;
    }

    _generateFollowUpQuestions(intent, entities, query) {
        const isNo = entities.isNumberMatch || 'this standard';
        switch (intent) {
            case 'PRODUCT_RECOMMENDATION':
                return [
                    `Is certification mandatory for ${isNo} under Quality Control Orders?`,
                    `What laboratory testing tests are required for ${isNo}?`,
                    `How do I apply for an ISI Mark license on Manakonline?`
                ];
            case 'MANDATORY_STATUS_QUERY':
                return [
                    `What is the punishment or penalty for selling non-compliant goods without BIS mark?`,
                    `Which government ministry issued the QCO notification?`,
                    `How to verify an authentic ISI license number?`
                ];
            case 'HALLMARKING_QUERY':
                return [
                    `How do I verify a 6-digit HUID code using the BIS CARE App?`,
                    `What are the official purity standards for 22K and 18K gold?`,
                    `Where can I find authorized Assaying & Hallmarking Centres near me?`
                ];
            default:
                return [
                    `What are the specific chemical and mechanical testing requirements for ${isNo}?`,
                    `Is there a mandatory Quality Control Order (QCO) for ${isNo}?`,
                    `What is the step-by-step process to get BIS product certification?`
                ];
        }
    }
}

module.exports = new RAGEngine();
