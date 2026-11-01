const { getDatabase } = require('../../database/init');
const crypto = require('crypto');

class DBService {
    constructor() {
        this.db = getDatabase();
    }

    // Standards Queries
    getAllStandards(category, search) {
        let sql = `SELECT * FROM standards WHERE 1=1`;
        const params = [];

        if (category && category !== 'All') {
            sql += ` AND category = ?`;
            params.push(category);
        }

        if (search) {
            sql += ` AND (is_number LIKE ? OR title LIKE ? OR scope LIKE ?)`;
            const term = `%${search}%`;
            params.push(term, term, term);
        }

        sql += ` ORDER BY is_mandatory DESC, is_number ASC`;
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(r => this._parseStandardRow(r));
    }

    getStandardByIdOrNumber(idOrNumber) {
        const row = this.db.prepare(`
            SELECT * FROM standards 
            WHERE id = ? OR LOWER(is_number) = LOWER(?) OR LOWER(REPLACE(is_number, ' ', '')) = LOWER(REPLACE(?, ' ', ''))
        `).get(idOrNumber, idOrNumber, idOrNumber);

        return row ? this._parseStandardRow(row) : null;
    }

    // Services Queries
    getAllServices() {
        const rows = this.db.prepare(`SELECT * FROM services ORDER BY name ASC`).all();
        return rows.map(r => ({
            ...r,
            key_steps: r.key_steps ? JSON.parse(r.key_steps) : [],
            is_mandatory_available: Boolean(r.is_mandatory_available)
        }));
    }

    getServiceById(id) {
        const row = this.db.prepare(`SELECT * FROM services WHERE id = ?`).get(id);
        if (!row) return null;
        return {
            ...row,
            key_steps: row.key_steps ? JSON.parse(row.key_steps) : [],
            is_mandatory_available: Boolean(row.is_mandatory_available)
        };
    }

    // Hybrid Keyword & Semantic Retrieval for RAG
    searchDocumentChunks(queryTerms, isNumberFilter = null, limit = 6) {
        let sql = `
            SELECT c.*, d.title as doc_title, d.document_type, s.name as source_name, s.url as source_url
            FROM document_chunks c
            JOIN documents d ON c.document_id = d.id
            LEFT JOIN sources s ON d.source_id = s.id
            WHERE 1=1
        `;
        const params = [];

        if (isNumberFilter) {
            sql += ` AND LOWER(c.is_number) = LOWER(?)`;
            params.push(isNumberFilter);
        }

        // Build keyword matching score condition
        if (queryTerms && queryTerms.length > 0) {
            const conditions = queryTerms.map(() => `(LOWER(c.content) LIKE ? OR LOWER(c.keywords) LIKE ?)`).join(' OR ');
            sql += ` AND (${conditions})`;
            for (const term of queryTerms) {
                const likeTerm = `%${term.toLowerCase()}%`;
                params.push(likeTerm, likeTerm);
            }
        }

        sql += ` LIMIT 20`;
        const rows = this.db.prepare(sql).all(...params);

        // Fallback: If no strict matches with terms, return top chunks
        if (rows.length === 0) {
            const fallbackRows = this.db.prepare(`
                SELECT c.*, d.title as doc_title, d.document_type, s.name as source_name, s.url as source_url
                FROM document_chunks c
                JOIN documents d ON c.document_id = d.id
                LEFT JOIN sources s ON d.source_id = s.id
                LIMIT ?
            `).all(limit);
            return fallbackRows;
        }

        return rows.slice(0, limit);
    }

    // Conversation Management
    createConversation(title = 'New Chat Session') {
        const id = `conv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        this.db.prepare(`INSERT INTO conversations (id, title) VALUES (?, ?)`).run(id, title);
        return { id, title, created_at: new Date().toISOString() };
    }

    getConversationHistory(conversationId) {
        const conv = this.db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(conversationId);
        if (!conv) return null;

        const messages = this.db.prepare(`
            SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
        `).all(conversationId).map(m => ({
            id: m.id,
            sender: m.sender,
            content: m.content,
            confidenceScore: m.confidence_score,
            citations: m.citations ? JSON.parse(m.citations) : [],
            followUpQuestions: m.follow_up_questions ? JSON.parse(m.follow_up_questions) : [],
            created_at: m.created_at
        }));

        return { conversation: conv, messages };
    }

    addMessage({ conversationId, sender, content, confidenceScore = 1.0, citations = [], followUpQuestions = [] }) {
        const id = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        this.db.prepare(`
            INSERT INTO messages (id, conversation_id, sender, content, confidence_score, citations, follow_up_questions)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            conversationId,
            sender,
            content,
            confidenceScore,
            JSON.stringify(citations),
            JSON.stringify(followUpQuestions)
        );

        // Update conversation timestamp & title if first user message
        const msgCount = this.db.prepare(`SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?`).get(conversationId).count;
        if (sender === 'user' && msgCount <= 2) {
            const shortTitle = content.length > 35 ? content.substring(0, 35) + '...' : content;
            this.db.prepare(`UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(shortTitle, conversationId);
        } else {
            this.db.prepare(`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(conversationId);
        }

        return { id, conversationId, sender, content, confidenceScore, citations, followUpQuestions };
    }

    clearConversation(conversationId) {
        this.db.prepare(`DELETE FROM messages WHERE conversation_id = ?`).run(conversationId);
    }

    // Feedback
    saveFeedback({ messageId, queryText, rating, comments }) {
        const id = `fb_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        this.db.prepare(`
            INSERT INTO feedback (id, message_id, query_text, rating, comments)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, messageId || null, queryText || null, rating, comments || null);
        return { id, success: true };
    }

    // Helper
    _parseStandardRow(r) {
        return {
            id: r.id,
            isNumber: r.is_number,
            year: r.year,
            title: r.title,
            category: r.category,
            department: r.department,
            isMandatory: Boolean(r.is_mandatory),
            qcoOrder: r.qco_order,
            qcoNotificationDate: r.qco_notification_date,
            enforcingMinistry: r.enforcing_ministry,
            scope: r.scope,
            testingRequirements: r.testing_requirements ? JSON.parse(r.testing_requirements) : [],
            clauses: r.clauses ? JSON.parse(r.clauses) : [],
            scheme: r.scheme,
            officialUrl: r.official_url,
            labCapabilities: r.lab_capabilities ? JSON.parse(r.lab_capabilities) : []
        };
    }
}

module.exports = new DBService();
