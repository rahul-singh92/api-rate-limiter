/**
 * Sliding Window Log Rate Limiting Algorithm
 * 
 * ALGORITHM DESCRIPTION:
 * The Sliding Window Log algorithm maintains a log of timestamps for each request.
 * It counts requests within a rolling time window by filtering timestamps.
 * Unlike Fixed Window, this has NO boundary problem.
 * 
 * HOW IT WORKS:
 * 1. Store timestamp of every request
 * 2. When new request arrives, remove old timestamps outside the window
 * 3. Count remaining timestamps
 * 4. If count < limit, allow request and add timestamp
 * 5. If count >= limit, reject request
 * 
 * EXAMPLE WITH 5 req/minute LIMIT:
 * 
 * Time 00:00:30 - Request arrives
 * Log: [00:00:30]
 * Count: 1 < 5 ✓ ALLOW
 * 
 * Time 00:00:45 - Request arrives
 * Log: [00:00:30, 00:00:45]
 * Count: 2 < 5 ✓ ALLOW
 * 
 * Time 00:01:00 - Request arrives
 * Window: [00:00:00 - 00:01:00]
 * Remove timestamps before 00:00:00: none
 * Log: [00:00:30, 00:00:45, 00:01:00]
 * Count: 3 < 5 ✓ ALLOW
 * 
 * Time 00:01:25 - Request arrives
 * Window: [00:00:25 - 00:01:25]
 * Remove timestamps before 00:00:25: none
 * Log: [00:00:30, 00:00:45, 00:01:00, 00:01:25]
 * Count: 4 < 5 ✓ ALLOW
 * 
 * Time 00:01:35 - Request arrives
 * Window: [00:00:35 - 00:01:35]
 * Remove timestamps before 00:00:35: [00:00:30] removed
 * Log: [00:00:45, 00:01:00, 00:01:25, 00:01:35]
 * Count: 4 < 5 ✓ ALLOW
 * 
 * WHY SLIDING WINDOW LOG?
 * 
 * ADVANTAGES over other algorithms:
 * + NO boundary problem (most accurate)
 * + Perfect sliding window (not fixed chunks)
 * + Fair distribution of requests
 * + Precise rate limiting
 * 
 * DISADVANTAGES:
 * - High memory usage (stores ALL timestamps)
 * - O(n) time complexity (must scan timestamps)
 * - Not suitable for high-traffic APIs
 * 
 * COMPARISON WITH OTHER ALGORITHMS:
 * 
 * FIXED WINDOW:
 * Memory: O(1) per client
 * Time: O(1)
 * Accuracy: Poor (boundary problem)
 * 
 * TOKEN BUCKET:
 * Memory: O(1) per client
 * Time: O(1)
 * Accuracy: Good (allows bursts)
 * 
 * LEAKY BUCKET:
 * Memory: O(1) per client
 * Time: O(1)
 * Accuracy: Good (constant rate)
 * 
 * SLIDING WINDOW LOG:
 * Memory: O(m) per client (m = requests in window)
 * Time: O(m)
 * Accuracy: Excellent (perfect sliding window)
 * 
 * VISUAL COMPARISON - BOUNDARY ATTACK:
 * 
 * Fixed Window (vulnerable):
 * ┌─────────────────────────────────────┐
 * │ Minute 1: ████████████████████░░░░ │ 80 requests at 00:59
 * │ Reset → │ ← Boundary
 * │ Minute 2: ████████████████████░░░░ │ 80 requests at 01:01
 * └─────────────────────────────────────┘
 * Result: 160 requests in 2 seconds! ✗
 * 
 * Sliding Window Log (protected):
 * ┌─────────────────────────────────────┐
 * │ At 00:59: ████████████████████░░░░ │ 80 requests
 * │ At 01:01: ████░░░░░░░░░░░░░░░░░░░ │ Only 20 more allowed
 * │           (window = 00:01 to 01:01) │
 * │           (60 from 00:59 still count)│
 * └─────────────────────────────────────┘
 * Result: 100 requests max in any minute! ✓
 * 
 * TIME COMPLEXITY: O(n) where n = requests in window
 * SPACE COMPLEXITY: O(n × m) where n = clients, m = requests per client
 * 
 * WHEN TO USE:
 * ✓ Low to medium traffic APIs
 * ✓ When accuracy is critical
 * ✓ When preventing abuse is paramount
 * ✓ Financial APIs (billing, payments)
 * ✓ Security-critical endpoints
 * ✓ Admin APIs
 * 
 * WHEN NOT TO USE:
 * ✗ High-traffic APIs (memory intensive)
 * ✗ Systems with millions of users
 * ✗ When performance is critical
 * ✗ Limited memory environments
 * 
 * REAL-WORLD EXAMPLES:
 * - Stripe API: Uses sliding window for billing endpoints
 * - Auth0: Login attempt rate limiting
 * - Banking APIs: Transaction rate limiting
 * - Payment processors: Anti-fraud measures
 * 
 * @module algorithms/SlidingWindowLog
 */

