/**
 * Token Bucket Rate Limiting Algorithm
 * 
 * ALGORITHM DESCRIPTION:
 * The Token Bucket algorithm maintains a bucket of tokens that refills
 * at a constant rate. Each request consumes one or more tokens. When the
 * bucket is empty, requests are rejected.
 * 
 * METAPHOR:
 * Imagine a bucket that can hold N tokens (capacity). Tokens are added
 * to the bucket at a fixed rate (refill rate). Each API request takes
 * one token from the bucket. If the bucket is empty, the request is denied.
 * 
 * HOW IT WORKS:
 * 1. Initialize bucket with full capacity of tokens
 * 2. Every X milliseconds, add tokens to bucket (up to capacity)
 * 3. When request arrives, check if bucket has enough tokens
 * 4. If yes, remove tokens and allow request
 * 5. If no, reject request
 * 
 * WHY TOKEN BUCKET vs FIXED WINDOW?
 * 
 * TOKEN BUCKET:
 * + Allows controlled bursts (accumulated tokens)
 * + Smoother traffic distribution
 * + No boundary problem
 * + More flexible for real-world usage
 * 
 * FIXED WINDOW:
 * + Simpler to implement
 * + Less memory per client
 * - Hard boundaries cause issues
 * - Burst traffic at resets
 * 
 * MATHEMATICAL MODEL:
 * - Capacity (C): Maximum tokens in bucket
 * - Refill Rate (R): Tokens added per second
 * - Current Tokens (T): Available tokens
 * - Time Delta (Δt): Time since last refill
 * 
 * Refill Formula: T = min(C, T + R × Δt)
 * 
 * TIME COMPLEXITY: O(1) for each request
 * SPACE COMPLEXITY: O(n) where n = number of unique clients
 * 
 * ADVANTAGES:
 * + Allows traffic bursts (good for real-world patterns)
 * + Smooth rate limiting (no sudden resets)
 * + No boundary problem
 * + Self-regulating (tokens accumulate during idle periods)
 * + Predictable long-term rate
 * 
 * DISADVANTAGES:
 * - Slightly more complex than Fixed Window
 * - Needs to track last refill time
 * - Can allow initial burst if bucket starts full
 * 
 * WHEN TO USE:
 * ✓ Public-facing APIs
 * ✓ APIs with bursty legitimate traffic
 * ✓ When user experience matters (smoothness)
 * ✓ Production systems
 * ✓ When you want to allow occasional bursts
 * 
 * WHEN NOT TO USE:
 * ✗ When you need absolutely constant rate (use Leaky Bucket)
 * ✗ When simplicity is paramount (use Fixed Window)
 * ✗ When bursts are never acceptable
 * 
 * REAL-WORLD EXAMPLES:
 * - Stripe API: Uses token bucket for rate limiting
 * - AWS API Gateway: Token bucket algorithm
 * - Google Cloud APIs: Token bucket with per-method quotas
 * 
 * @module algorithms/TokenBucket
 */

const logger = require('../utils/logger');

class TokenBucketRateLimiter {
    /**
     * Create a Token Bucket Rate Limiter
     * 
     * @param {Object} options - Configuration options
     * @param {number} options.capacity - Maximum tokens in bucket (burst size)
     * @param {number} options.refillRate - Tokens added per second
     * @param {number} options.tokensPerRequest - Tokens consumed per request (default: 1)
     */
    constructor(options = {}) {
        // Capacity: Maximum number of tokens the bucket can hold
        this.capacity = options.capacity || 100;

        // Refill rate: How many tokens are added per second
        this.refillRate = options.refillRate || 10;

        // Tokens per request: How many tokens each request consumes
        this.tokensPerRequest = options.tokensPerRequest || 1;

        // Storage for client buckets
        // Structure: Map<clientId, { tokens: number, lastRefill: timestamp }>
        this.buckets = new Map();

        // Start cleanup to prevent memory leaks
        this.startCleanup();

        logger.info('TokenBucket rate limiter initialized', {
            capacity: this.capacity,
            refillRate: this.refillRate,
            tokensPerRequest: this.tokensPerRequest,
            burstCapacity: this.capacity,
            sustainedRate: this.refillRate + ' req/s'
        });
    }

    /**
     * Refill tokens for a client bucket
     * 
     * ALGORITHM:
     * 1. Calculate time elapsed since last refill
     * 2. Calculate tokens to add: elapsed_seconds × refill_rate
     * 3. Add tokens but don't exceed capacity
     * 4. Update last refill time
     * 
     * @param {Object} bucket - Client's bucket object
     * @returns {Object} Updated bucket
     */
    refillBucket(bucket) {
        const now = Date.now();
        const timeSinceLastRefill = now - bucket.lastRefill;
        const secondsElapsed = timeSinceLastRefill / 1000;

        // Calculate tokens to add
        const tokensToAdd = secondsElapsed * this.refillRate;

        // Add tokens but don't exceed capacity
        bucket.tokens = Math.min(
            this.capacity,
            bucket.tokens + tokensToAdd
        );

        // Update last refill time
        bucket.lastRefill = now;

        logger.debug('Bucket refilled', {
            secondsElapsed: secondsElapsed.toFixed(3),
            tokensAdded: tokensToAdd.toFixed(2),
            currentTokens: bucket.tokens.toFixed(2),
            capacity: this.capacity
        });

        return bucket;
    }

