const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { CORS_ORIGIN } = require('../config/env');

const securityMiddleware = [
    // Helmet HTTP Header Protection
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "https://www.bis.gov.in"],
                connectSrc: ["'self'"]
            }
        }
    }),

    // CORS Handling
    cors({
        origin: CORS_ORIGIN,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }),

    // Rate Limiter
    rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 300, // limit each IP to 300 requests per windowMs
        message: { error: 'Too many requests from this IP, please try again later.' },
        standardHeaders: true,
        legacyHeaders: false
    })
];

module.exports = securityMiddleware;
