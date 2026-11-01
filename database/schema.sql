-- Know Your BIS Database Schema (SQLite)

PRAGMA foreign_keys = ON;

-- 1. Sources Table
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- 'official_portal', 'qco_notification', 'standards_catalog', 'lab_directory'
    publisher TEXT DEFAULT 'Bureau of Indian Standards',
    trust_tier INTEGER DEFAULT 1, -- 1: Official Govt/BIS, 2: Accredited Lab, 3: General
    last_fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    document_type TEXT NOT NULL, -- 'standard_spec', 'qco_order', 'lab_guideline', 'scheme_doc'
    is_number TEXT,
    year INTEGER,
    category TEXT,
    content TEXT NOT NULL,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Document Chunks Table (For Hybrid RAG & Vector/Keyword Search)
CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_number TEXT,
    clause_no TEXT,
    clause_title TEXT,
    keywords TEXT, -- comma-separated keywords for BM25/keyword indexing
    embedding TEXT, -- JSON array of floating point numbers
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Standards Table
CREATE TABLE IF NOT EXISTS standards (
    id TEXT PRIMARY KEY,
    is_number TEXT UNIQUE NOT NULL,
    year INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    department TEXT,
    is_mandatory INTEGER DEFAULT 0, -- 1 for True, 0 for False
    qco_order TEXT,
    qco_notification_date TEXT,
    enforcing_ministry TEXT,
    scope TEXT NOT NULL,
    testing_requirements JSON,
    clauses JSON,
    scheme TEXT NOT NULL,
    official_url TEXT NOT NULL,
    lab_capabilities JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Services Table
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    target_audience TEXT,
    key_steps JSON,
    portal_url TEXT NOT NULL,
    is_mandatory_available INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT 'New Conversation',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK(sender IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    confidence_score REAL, -- 0.0 to 1.0
    citations JSON, -- Array of source citation objects
    follow_up_questions JSON, -- Array of suggested questions
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
    query_text TEXT,
    rating INTEGER CHECK(rating IN (1, -1)), -- +1 thumbs up, -1 thumbs down
    comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chunks_is_number ON document_chunks(is_number);
CREATE INDEX IF NOT EXISTS idx_standards_is_number ON standards(is_number);
CREATE INDEX IF NOT EXISTS idx_standards_category ON standards(category);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