const logger = require('../utils/logger');

class SlidingWindowLogRateLimiter {
  /**
   * Create a Sliding Window Log Rate Limiter
   * 
   * @param {Object} options - Configuration options
   * @param {number} options.windowMs - Time window in milliseconds
   * @param {number} options.maxRequests - Maximum requests per window
   */
  constructor(options = {}) {
    // Window size: How far back to look
    this.windowMs = options.windowMs || 60000; // Default: 1 minute
    
    // Max requests: How many requests allowed in window
    this.maxRequests = options.maxRequests || 100;
    
    // Storage for client request logs
    // Structure: Map<clientId, Array<timestamp>>
    this.requestLogs = new Map();
    
    // Start cleanup to prevent memory leaks
    this.startCleanup();
    
    logger.info('SlidingWindowLog rate limiter initialized', {
      windowMs: this.windowMs,
      windowSeconds: this.windowMs / 1000,
      maxRequests: this.maxRequests,
      algorithm: 'SlidingWindowLog'
    });
  }

  /**
   * Remove timestamps outside the current window
   * 
   * ALGORITHM:
   * 1. Calculate window start time (now - windowMs)
   * 2. Filter out timestamps before window start
   * 3. Return cleaned log
   * 
   * Example:
   * Now: 00:01:30
   * Window: 60 seconds
   * Window start: 00:00:30
   * 
   * Log before: [00:00:20, 00:00:40, 00:01:00, 00:01:20]
   * Log after:  [00:00:40, 00:01:00, 00:01:20]
   * 
   * @param {Array<number>} log - Array of timestamps
   * @param {number} now - Current timestamp
   * @returns {Array<number>} Cleaned log
   */
  cleanLog(log, now) {
    const windowStart = now - this.windowMs;
    
    // Filter out timestamps outside the window
    const cleanedLog = log.filter(timestamp => timestamp > windowStart);
    
    const removedCount = log.length - cleanedLog.length;
    
    if (removedCount > 0) {
      logger.debug('Log cleaned', {
        removedTimestamps: removedCount,
        remainingTimestamps: cleanedLog.length,
        windowStart: new Date(windowStart).toISOString()
      });
    }
    
    return cleanedLog;
  }

  /**
   * Check if a request should be allowed
   * 
   * ALGORITHM STEPS:
   * 1. Get current timestamp
   * 2. Get or create client's request log
   * 3. Clean log (remove old timestamps)
   * 4. Count remaining timestamps
   * 5. If count < max, allow and add timestamp
   * 6. If count >= max, reject
   * 7. Return decision with metadata
   * 
   * @param {string} clientId - Unique identifier for client
   * @returns {Object} Decision object with allowed status and metadata
   */
  async check(clientId) {
    const now = Date.now();
    
    // Get or create client's request log
    let log = this.requestLogs.get(clientId);
    
    if (!log) {
      // New client - start with empty log
      log = [];
      this.requestLogs.set(clientId, log);
      
      logger.debug('New request log created', {
        clientId,
        initialSize: 0
      });
    }
    
    // Clean the log (remove timestamps outside window)
    log = this.cleanLog(log, now);
    this.requestLogs.set(clientId, log);
    
    // Count requests in current window
    const requestCount = log.length;
    
    // Check if request should be allowed
    const allowed = requestCount < this.maxRequests;
    
    if (allowed) {
      // Add current timestamp to log
      log.push(now);
      
      logger.debug('Request allowed', {
        clientId,
        requestCount: requestCount + 1,
        maxRequests: this.maxRequests,
        remaining: this.maxRequests - requestCount - 1
      });
    } else {
      logger.debug('Request rejected', {
        clientId,
        requestCount,
        maxRequests: this.maxRequests,
        oldestTimestamp: new Date(log[0]).toISOString()
      });
    }
    
    // Calculate when the oldest request will expire
    const oldestTimestamp = log.length > 0 ? log[0] : now;
    const resetTime = oldestTimestamp + this.windowMs;
    const resetIn = Math.ceil((resetTime - now) / 1000);
    
    // Calculate requests in different time segments (for visualization)
    const halfWindow = this.windowMs / 2;
    const recentHalf = log.filter(t => t > now - halfWindow).length;
    const olderHalf = log.length - recentHalf;
    
    const result = {
      allowed,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - (allowed ? log.length : requestCount)),
      resetTime: new Date(resetTime).toISOString(),
      resetIn,
      retryAfter: allowed ? 0 : resetIn,
      algorithm: 'SlidingWindowLog',
      metadata: {
        requestsInWindow: allowed ? log.length : requestCount,
        windowMs: this.windowMs,
        windowStart: new Date(now - this.windowMs).toISOString(),
        oldestRequest: log.length > 0 ? new Date(log[0]).toISOString() : null,
        newestRequest: log.length > 0 ? new Date(log[log.length - 1]).toISOString() : null,
        distribution: {
          recentHalf,
          olderHalf
        }
      }
    };
    
