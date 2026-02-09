/**
 * Fixed Window Rate Limiting Algorithm
 * 
 * ALGORITHM DESCRIPTION:
 * The Fixed Window algorithm divides time into fixed-duration windows
 * (e.g., 1 minute). It counts requests within each window and resets
 * the counter when the window expires.
 * 
 * HOW IT WORKS:
 * 1. Determine current time window based on current timestamp
 * 2. Check if request count in current window < limit
 * 3. If yes, increment counter and allow request
 * 4. If no, reject request
 * 5. When window expires, reset counter to 0
 * 
 * TIME COMPLEXITY: O(1) for each request
 * SPACE COMPLEXITY: O(n) where n = number of unique clients
 * 
 * ADVANTAGES:
 * + Very simple to implement and understand
 * + Memory efficient (only stores count, not individual requests)
 * + Fast: constant time operations
 * + Easy to reason about and debug
 * 
 * DISADVANTAGES:
 * - Boundary Problem: Can allow 2x requests at window boundaries
 *   Example: 100 requests at 00:59, 100 requests at 01:00 = 200 in 1 second
 * - Not perfectly fair: early requests in window have advantage
 * - Sudden reset can cause traffic spikes
 * 
 * WHEN TO USE:
 * ✓ Internal APIs where exact fairness isn't critical
 * ✓ Low-traffic applications
 * ✓ Development/testing environments
 * ✓ When simplicity is more important than precision
 * 
 * WHEN NOT TO USE:
 * ✗ Public APIs with strict SLAs
 * ✗ High-security applications
 * ✗ When burst traffic at boundaries is a concern
 * 
 * @module algorithms/FixedWindow
 */

const logger = require('../utils/logger');

class FixedWindowRateLimiter {
    /**
     * Create a Fixed Window Rate Limiter
     * @param {Object} options - Configuration options
     * @param {number} options.windowMs - Window size in milliseconds
     * @param {number} options.maxRequests - Maximum requests per window
     */
    constructor(options = {}) {
        this.windowMs = options.windowMs || 60000; // Default: 1 minute
        this.maxRequests = options.maxRequests || 100;

        // Storage for client request counts
        // Structure: Map<clientId, { count: number, windowStart: number }>
        this.clients = new Map();

        // Cleanup old entries periodically to prevent memory leaks
        this.startCleanup();

        logger.info('FixedWindow rate limiter initialized', {
            windowMs: this.windowMs,
            maxRequests: this.maxRequests,
            windowSeconds: this.windowMs / 1000
        });
    }

    /**
     * Check if a request should be allowed
     * 
     * ALGORITHM STEPS:
     * 1. Get current timestamp
     * 2. Calculate current window start time
     * 3. Retrieve client's data (or create new)
     * 4. Check if we're in a new window
     * 5. If new window, reset count
     * 6. Check if count < max
     * 7. Increment count if allowed
     * 8. Return decision with metadata
     * 
     * @param {string} clientId - Unique identifier for client (IP, user ID, API key)
     * @returns {Object} Decision object with allowed status and metadata
     */
    async check(clientId) {
        const now = Date.now();
        const currentWindowStart = this.getCurrentWindowStart(now);

        // Get or create client record
        let clientData = this.clients.get(clientId);

        if (!clientData) {
            // First request from this client
            clientData = {
                count: 0,
                windowStart: currentWindowStart
            };
            this.clients.set(clientId, clientData);
        }

        // Check if we're in a new window
        if (clientData.windowStart < currentWindowStart) {
            // New window started - reset counter
            clientData.count = 0;
            clientData.windowStart = currentWindowStart;

            logger.debug('New window started for client', {
                clientId,
                windowStart: new Date(currentWindowStart).toISOString()
            });
        }

        // Check if request should be allowed
        const allowed = clientData.count < this.maxRequests;

        if (allowed) {
            clientData.count++;
        }

        // Calculate when the window resets
        const resetTime = currentWindowStart + this.windowMs;
        const resetIn = Math.ceil((resetTime - now) / 1000); // seconds

        const result = {
            allowed,
            limit: this.maxRequests,
            remaining: Math.max(0, this.maxRequests - clientData.count),
            resetTime: new Date(resetTime).toISOString(),
            resetIn,
            algorithm: 'FixedWindow'
        };

        logger.debug('Rate limit check', {
            clientId,
            ...result
        });

        return result;
    }

    /**
     * Calculate the start of the current time window
     * 
     * FORMULA: floor(currentTime / windowSize) * windowSize
     * 
     * Example with 60-second window:
     * - Time: 125 seconds → Window start: 120 seconds
     * - Time: 185 seconds → Window start: 180 seconds
     * 
     * @param {number} timestamp - Current timestamp in milliseconds
     * @returns {number} Window start timestamp
     */
    getCurrentWindowStart(timestamp) {
        return Math.floor(timestamp / this.windowMs) * this.windowMs;
    }

    /**
     * Start periodic cleanup of expired client data
     * Prevents memory leaks by removing old entries
     */
    startCleanup() {
        // Run cleanup every window duration
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, this.windowMs);

        // Don't prevent process exit
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    /**
     * Remove expired client entries
     * An entry is expired if its window ended more than 2 windows ago
     */
    cleanup() {
        const now = Date.now();
        const expirationTime = now - (this.windowMs * 2);
        let removedCount = 0;

        for (const [clientId, data] of this.clients.entries()) {
            if (data.windowStart < expirationTime) {
                this.clients.delete(clientId);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            logger.debug('Cleanup completed', {
                removedClients: removedCount,
                remainingClients: this.clients.size
            });
        }
    }

    /**
     * Get current statistics
     * @returns {Object} Current state statistics
     */
    getStats() {
        return {
            algorithm: 'FixedWindow',
            activeClients: this.clients.size,
            windowMs: this.windowMs,
            maxRequests: this.maxRequests,
            config: {
                windowSeconds: this.windowMs / 1000,
                requestsPerSecond: this.maxRequests / (this.windowMs / 1000)
            }
        };
    }

    /**
     * Reset all client data (useful for testing)
     */
    reset() {
        this.clients.clear();
        logger.info('Rate limiter reset');
    }

    /**
     * Stop the cleanup interval
     */
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

module.exports = FixedWindowRateLimiter;
