/**
 * Sliding Window Counter Rate Limiting Algorithm
 * 
 * ALGORITHM DESCRIPTION:
 * The Sliding Window Counter is a HYBRID approach that combines:
 * - Accuracy of Sliding Window Log
 * - Efficiency of Fixed Window
 * 
 * It uses TWO windows (current and previous) and calculates a weighted count
 * based on the overlap between the current time and the window boundary.
 * 
 * THE GENIUS IDEA:
 * Instead of storing every timestamp (like Sliding Window Log), we store
 * just TWO counters and calculate the "virtual" sliding window using
 * a weighted average.
 * 
 * HOW IT WORKS - VISUAL EXAMPLE:
 * 
 * Limit: 100 requests per 60 seconds
 * Current time: 00:01:15 (15 seconds into minute 2)
 * 
 * Previous Window (00:00:00 - 00:01:00): 80 requests
 * Current Window  (00:01:00 - 00:02:00): 30 requests
 * 
 * Sliding Window (00:00:15 - 00:01:15):
 * ┌─────────────────────────────────────────────────────┐
 * │ Previous Window      │ Current Window               │
 * │ 00:00:00 - 00:01:00  │ 00:01:00 - 00:02:00         │
 * │      80 reqs         │      30 reqs                 │
 * │                      │                              │
 * │         ←─ 45s ─→    │  ←─── 15s ───→              │
 * │         (75% of      │  (25% of                     │
 * │          window)     │   window)                    │
 * └─────────────────────────────────────────────────────┘
 * 
 * Formula:
 * weighted_count = (previous_count × overlap_percentage) + current_count
 * weighted_count = (80 × 0.75) + 30
 * weighted_count = 60 + 30 = 90
 * 
 * Result: 90 < 100, so ALLOW the request! ✓
 * 
 * MATHEMATICAL MODEL:
 * 
 * Variables:
 * - P = Previous window count
 * - C = Current window count
 * - W = Window size (e.g., 60 seconds)
 * - t = Time elapsed in current window
 * 
 * Overlap percentage = (W - t) / W
 * 
 * Weighted count = P × ((W - t) / W) + C
 * 
 * Example:
 * P = 80, C = 30, W = 60s, t = 15s
 * Weighted = 80 × ((60-15)/60) + 30
 * Weighted = 80 × 0.75 + 30 = 90
 * 
 * WHY THIS IS BRILLIANT:
 * 
 * 1. MEMORY EFFICIENT:
 *    - Sliding Window Log: O(n) - stores every timestamp
 *    - Sliding Window Counter: O(1) - stores only 2 numbers!
 * 
 * 2. TIME EFFICIENT:
 *    - Sliding Window Log: O(n) - must scan all timestamps
 *    - Sliding Window Counter: O(1) - simple calculation!
 * 
 * 3. REASONABLY ACCURATE:
 *    - Fixed Window: Poor accuracy (boundary problem)
 *    - Sliding Window Counter: ~95% accurate approximation
 * 
 * 4. NO BOUNDARY PROBLEM:
 *    - Uses weighted average, not hard reset
 *    - Smooth transition between windows
 * 
 * ACCURACY EXAMPLE - WORST CASE:
 * 
 * Scenario: All 100 requests at end of previous window
 * 
 * Time: 00:00:59 - Previous: 100, Current: 0
 * Actual sliding (59-59): 100 requests ✓ (correct)
 * Weighted: 100 × (1/60) + 0 = 1.67 ✓ (approximation)
 * 
 * Time: 00:01:01 - Previous: 100, Current: 0
 * Actual sliding (00:01 - 01:01): 100 requests ✓
 * Weighted: 100 × (59/60) + 0 = 98.33 ✓ (close!)
 * 
 * Even in worst case, error is typically < 5%
 * 
 * COMPARISON TABLE:
 * 
 * ┌────────────────────┬──────────┬──────────┬──────────┬──────────┐
 * │ Algorithm          │ Memory   │ Speed    │ Accuracy │ Boundary │
 * ├────────────────────┼──────────┼──────────┼──────────┼──────────┤
 * │ Fixed Window       │ O(1) ✓   │ O(1) ✓   │ Poor ✗   │ Yes ✗    │
 * │ Token Bucket       │ O(1) ✓   │ O(1) ✓   │ Good ✓   │ No ✓     │
 * │ Leaky Bucket       │ O(1) ✓   │ O(1) ✓   │ Good ✓   │ No ✓     │
 * │ Sliding Log        │ O(n) ✗   │ O(n) ✗   │ Perfect✓ │ No ✓     │
 * │ Sliding Counter    │ O(1) ✓   │ O(1) ✓   │ Great ✓  │ No ✓     │
 * └────────────────────┴──────────┴──────────┴──────────┴──────────┘
 * 
 * ADVANTAGES:
 * + Memory efficient (O(1))
 * + Time efficient (O(1))
 * + No boundary problem
 * + Good accuracy (~95%)
 * + Production ready
 * + Best of both worlds!
 * 
 * DISADVANTAGES:
 * - Not 100% accurate (approximation)
 * - Slightly more complex than Fixed Window
 * - Can allow small burst at boundary (rare edge cases)
 * 
 * WHEN TO USE:
 * ✓ High-traffic production APIs
 * ✓ When accuracy matters but memory is limited
 * ✓ When you need O(1) performance
 * ✓ RESTful web services
 * ✓ Mobile app backends
 * ✓ Microservices
 * 
 * WHEN NOT TO USE:
 * ✗ When 100% accuracy is required (use Sliding Log)
 * ✗ When bursts should be allowed (use Token Bucket)
 * ✗ When constant rate required (use Leaky Bucket)
 * 
 * REAL-WORLD EXAMPLES:
 * - Cloudflare: Rate limiting at edge
 * - Kong API Gateway: Default rate limiting
 * - NGINX Plus: Rate limiting module
 * - Many CDNs: DDoS protection
 * 
 * @module algorithms/SlidingWindowCounter
 */

