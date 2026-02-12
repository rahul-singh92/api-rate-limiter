/**
 * Leaky Bucket Rate Limiting Algorithm
 * 
 * ALGORITHM DESCRIPTION:
 * The Leaky Bucket algorithm processes requests at a constant rate, 
 * regardless of how quickly they arrive. Requests that arrive when 
 * the bucket is full are rejected.
 * 
 * WATER BUCKET METAPHOR:
 * Imagine a bucket with a small hole at the bottom. Water (requests) 
 * pours in from the top at varying rates, but water leaks out from 
 * the bottom at a CONSTANT rate. If water arrives faster than it can 
 * leak out, the bucket fills up. When full, excess water overflows 
 * (requests are rejected).
 * 
 * HOW IT WORKS:
 * 1. Requests enter a queue (bucket)
 * 2. Requests are processed at a fixed rate (leak rate)
 * 3. If queue is full, new requests are rejected
 * 4. Bucket "leaks" (processes) requests continuously
 * 
 * KEY DIFFERENCE FROM TOKEN BUCKET:
 * 
 * TOKEN BUCKET:
 * - Tokens accumulate over time
 * - Allows bursts (use accumulated tokens)
 * - Consumer-focused: "Do I have tokens?"
 * 
 * LEAKY BUCKET:
 * - Requests queue up
 * - NO bursts (constant processing rate)
 * - Producer-focused: "Can I add to queue?"
 * 
 * MATHEMATICAL MODEL:
 * - Capacity (C): Maximum requests in bucket
 * - Leak Rate (R): Requests processed per second
 * - Current Size (S): Current requests in bucket
 * - Time Delta (Δt): Time since last leak
 * 
 * Leak Formula: S_new = max(0, S_old - R × Δt)
 * 
 * WHY LEAKY BUCKET vs TOKEN BUCKET?
 * 
 * LEAKY BUCKET:
 * + CONSTANT output rate (perfect for rate-sensitive systems)
 * + Network traffic shaping
 * + Prevents ANY bursts
 * + Predictable server load
 * - Rejects bursts (even legitimate ones)
 * - May have higher latency (queuing)
 * - More complex (queue management)
 * 
 * TOKEN BUCKET:
 * + Allows legitimate bursts
 * + Lower latency (no queuing)
 * + Better user experience
 * - Variable output rate
 * - Can cause server load spikes
 * 
 * WHY LEAKY BUCKET vs FIXED WINDOW?
 * 
 * LEAKY BUCKET:
 * + No boundary problem
 * + Constant rate output
 * + Smooth traffic
 * - More complex
 * - Queue management overhead
 * 
 * FIXED WINDOW:
 * + Simple implementation
 * + Low overhead
 * - Boundary problem
 * - Sudden resets
 * 
 * TIME COMPLEXITY: O(1) for each request
 * SPACE COMPLEXITY: O(n) where n = number of unique clients
 * 
 * ADVANTAGES:
 * + Guaranteed constant output rate
 * + Perfect for network traffic shaping
 * + Prevents server overload spikes
 * + Smoothest possible traffic pattern
 * + No boundary problem
 * + Predictable system behavior
 * 
 * DISADVANTAGES:
 * - Rejects legitimate bursts
 * - Higher latency (queuing delay)
 * - More complex implementation
 * - Queue management overhead
 * - May frustrate users (can't burst even with credit)
 * 
 * WHEN TO USE:
 * ✓ Network packet processing
 * ✓ Video streaming rate control
 * ✓ Systems requiring guaranteed constant rate
 * ✓ Critical infrastructure (must prevent ANY spike)
 * ✓ Bandwidth management
 * ✓ QoS (Quality of Service) systems
 * 
 * WHEN NOT TO USE:
 * ✗ User-facing APIs (poor UX)
 * ✗ Systems where bursts are legitimate
 * ✗ Low-latency requirements
 * ✗ Interactive applications
 * 
 * REAL-WORLD EXAMPLES:
 * - ATM networks: Constant cell transmission rate
 * - Video conferencing: Smooth frame delivery
 * - Network routers: Traffic shaping
 * - CDN bandwidth control
 * 
 * @module algorithms/LeakyBucket
 */