    /**
     * Check if a request should be allowed
     * 
     * ALGORITHM STEPS:
     * 1. Get or create client's bucket
     * 2. Refill bucket based on time elapsed
     * 3. Check if enough tokens available
     * 4. If yes, consume tokens and allow
     * 5. If no, reject request
     * 6. Return decision with metadata
     * 
     * @param {string} clientId - Unique identifier for client
     * @param {number} tokensRequired - Tokens needed (default: tokensPerRequest)
     * @returns {Object} Decision object with allowed status and metadata
     */
    async check(clientId, tokensRequired = this.tokensPerRequest) {
        const now = Date.now();

        // Get or create client bucket
        let bucket = this.buckets.get(clientId);

        if (!bucket) {
            // New client - start with full bucket
            bucket = {
                tokens: this.capacity,
                lastRefill: now
            };
            this.buckets.set(clientId, bucket);

            logger.debug('New bucket created', {
                clientId,
                initialTokens: this.capacity
            });
        }

        // Refill bucket based on time elapsed
        bucket = this.refillBucket(bucket);

        // Check if enough tokens available
        const allowed = bucket.tokens >= tokensRequired;

        if (allowed) {
            // Consume tokens
            bucket.tokens -= tokensRequired;

            logger.debug('Request allowed', {
                clientId,
                tokensConsumed: tokensRequired,
                tokensRemaining: bucket.tokens.toFixed(2)
            });
        } else {
            logger.debug('Request rejected', {
                clientId,
                tokensRequired,
                tokensAvailable: bucket.tokens.toFixed(2)
            });
        }

        // Calculate when bucket will have enough tokens
        const tokensNeeded = allowed ? 0 : tokensRequired - bucket.tokens;
        const secondsUntilReady = tokensNeeded / this.refillRate;
        const resetTime = now + (secondsUntilReady * 1000);

        const result = {
            allowed,
            limit: this.capacity,
            remaining: Math.floor(bucket.tokens),
            resetTime: new Date(resetTime).toISOString(),
            resetIn: Math.ceil(secondsUntilReady),
            retryAfter: allowed ? 0 : Math.ceil(secondsUntilReady),
            algorithm: 'TokenBucket',
            metadata: {
                tokensConsumed: allowed ? tokensRequired : 0,
                tokensRemaining: bucket.tokens,
                refillRate: this.refillRate,
                capacity: this.capacity
            }
        };

        return result;
    }

    /**
     * Get current bucket state for a client
     * Useful for debugging and monitoring
     * 
     * @param {string} clientId - Client identifier
     * @returns {Object} Bucket state or null
     */
    getBucketState(clientId) {
        const bucket = this.buckets.get(clientId);
        if (!bucket) return null;

        // Refill to get current state
        this.refillBucket(bucket);

        return {
            tokens: bucket.tokens,
            capacity: this.capacity,
            fillPercentage: (bucket.tokens / this.capacity * 100).toFixed(2) + '%',
            lastRefill: new Date(bucket.lastRefill).toISOString()
        };
    }

    /**
     * Start periodic cleanup of idle buckets
     * Prevents memory leaks by removing buckets that haven't been used
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
     * Remove buckets that have been idle for too long
     * A bucket is considered idle if it hasn't been accessed in 10 minutes
     */
    cleanup() {
        const now = Date.now();
        const maxIdleTime = 10 * 60 * 1000; // 10 minutes
        let removedCount = 0;

        for (const [clientId, bucket] of this.buckets.entries()) {
            const idleTime = now - bucket.lastRefill;

            if (idleTime > maxIdleTime) {
                this.buckets.delete(clientId);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            logger.debug('Cleanup completed', {
                removedBuckets: removedCount,
                remainingBuckets: this.buckets.size
            });
        }
    }

    /**
     * Get current statistics
     * @returns {Object} Current state statistics
     */
    getStats() {
        return {
            algorithm: 'TokenBucket',
            activeBuckets: this.buckets.size,
            capacity: this.capacity,
            refillRate: this.refillRate,
            tokensPerRequest: this.tokensPerRequest,
            config: {
                maxBurstSize: this.capacity,
                sustainedRatePerSecond: this.refillRate,
                timeToFullRefill: (this.capacity / this.refillRate).toFixed(2) + 's'
            }
        };
    }

    /**
     * Reset all buckets (useful for testing)
     */
    reset() {
        this.buckets.clear();
        logger.info('All buckets reset');
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

module.exports = TokenBucketRateLimiter;