    return result;
  }

  /**
   * Get current log state for a client
   * Useful for debugging and monitoring
   * 
   * @param {string} clientId - Client identifier
   * @returns {Object} Log state or null
   */
  getLogState(clientId) {
    const log = this.requestLogs.get(clientId);
    if (!log) return null;
    
    const now = Date.now();
    const cleanedLog = this.cleanLog(log, now);
    
    // Calculate request distribution
    const intervals = 10;
    const intervalSize = this.windowMs / intervals;
    const distribution = new Array(intervals).fill(0);
    
    cleanedLog.forEach(timestamp => {
      const age = now - timestamp;
      const intervalIndex = Math.floor(age / intervalSize);
      if (intervalIndex < intervals) {
        distribution[intervals - 1 - intervalIndex]++;
      }
    });
    
    return {
      totalRequests: cleanedLog.length,
      maxRequests: this.maxRequests,
      remaining: this.maxRequests - cleanedLog.length,
      fillPercentage: (cleanedLog.length / this.maxRequests * 100).toFixed(2) + '%',
      windowMs: this.windowMs,
      oldestRequest: cleanedLog.length > 0 ? new Date(cleanedLog[0]).toISOString() : null,
      newestRequest: cleanedLog.length > 0 ? new Date(cleanedLog[cleanedLog.length - 1]).toISOString() : null,
      distribution,
      timestamps: cleanedLog.map(t => new Date(t).toISOString())
    };
  }

  /**
   * Start periodic cleanup of empty logs
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
   * Remove empty logs and logs with only old timestamps
   * A log is removed if it's empty after cleaning
   */
  cleanup() {
    const now = Date.now();
    let removedCount = 0;
    let cleanedCount = 0;
    
    for (const [clientId, log] of this.requestLogs.entries()) {
      // Clean the log
      const cleanedLog = this.cleanLog(log, now);
      cleanedCount++;
      
      if (cleanedLog.length === 0) {
        // Log is empty, remove it
        this.requestLogs.delete(clientId);
        removedCount++;
      } else {
        // Update with cleaned log
        this.requestLogs.set(clientId, cleanedLog);
      }
    }
    
    if (removedCount > 0 || cleanedCount > 0) {
      logger.debug('Cleanup completed', {
        logsRemoved: removedCount,
        logsCleaned: cleanedCount,
        remainingLogs: this.requestLogs.size
      });
    }
  }

  /**
   * Get current statistics
   * @returns {Object} Current state statistics
   */
  getStats() {
    // Calculate total timestamps stored
    let totalTimestamps = 0;
    let maxLogSize = 0;
    let totalMemory = 0;
    
    for (const log of this.requestLogs.values()) {
      totalTimestamps += log.length;
      maxLogSize = Math.max(maxLogSize, log.length);
      // Approximate memory: 8 bytes per timestamp (number in JS)
      totalMemory += log.length * 8;
    }
    
    const avgLogSize = this.requestLogs.size > 0 
      ? (totalTimestamps / this.requestLogs.size).toFixed(2)
      : 0;
    
    return {
      algorithm: 'SlidingWindowLog',
      activeLogs: this.requestLogs.size,
      totalTimestamps,
      maxLogSize,
      avgLogSize,
      estimatedMemoryBytes: totalMemory,
      estimatedMemoryKB: (totalMemory / 1024).toFixed(2),
      windowMs: this.windowMs,
      maxRequests: this.maxRequests,
      config: {
        windowSeconds: this.windowMs / 1000,
        requestsPerSecond: this.maxRequests / (this.windowMs / 1000),
        memoryPerClient: `~${this.maxRequests * 8} bytes (worst case)`,
        complexity: {
          time: 'O(n) where n = requests in window',
          space: 'O(n) where n = requests in window'
        }
      }
    };
  }

  /**
   * Reset all logs (useful for testing)
   */
  reset() {
    this.requestLogs.clear();
    logger.info('All request logs reset');
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

module.exports = SlidingWindowLogRateLimiter;
