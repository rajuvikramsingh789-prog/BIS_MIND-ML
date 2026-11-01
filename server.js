const app = require('./backend/app');
const { PORT } = require('./backend/config/env');
const { getDatabase } = require('./database/init');
const { seedDatabase } = require('./database/seed');

// Initialize database & check if seed is required
try {
    const db = getDatabase();
    const count = db.prepare(`SELECT COUNT(*) as c FROM standards`).get().c;
    if (count === 0) {
        console.log('Database empty. Running initial database seed...');
        seedDatabase();
    }
} catch (err) {
    console.error('Error during database initialization/check:', err.message);
}

const server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🇮🇳 Know Your BIS - AI Compliance & Standards Platform`);
    console.log(`=======================================================`);
    console.log(`Server running at: http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API Health Check: http://localhost:${PORT}/api/health`);
    console.log(`=======================================================`);
});

module.exports = server;