const logger = require('../utils/logger');

class SlidingWindowCounterRateLimiter {
    /**
     * Create a Sliding Window Counter Rate Limiter
     * 
     * @param {Object} options - Configuration options
     * @param {number} options.windowMs - Time window in milliseconds
     * @param {number} options.maxRequests - Maximum requests per window
     */
    constructor(options = {}) {
        // Window size: Duration of each window
        this.windowMs = options.windowMs || 60000; // Default: 1 minute

        // Max requests: Limit per window
        this.maxRequests = options.maxRequests || 100;

        // Storage for client windows
        // Structure: Map<clientId, { previousCount, currentCount, windowStart }>
        this.windows = new Map();

        // Start cleanup to prevent memory leaks
        this.startCleanup();

        logger.info('SlidingWindowCounter rate limiter initialized', {
            windowMs: this.windowMs,
            windowSeconds: this.windowMs / 1000,
            maxRequests: this.maxRequests,
            algorithm: 'SlidingWindowCounter'
        });
    }

    /**
     * Get the start of the current window
     * 
     * @param {number} timestamp - Current timestamp
     * @returns {number} Window start timestamp
     */
    getCurrentWindowStart(timestamp) {
        return Math.floor(timestamp / this.windowMs) * this.windowMs;
    }

    /**
     * Calculate the weighted request count using sliding window formula
     * 
     * FORMULA:
     * weighted_count = (previous_count × overlap_percentage) + current_count
     * 
     * Where:
     * overlap_percentage = (windowMs - time_in_current_window) / windowMs
     * 
     * @param {Object} window - Window data
     * @param {number} now - Current timestamp
     * @returns {number} Weighted count
     */
    calculateWeightedCount(window, now) {
        const currentWindowStart = this.getCurrentWindowStart(now);

        // Time elapsed in current window
        const timeInCurrentWindow = now - currentWindowStart;

        // How much of the previous window overlaps with our sliding window
        const overlapPercentage = Math.max(0, (this.windowMs - timeInCurrentWindow) / this.windowMs);

        // Weighted count using the formula
        const weightedCount = (window.previousCount * overlapPercentage) + window.currentCount;

        logger.debug('Weighted count calculated', {
            previousCount: window.previousCount,
            currentCount: window.currentCount,
            timeInCurrentWindow: timeInCurrentWindow.toFixed(0) + 'ms',
            overlapPercentage: (overlapPercentage * 100).toFixed(2) + '%',
            weightedCount: weightedCount.toFixed(2)
        });

        return weightedCount;
    }

