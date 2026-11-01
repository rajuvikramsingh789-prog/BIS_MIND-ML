const express = require('express');
const path = require('path');
const securityMiddleware = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');

// Route Imports
const healthRoutes = require('./routes/health');
const chatRoutes = require('./routes/chat');
const recommendRoutes = require('./routes/recommend');
const searchRoutes = require('./routes/search');
const standardsRoutes = require('./routes/standards');
const servicesRoutes = require('./routes/services');
const feedbackRoutes = require('./routes/feedback');

const app = express();

// Security and Parsers
app.use(securityMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// API Routes Binding
app.use('/api', healthRoutes);
app.use('/api', chatRoutes);
app.use('/api', recommendRoutes);
app.use('/api', searchRoutes);
app.use('/api', standardsRoutes);
app.use('/api', servicesRoutes);
app.use('/api', feedbackRoutes);

// Fallback HTML page routing for SPA/Static structure
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'pages/index.html'));
});

app.get('/assistant', (req, res) => {
    res.sendFile(path.join(frontendPath, 'pages/assistant.html'));
});

app.get('/recommend', (req, res) => {
    res.sendFile(path.join(frontendPath, 'pages/recommend.html'));
});

app.get('/services', (req, res) => {
    res.sendFile(path.join(frontendPath, 'pages/services.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(frontendPath, 'pages/about.html'));
});

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
