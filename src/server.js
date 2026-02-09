/**
 * Main Server File
 * 
 * This is the entry point for our API Rate Limiter application.
 * It sets up Express, applies rate limiting middleware, and defines routes.
 */

require('dotenv').config();
const express = require('express');
const config = require('./config/default');
const logger = require('./utils/logger');
const metrics = require('./utils/metrics');
const { FixedWindow } = require('./algorithms');
const createRateLimiter = require('./middleware/rateLimiter');

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy (important for getting real IP behind reverse proxy)
app.set('trust proxy', true);

// Request logging
app.use((req, res, next) => {
    logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip
    });
    next();
});

// Initialize rate limiter
const fixedWindowLimiter = new FixedWindow({
    windowMs: config.rateLimit.fixedWindow.windowMs,
    maxRequests: config.rateLimit.fixedWindow.maxRequests
});

// Apply rate limiting to all /api routes
app.use('/api', createRateLimiter(fixedWindowLimiter));

// ============================================
// API Routes
// ============================================

/**
 * Health check endpoint
 * Not rate limited
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

/**
 * Sample API endpoint (rate limited)
 */
app.get('/api/data', (req, res) => {
    res.json({
        message: 'This endpoint is rate limited',
        data: {
            timestamp: new Date().toISOString(),
            random: Math.random()
        }
    });
});

/**
 * Another sample endpoint (rate limited)
 */
app.post('/api/submit', (req, res) => {
    res.json({
        message: 'Data submitted successfully',
        received: req.body
    });
});

/**
 * Metrics endpoint
 * Shows current rate limiting statistics
 */
app.get('/metrics', (req, res) => {
    const summary = metrics.getSummary();
    const limiterStats = fixedWindowLimiter.getStats();

    res.json({
        server: summary,
        rateLimiter: limiterStats
    });
});

/**
 * Algorithm info endpoint
 * Provides information about the current algorithm
 */
app.get('/algorithm/info', (req, res) => {
    res.json({
        current: 'FixedWindow',
        description: 'Fixed Window Counter algorithm divides time into fixed windows and counts requests within each window.',
        config: {
            windowMs: config.rateLimit.fixedWindow.windowMs,
            windowSeconds: config.rateLimit.fixedWindow.windowMs / 1000,
            maxRequests: config.rateLimit.fixedWindow.maxRequests,
            requestsPerSecond: config.rateLimit.fixedWindow.maxRequests / (config.rateLimit.fixedWindow.windowMs / 1000)
        },
        complexity: {
            time: 'O(1)',
            space: 'O(n) where n = number of unique clients'
        },
        advantages: [
            'Simple to implement',
            'Memory efficient',
            'Fast constant-time operations',
            'Easy to understand'
        ],
        disadvantages: [
            'Boundary problem (can allow 2x requests at window edges)',
            'Not perfectly fair',
            'Sudden traffic spikes at window reset'
        ]
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path
    });

    res.status(500).json({
        error: 'Internal Server Error',
        message: config.server.env === 'development' ? err.message : 'An error occurred'
    });
});

// Start server
const PORT = config.server.port;

const server = app.listen(PORT, () => {
    logger.info(`Server started`, {
        port: PORT,
        environment: config.server.env,
        algorithm: 'FixedWindow',
        rateLimit: `${config.rateLimit.fixedWindow.maxRequests} requests per ${config.rateLimit.fixedWindow.windowMs / 1000} seconds`
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        fixedWindowLimiter.stop();
        process.exit(0);
    });
});

module.exports = app;
