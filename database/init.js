const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'know_your_bis.db');
const JSON_DB_PATH = path.join(__dirname, '..', 'know_your_bis_data.json');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let dbInstance = null;

class PureJSSQLiteEngine {
    constructor(filePath) {
        this.filePath = filePath;
        this.tables = {
            sources: [],
            documents: [],
            document_chunks: [],
            standards: [],
            services: [],
            conversations: [],
            messages: [],
            feedback: []
        };
        this.load();
    }

    load() {
        if (fs.existsSync(JSON_DB_PATH)) {
            try {
                const raw = fs.readFileSync(JSON_DB_PATH, 'utf8');
                this.tables = JSON.parse(raw);
            } catch (err) {
                console.warn('Failed to load JSON database backup, starting fresh:', err.message);
            }
        }
    }

    save() {
        try {
            fs.writeFileSync(JSON_DB_PATH, JSON.stringify(this.tables, null, 2), 'utf8');
        } catch (err) {
            console.error('Failed to save persistent store:', err.message);
        }
    }

    pragma(cmd) {
        // No-op for pragma compatibility
    }

    exec(sql) {
        // Schema initialization no-op for pure JS engine
    }

    transaction(fn) {
        return (...args) => {
            const res = fn(...args);
            this.save();
            return res;
        };
    }

    prepare(sql) {
        const engine = this;
        const normalizedSql = sql.trim().replace(/\s+/g, ' ');

        return {
            run(...params) {
                const res = engine._executeRun(normalizedSql, params);
                engine.save();
                return res;
            },
            get(...params) {
                return engine._executeGet(normalizedSql, params);
            },
            all(...params) {
                return engine._executeAll(normalizedSql, params);
            }
        };
    }