    /**
     * Check if a request should be allowed
     * 
     * ALGORITHM STEPS:
     * 1. Get current window start time
     * 2. Get or create client's window data
     * 3. Check if we're in a new window
     * 4. If new window: shift current → previous, reset current
     * 5. Calculate weighted count using formula
     * 6. If weighted count < limit, allow and increment
     * 7. Return decision with metadata
     * 
     * @param {string} clientId - Unique identifier for client
     * @returns {Object} Decision object with allowed status and metadata
     */
    async check(clientId) {
        const now = Date.now();
        const currentWindowStart = this.getCurrentWindowStart(now);

        // Get or create client's window data
        let window = this.windows.get(clientId);

        if (!window) {
            // New client - start fresh
            window = {
                previousCount: 0,
                currentCount: 0,
                windowStart: currentWindowStart
            };
            this.windows.set(clientId, window);

            logger.debug('New window created', {
                clientId,
                windowStart: new Date(currentWindowStart).toISOString()
            });
        }

        // Check if we're in a new window
        if (window.windowStart < currentWindowStart) {
            // New window started - shift current to previous
            window.previousCount = window.currentCount;
            window.currentCount = 0;
            window.windowStart = currentWindowStart;

            logger.debug('Window shifted', {
                clientId,
                newWindowStart: new Date(currentWindowStart).toISOString(),
                previousCount: window.previousCount
            });
        }

        // Calculate weighted count for the sliding window
        const weightedCount = this.calculateWeightedCount(window, now);

        // Check if request should be allowed
        const allowed = weightedCount < this.maxRequests;

        if (allowed) {
            // Increment current window counter
            window.currentCount++;

            logger.debug('Request allowed', {
                clientId,
                currentCount: window.currentCount,
                weightedCount: weightedCount.toFixed(2),
                remaining: (this.maxRequests - weightedCount - 1).toFixed(2)
            });
        } else {
            logger.debug('Request rejected', {
                clientId,
                weightedCount: weightedCount.toFixed(2),
                limit: this.maxRequests
            });
        }

        // Calculate when the weighted count will drop below limit
        const nextWindowStart = currentWindowStart + this.windowMs;
        const resetTime = nextWindowStart;
        const resetIn = Math.ceil((resetTime - now) / 1000);

        // Calculate approximate remaining requests
        // This is an estimate based on current weighted count
        const remaining = Math.max(0, Math.floor(this.maxRequests - weightedCount - (allowed ? 1 : 0)));

        const result = {
            allowed,
            limit: this.maxRequests,
            remaining,
            resetTime: new Date(resetTime).toISOString(),
            resetIn,
            retryAfter: allowed ? 0 : resetIn,
            algorithm: 'SlidingWindowCounter',
            metadata: {
                currentWindowCount: window.currentCount,
                previousWindowCount: window.previousCount,
                weightedCount: parseFloat(weightedCount.toFixed(2)),
                windowStart: new Date(window.windowStart).toISOString(),
                timeInCurrentWindow: (now - currentWindowStart) + 'ms',
                overlapPercentage: ((this.windowMs - (now - currentWindowStart)) / this.windowMs * 100).toFixed(2) + '%'
            }
        };

        return result;
    }

    /**
     * Get current window state for a client
     * Useful for debugging and monitoring
     * 
     * @param {string} clientId - Client identifier
     * @returns {Object} Window state or null
     */
    getWindowState(clientId) {
        const window = this.windows.get(clientId);
        if (!window) return null;

        const now = Date.now();
        const weightedCount = this.calculateWeightedCount(window, now);
        const currentWindowStart = this.getCurrentWindowStart(now);
        const timeInCurrentWindow = now - currentWindowStart;

        return {
            currentCount: window.currentCount,
            previousCount: window.previousCount,
            weightedCount: parseFloat(weightedCount.toFixed(2)),
            remaining: Math.max(0, Math.floor(this.maxRequests - weightedCount)),
            fillPercentage: (weightedCount / this.maxRequests * 100).toFixed(2) + '%',
            windowStart: new Date(window.windowStart).toISOString(),
            timeInCurrentWindow: timeInCurrentWindow + 'ms',
            overlapPercentage: ((this.windowMs - timeInCurrentWindow) / this.windowMs * 100).toFixed(2) + '%',
            windowMs: this.windowMs
        };
    }

    /**
     * Start periodic cleanup of old windows
     * Prevents memory leaks by removing inactive clients
     */
    startCleanup() {
        // Cleanup interval: every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);

        // Don't prevent process exit
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    /**
     * Remove old windows from inactive clients
     * A window is removed if it's more than 2 windows old
     */
    cleanup() {
        const now = Date.now();
        const expirationTime = now - (this.windowMs * 2);
        let removedCount = 0;

        for (const [clientId, window] of this.windows.entries()) {
            if (window.windowStart < expirationTime) {
                this.windows.delete(clientId);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            logger.debug('Cleanup completed', {
                removedWindows: removedCount,
                remainingWindows: this.windows.size
            });
        }
    }

    /**
     * Get current statistics
     * @returns {Object} Current state statistics
     */
    getStats() {
        // Calculate average fill
        let totalWeighted = 0;
        const now = Date.now();

        for (const window of this.windows.values()) {
            totalWeighted += this.calculateWeightedCount(window, now);
        }

        const avgFill = this.windows.size > 0
            ? (totalWeighted / (this.windows.size * this.maxRequests) * 100).toFixed(2) + '%'
            : '0%';

        return {
            algorithm: 'SlidingWindowCounter',
            activeWindows: this.windows.size,
            windowMs: this.windowMs,
            maxRequests: this.maxRequests,
            config: {
                windowSeconds: this.windowMs / 1000,
                requestsPerSecond: this.maxRequests / (this.windowMs / 1000),
                memoryPerClient: '~24 bytes (2 counters + timestamp)',
                complexity: {
                    time: 'O(1) - Constant time calculation',
                    space: 'O(1) - Only 2 counters per client'
                },
                accuracy: '~95% (weighted approximation)'
            },
            currentState: {
                averageFill: avgFill,
                estimatedMemoryBytes: this.windows.size * 24,
                estimatedMemoryKB: (this.windows.size * 24 / 1024).toFixed(2)
            }
        };
    }

    /**
     * Reset all windows (useful for testing)
     */
    reset() {
        this.windows.clear();
        logger.info('All windows reset');
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

module.exports = SlidingWindowCounterRateLimiter;