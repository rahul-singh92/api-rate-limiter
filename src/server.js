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
const { FixedWindow, TokenBucket } = require('./algorithms');
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

// Fixed Window Limiter
const fixedWindowLimiter = new FixedWindow({
    windowMs: config.rateLimit.fixedWindow.windowMs,
    maxRequests: config.rateLimit.fixedWindow.maxRequests
});

// Token Bucket Limiter
const tokenBucketLimiter = new TokenBucket({
    capacity: 100,      // Can burst up to 100 requests
    refillRate: 10,     // 10 tokens per second sustained
    tokensPerRequest: 1
});

// Apply rate limiting to all /api routes
app.use('/api/fixed', createRateLimiter(fixedWindowLimiter));
app.use('/api/token', createRateLimiter(tokenBucketLimiter));

// Default to Fixed Window for /api
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
// Fixed Window endpoints
app.get('/api/fixed/data', (req, res) => {
    res.json({
        message: 'This endpoint uses Fixed Window rate limiting',
        algorithm: 'FixedWindow',
        data: { timestamp: new Date().toISOString() }
    });
});

// Token Bucket endpoints
app.get('/api/token/data', (req, res) => {
    res.json({
        message: 'This endpoint uses Token Bucket rate limiting',
        algorithm: 'TokenBucket',
        data: { timestamp: new Date().toISOString() }
    });
});

// Generic endpoint (uses default Fixed Window)
app.get('/api/data', (req, res) => {
    res.json({
        message: 'This endpoint is rate limited',
        data: { timestamp: new Date().toISOString() }
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
    const fixedStats = fixedWindowLimiter.getStats();
    const tokenStats = tokenBucketLimiter.getStats();

    res.json({
        server: summary,
        rateLimiter: {
            fixedWindow: fixedStats,
            tokenBucket: tokenStats
        }
    });
});

/**
 * Algorithm info endpoint
 * Provides information about the current algorithm
 */
app.get('/algorithms', (req, res) => {
    res.json({
        available: [
            {
                name: 'FixedWindow',
                endpoint: '/api/fixed/*',
                description: 'Fixed time windows with request counting',
                bestFor: 'Simple use cases, internal APIs'
            },
            {
                name: 'TokenBucket',
                endpoint: '/api/token/*',
                description: 'Token-based with burst capability',
                bestFor: 'Production APIs, bursty traffic'
            }
        ],
        comparison: {
            boundary_problem: {
                FixedWindow: 'Vulnerable',
                TokenBucket: 'Not vulnerable'
            },
            burst_handling: {
                FixedWindow: 'Poor',
                TokenBucket: 'Excellent'
            },
            complexity: {
                FixedWindow: 'O(1)',
                TokenBucket: 'O(1)'
            }
        }
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
        algorithms: ['FixedWindow', 'TokenBucket']
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        fixedWindowLimiter.stop();
        tokenBucketLimiter.stop();
        process.exit(0);
    });
});

module.exports = app;
