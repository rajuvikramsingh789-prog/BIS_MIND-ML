const { GEMINI_API_KEY } = require('../config/env');
const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
if (GEMINI_API_KEY) {
    try {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    } catch (err) {
        console.warn('Gemini AI initialization warning in embedding service:', err.message);
    }
}

class EmbeddingService {
    // Generate text vector embedding
    async getEmbedding(text) {
        if (!text || typeof text !== 'string') return new Array(128).fill(0);

        if (genAI && GEMINI_API_KEY) {
            try {
                const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
                const result = await model.embedContent(text);
                return result.embedding.values;
            } catch (err) {
                console.warn('Gemini embedding call failed, falling back to TF-IDF term vector:', err.message);
            }
        }

        // Local term vector generator (TF-IDF / N-gram frequency vector)
        return this.createTFIDFVector(text);
    }

    createTFIDFVector(text) {
        const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
        const freqMap = {};
        for (const w of words) {
            freqMap[w] = (freqMap[w] || 0) + 1;
        }

        // Project onto a deterministic 128-dimension feature space using string hash buckets
        const vector = new Array(128).fill(0);
        for (const [word, freq] of Object.entries(freqMap)) {
            const hash = this._hashString(word);
            const index = Math.abs(hash) % 128;
            const sign = hash % 2 === 0 ? 1 : -1;
            vector[index] += sign * (1 + Math.log(freq));
        }

        return this._normalizeVector(vector);
    }

    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

    _normalizeVector(vec) {
        const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
        if (norm === 0) return vec;
        return vec.map(val => val / norm);
    }
}

module.exports = new EmbeddingService();
