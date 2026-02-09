/**
 * Rate Limiter Middleware
 * 
 * Express middleware that applies rate limiting to incoming requests.
 * Integrates with our algorithm implementations and metrics collection.
 * 
 * @module middleware/rateLimiter
 */

const logger = require('../utils/logger');
const metrics = require('../utils/metrics');

/**
 * Create rate limiter middleware
 * 
 * @param {Object} rateLimiter - Rate limiter algorithm instance
 * @param {Object} options - Middleware options
 * @param {Function} options.keyGenerator - Function to extract client ID from request
 * @param {Function} options.handler - Custom handler for rate limit exceeded
 * @param {boolean} options.skipSuccessfulRequests - Don't count successful requests
 * @param {boolean} options.skipFailedRequests - Don't count failed requests
 * @returns {Function} Express middleware function
 */
function createRateLimiter(rateLimiter, options = {}) {
    // Default key generator uses IP address
    const keyGenerator = options.keyGenerator || ((req) => {
        return req.ip ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            'unknown';
    });

    // Default handler for rate limit exceeded
    const defaultHandler = (req, res, result) => {
        res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            limit: result.limit,
            remaining: result.remaining,
            resetTime: result.resetTime,
            resetIn: `${result.resetIn} seconds`
        });
    };

    const handler = options.handler || defaultHandler;
    const skipSuccessful = options.skipSuccessfulRequests || false;
    const skipFailed = options.skipFailedRequests || false;

    /**
     * Middleware function
     */
    return async function rateLimiterMiddleware(req, res, next) {
        try {
            // Extract client identifier
            const clientId = keyGenerator(req);

            // Check rate limit
            const result = await rateLimiter.check(clientId);

            // Add rate limit headers to response
            res.setHeader('X-RateLimit-Limit', result.limit);
            res.setHeader('X-RateLimit-Remaining', result.remaining);
            res.setHeader('X-RateLimit-Reset', result.resetTime);
            res.setHeader('X-RateLimit-Algorithm', result.algorithm);

            // Record metrics
            metrics.recordRequest({
                ip: clientId,
                allowed: result.allowed,
                algorithm: result.algorithm,
                remaining: result.remaining
            });

            if (!result.allowed) {
                // Rate limit exceeded
                res.setHeader('Retry-After', result.resetIn);

                logger.warn('Rate limit exceeded', {
                    clientId,
                    algorithm: result.algorithm,
                    resetIn: result.resetIn
                });

                return handler(req, res, result);
            }

            // Track request completion if needed
            if (skipSuccessful || skipFailed) {
                const originalSend = res.send;
                res.send = function (data) {
                    const statusCode = res.statusCode;

                    // Adjust count based on response status
                    if ((skipSuccessful && statusCode < 400) ||
                        (skipFailed && statusCode >= 400)) {
                        // Would need to decrement counter
                        // This is complex with Fixed Window - better handled in other algorithms
                    }

                    return originalSend.call(this, data);
                };
            }

            // Allow request to proceed
            next();

        } catch (error) {
            logger.error('Rate limiter middleware error', {
                error: error.message,
                stack: error.stack
            });

            // Fail open - allow request on error
            next();
        }
    };
}

module.exports = createRateLimiter;