const logger = require('../utils/logger');

class LeakyBucketRateLimiter {
    /**
     * Create a Leaky Bucket Rate Limiter
     * 
     * @param {Object} options - Configuration options
     * @param {number} options.capacity - Maximum requests bucket can hold
     * @param {number} options.leakRate - Requests processed per second
     * @param {boolean} options.queueRequests - Whether to queue or reject immediately
     */
    constructor(options = {}) {
        // Capacity: Maximum number of requests that can be queued
        this.capacity = options.capacity || 100;

        // Leak rate: How many requests are processed per second
        this.leakRate = options.leakRate || 10;

        // Whether to queue requests or reject immediately
        this.queueRequests = options.queueRequests !== undefined
            ? options.queueRequests
            : false;

        // Storage for client buckets
        // Structure: Map<clientId, { size: number, lastLeak: timestamp }>
        this.buckets = new Map();

        // Start cleanup to prevent memory leaks
        this.startCleanup();

        logger.info('LeakyBucket rate limiter initialized', {
            capacity: this.capacity,
            leakRate: this.leakRate,
            queueRequests: this.queueRequests,
            mode: this.queueRequests ? 'queuing' : 'immediate-reject'
        });
    }

    /**
     * Leak (process) requests from the bucket
     * 
     * ALGORITHM:
     * 1. Calculate time elapsed since last leak
     * 2. Calculate requests to leak: elapsed_seconds × leak_rate
     * 3. Remove leaked requests from bucket
     * 4. Update last leak time
     * 
     * This simulates the "hole" in the bucket constantly draining
     * 
     * @param {Object} bucket - Client's bucket object
     * @returns {Object} Updated bucket
     */
    leakFromBucket(bucket) {
        const now = Date.now();
        const timeSinceLastLeak = now - bucket.lastLeak;
        const secondsElapsed = timeSinceLastLeak / 1000;

        // Calculate how many requests have "leaked" (been processed)
        const requestsToLeak = secondsElapsed * this.leakRate;

        // Remove leaked requests from bucket
        bucket.size = Math.max(0, bucket.size - requestsToLeak);

        // Update last leak time
        bucket.lastLeak = now;

        logger.debug('Bucket leaked', {
            secondsElapsed: secondsElapsed.toFixed(3),
            requestsLeaked: requestsToLeak.toFixed(2),
            currentSize: bucket.size.toFixed(2),
            capacity: this.capacity
        });

        return bucket;
    }