    _executeRun(sql, params) {
        if (sql.startsWith('INSERT OR REPLACE INTO sources')) {
            const [id, name, url, type, publisher, trust_tier] = params;
            this.tables.sources = this.tables.sources.filter(s => s.id !== id && s.url !== url);
            this.tables.sources.push({ id, name, url, type, publisher, trust_tier, created_at: new Date().toISOString() });
            return { changes: 1 };
        }

        if (sql.startsWith('INSERT OR REPLACE INTO standards')) {
            const [id, is_number, year, title, category, department, is_mandatory, qco_order, qco_notification_date, enforcing_ministry, scope, testing_requirements, clauses, scheme, official_url, lab_capabilities] = params;
            this.tables.standards = this.tables.standards.filter(s => s.id !== id && s.is_number !== is_number);
            this.tables.standards.push({
                id, is_number, year, title, category, department, is_mandatory,
                qco_order, qco_notification_date, enforcing_ministry, scope,
                testing_requirements, clauses, scheme, official_url, lab_capabilities,
                created_at: new Date().toISOString()
            });
            return { changes: 1 };
        }

        if (sql.startsWith('INSERT OR REPLACE INTO documents')) {
            const [id, source_id, title, document_type, is_number, year, category, content, metadata] = params;
            this.tables.documents = this.tables.documents.filter(d => d.id !== id);
            this.tables.documents.push({ id, source_id, title, document_type, is_number, year, category, content, metadata, created_at: new Date().toISOString() });
            return { changes: 1 };
        }

        if (sql.startsWith('INSERT OR REPLACE INTO document_chunks')) {
            let id, document_id, chunk_index, content, is_number, clause_no, clause_title, keywords;
            if (params.length === 8) {
                [id, document_id, chunk_index, content, is_number, clause_no, clause_title, keywords] = params;
            } else {
                [id, document_id, chunk_index, content, keywords] = params;
            }
            this.tables.document_chunks = this.tables.document_chunks.filter(c => c.id !== id);
            this.tables.document_chunks.push({
                id, document_id, chunk_index, content,
                is_number: is_number || null,
                clause_no: clause_no || null,
                clause_title: clause_title || null,
                keywords: keywords || '',
                created_at: new Date().toISOString()
            });
            return { changes: 1 };
        }

        if (sql.startsWith('INSERT OR REPLACE INTO services')) {
            const [id, name, category, description, target_audience, key_steps, portal_url, is_mandatory_available] = params;
            this.tables.services = this.tables.services.filter(s => s.id !== id && s.name !== name);
            this.tables.services.push({
                id, name, category, description, target_audience, key_steps, portal_url, is_mandatory_available,
                created_at: new Date().toISOString()
            });
            return { changes: 1 };
        }

        if (sql.startsWith('INSERT INTO conversations')) {
            const [id, title] = params;
            this.tables.conversations.push({ id, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
            return { changes: 1 };
        }

        if (sql.startsWith('UPDATE conversations SET title =')) {
            const [title, id] = params;
            const conv = this.tables.conversations.find(c => c.id === id);
            if (conv) {
                conv.title = title;
                conv.updated_at = new Date().toISOString();
            }
            return { changes: 1 };
        }

        if (sql.startsWith('UPDATE conversations SET updated_at')) {
            const [id] = params;
            const conv = this.tables.conversations.find(c => c.id === id);
            if (conv) conv.updated_at = new Date().toISOString();
            return { changes: 1 };
        }

        if (sql.startsWith('INSERT INTO messages')) {
            const [id, conversation_id, sender, content, confidence_score, citations, follow_up_questions] = params;
            this.tables.messages.push({
                id, conversation_id, sender, content, confidence_score, citations, follow_up_questions,
                created_at: new Date().toISOString()
            });
            return { changes: 1 };
        }

        if (sql.startsWith('DELETE FROM messages WHERE conversation_id =')) {
            const [conversationId] = params;
            this.tables.messages = this.tables.messages.filter(m => m.conversation_id !== conversationId);
            return { changes: 1 };
        }

        if (sql.startsWith('INSERT INTO feedback')) {
            const [id, message_id, query_text, rating, comments] = params;
            this.tables.feedback.push({ id, message_id, query_text, rating, comments, created_at: new Date().toISOString() });
            return { changes: 1 };
        }

        return { changes: 0 };
    }

    _executeGet(sql, params) {
        if (sql.includes('COUNT(*) as c FROM standards') || sql.includes('COUNT(*) as count FROM standards')) {
            return { c: this.tables.standards.length, count: this.tables.standards.length };
        }
        if (sql.includes('COUNT(*) as count FROM document_chunks')) {
            return { count: this.tables.document_chunks.length };
        }
        if (sql.includes('COUNT(*) as count FROM messages WHERE conversation_id =')) {
            const count = this.tables.messages.filter(m => m.conversation_id === params[0]).length;
            return { count };
        }
        if (sql.includes('SELECT * FROM standards WHERE id =') || sql.includes('LOWER(is_number) = LOWER(?)')) {
            const val = (params[0] || '').toLowerCase().replace(/\s+/g, '');
            return this.tables.standards.find(s => 
                s.id === params[0] || 
                s.is_number.toLowerCase() === val || 
                s.is_number.toLowerCase().replace(/\s+/g, '') === val
            ) || null;
        }
        if (sql.includes('SELECT * FROM services WHERE id =')) {
            return this.tables.services.find(s => s.id === params[0]) || null;
        }
        if (sql.includes('SELECT * FROM conversations WHERE id =')) {
            return this.tables.conversations.find(c => c.id === params[0]) || null;
        }
        return null;
    }

    _executeAll(sql, params) {
        if (sql.includes('SELECT * FROM services ORDER BY name ASC')) {
            return [...this.tables.services].sort((a, b) => a.name.localeCompare(b.name));
        }

        if (sql.includes('SELECT * FROM standards WHERE 1=1')) {
            let results = [...this.tables.standards];
            if (params.length > 0) {
                if (params[0] && !params[0].startsWith('%')) { // Category filter
                    const cat = params[0];
                    results = results.filter(s => s.category === cat);
                }
                const searchTerm = params.find(p => typeof p === 'string' && p.startsWith('%'));
                if (searchTerm) {
                    const term = searchTerm.replace(/%/g, '').toLowerCase();
                    results = results.filter(s => 
                        s.is_number.toLowerCase().includes(term) ||
                        s.title.toLowerCase().includes(term) ||
                        s.scope.toLowerCase().includes(term)
                    );
                }
            }
            return results.sort((a, b) => (b.is_mandatory - a.is_mandatory) || a.is_number.localeCompare(b.is_number));
        }

        if (sql.includes('SELECT * FROM messages WHERE conversation_id =')) {
            const convId = params[0];
            return this.tables.messages
                .filter(m => m.conversation_id === convId)
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }

        if (sql.includes('FROM document_chunks c')) {
            let results = this.tables.document_chunks.map(c => {
                const doc = this.tables.documents.find(d => d.id === c.document_id) || {};
                const src = this.tables.sources.find(s => s.id === doc.source_id) || {};
                return {
                    ...c,
                    doc_title: doc.title || 'Official Document',
                    document_type: doc.document_type || 'standard_spec',
                    source_name: src.name || 'Bureau of Indian Standards',
                    source_url: src.url || 'https://www.bis.gov.in/'
                };
            });

            if (sql.includes('LOWER(c.is_number) = LOWER(?)')) {
                const isNo = (params[0] || '').toLowerCase();
                results = results.filter(c => c.is_number && c.is_number.toLowerCase() === isNo);
            }

            // Keyword match filter
            if (params.length > 1) {
                const terms = params.filter(p => typeof p === 'string' && p.startsWith('%')).map(p => p.replace(/%/g, '').toLowerCase());
                if (terms.length > 0) {
                    results = results.filter(c => {
                        const contentLower = c.content.toLowerCase();
                        const keywordsLower = (c.keywords || '').toLowerCase();
                        return terms.some(t => contentLower.includes(t) || keywordsLower.includes(t));
                    });
                }
            }

            const limit = params[params.length - 1] || 10;
            return results.slice(0, typeof limit === 'number' ? limit : 10);
        }

        return [];
    }
}

function getDatabase() {
    if (dbInstance) return dbInstance;

    // Try native better-sqlite3 first
    try {
        const Database = require('better-sqlite3');
        dbInstance = new Database(DB_PATH);
        dbInstance.pragma('journal_mode = WAL');
        dbInstance.pragma('foreign_keys = ON');

        if (fs.existsSync(SCHEMA_PATH)) {
            const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
            dbInstance.exec(schemaSql);
        }
        return dbInstance;
    } catch (err) {
        console.log('Using robust Pure JS SQLite persistence engine (Universal Node compatibility)');
        dbInstance = new PureJSSQLiteEngine(JSON_DB_PATH);
        return dbInstance;
    }
}

module.exports = {
    getDatabase,
    DB_PATH
};