    /**
     * Check if a request should be allowed
     * 
     * ALGORITHM STEPS:
     * 1. Get or create client's bucket
     * 2. Leak requests based on time elapsed
     * 3. Check if bucket has space for new request
     * 4. If yes, add request to bucket and allow
     * 5. If no, reject request
     * 6. Return decision with metadata
     * 
     * @param {string} clientId - Unique identifier for client
     * @param {number} requestSize - Size of request (default: 1)
     * @returns {Object} Decision object with allowed status and metadata
     */
    async check(clientId, requestSize = 1) {
        const now = Date.now();

        // Get or create client bucket
        let bucket = this.buckets.get(clientId);

        if (!bucket) {
            // New client - start with empty bucket
            bucket = {
                size: 0,
                lastLeak: now
            };
            this.buckets.set(clientId, bucket);

            logger.debug('New bucket created', {
                clientId,
                initialSize: 0
            });
        }

        // Leak requests based on time elapsed
        bucket = this.leakFromBucket(bucket);

        // Check if there's space in the bucket
        const spaceAvailable = this.capacity - bucket.size;
        const allowed = spaceAvailable >= requestSize;

        if (allowed) {
            // Add request to bucket
            bucket.size += requestSize;

            logger.debug('Request allowed', {
                clientId,
                requestSize,
                bucketSize: bucket.size,
                spaceRemaining: this.capacity - bucket.size
            });
        } else {
            logger.debug('Request rejected', {
                clientId,
                requestSize,
                bucketSize: bucket.size,
                spaceAvailable,
                deficit: requestSize - spaceAvailable
            });
        }

        // Calculate when bucket will have space
        const spaceNeeded = allowed ? 0 : requestSize - spaceAvailable;
        const secondsUntilSpace = spaceNeeded / this.leakRate;
        const resetTime = now + (secondsUntilSpace * 1000);

        // Calculate current leak rate (for monitoring)
        const currentLeakRate = bucket.size > 0 ? this.leakRate : 0;

        const result = {
            allowed,
            limit: this.capacity,
            remaining: Math.floor(spaceAvailable),
            resetTime: new Date(resetTime).toISOString(),
            resetIn: Math.ceil(secondsUntilSpace),
            retryAfter: allowed ? 0 : Math.ceil(secondsUntilSpace),
            algorithm: 'LeakyBucket',
            metadata: {
                bucketSize: bucket.size,
                spaceAvailable,
                leakRate: this.leakRate,
                currentLeakRate,
                capacity: this.capacity,
                estimatedWaitTime: secondsUntilSpace
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

        // Leak to get current state
        this.leakFromBucket(bucket);

        const spaceAvailable = this.capacity - bucket.size;
        const fillPercentage = (bucket.size / this.capacity * 100).toFixed(2);

        return {
            size: bucket.size,
            capacity: this.capacity,
            spaceAvailable,
            fillPercentage: fillPercentage + '%',
            leakRate: this.leakRate,
            timeToEmpty: bucket.size > 0 ? (bucket.size / this.leakRate).toFixed(2) + 's' : '0s',
            lastLeak: new Date(bucket.lastLeak).toISOString()
        };
    }

    /**
     * Force leak all buckets (useful for testing)
     */
    forceLeakAll() {
        for (const [clientId, bucket] of this.buckets.entries()) {
            this.leakFromBucket(bucket);
        }
    }

    /**
     * Start periodic cleanup of empty buckets
     * Prevents memory leaks by removing inactive buckets
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
     * Remove buckets that are empty and haven't been used
     * A bucket is removed if it's empty and idle for 10 minutes
     */
    cleanup() {
        const now = Date.now();
        const maxIdleTime = 10 * 60 * 1000; // 10 minutes
        let removedCount = 0;

        for (const [clientId, bucket] of this.buckets.entries()) {
            // Leak first to get current size
            this.leakFromBucket(bucket);

            const idleTime = now - bucket.lastLeak;

            // Remove if empty and idle
            if (bucket.size === 0 && idleTime > maxIdleTime) {
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
        // Calculate total bucket fill
        let totalSize = 0;
        let totalCapacity = 0;

        for (const bucket of this.buckets.values()) {
            this.leakFromBucket(bucket);
            totalSize += bucket.size;
            totalCapacity += this.capacity;
        }

        const avgFill = this.buckets.size > 0
            ? (totalSize / totalCapacity * 100).toFixed(2) + '%'
            : '0%';

        return {
            algorithm: 'LeakyBucket',
            activeBuckets: this.buckets.size,
            capacity: this.capacity,
            leakRate: this.leakRate,
            queueRequests: this.queueRequests,
            config: {
                maxQueueSize: this.capacity,
                processingRate: this.leakRate + ' req/s',
                timeToEmptyFullBucket: (this.capacity / this.leakRate).toFixed(2) + 's',
                guaranteedMaxLatency: (this.capacity / this.leakRate).toFixed(2) + 's'
            },
            currentState: {
                averageFill: avgFill,
                totalQueuedRequests: totalSize.toFixed(2)
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

module.exports = LeakyBucketRateLimiter;
