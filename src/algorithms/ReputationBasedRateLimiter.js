/**
 * Reputation-Based Rate Limiting Algorithm
 * 
 * ALGORITHM DESCRIPTION:
 * This is an INTELLIGENT, ADAPTIVE rate limiting algorithm that adjusts
 * limits based on user behavior. Good users get more freedom, bad actors
 * get automatically throttled.
 * 
 * CORE CONCEPT - REPUTATION SCORE:
 * 
 * Score = Successful Requests / Total Requests
 * 
 * Score Range: 0.0 (worst) to 1.0 (perfect)
 * 
 * Example Calculations:
 * - 100 success, 0 failures = 100/100 = 1.0 (perfect)
 * - 90 success, 10 failures = 90/100 = 0.9 (good)
 * - 50 success, 50 failures = 50/100 = 0.5 (suspicious)
 * - 10 success, 90 failures = 10/100 = 0.1 (bad actor)
 * 
 * REPUTATION TIERS:
 * 
 * ┌─────────────┬───────────┬──────────┬─────────────────────┐
 * │ Tier        │ Score     │ Capacity │ Refill Rate         │
 * ├─────────────┼───────────┼──────────┼─────────────────────┤
 * │ Excellent   │ 0.95-1.0  │ 200      │ 20 tokens/s         │
 * │ Good        │ 0.80-0.94 │ 150      │ 15 tokens/s         │
 * │ Fair        │ 0.60-0.79 │ 100      │ 10 tokens/s         │
 * │ Poor        │ 0.40-0.59 │ 50       │ 5 tokens/s          │
 * │ Bad         │ 0.20-0.39 │ 20       │ 2 tokens/s          │
 * │ Malicious   │ 0.0-0.19  │ 5        │ 0.5 tokens/s        │
 * └─────────────┴───────────┴──────────┴─────────────────────┘
 * 
 * BEHAVIOR TRACKING:
 * 
 * SUCCESS indicators (increase reputation):
 * ✓ 2xx status codes (successful requests)
 * ✓ Staying within rate limits
 * ✓ Valid requests
 * ✓ Proper authentication
 * 
 * FAILURE indicators (decrease reputation):
 * ✗ 4xx errors (bad requests, unauthorized)
 * ✗ 5xx errors (server errors, often from abuse)
 * ✗ Rate limit violations
 * ✗ Invalid/malformed requests
 * ✗ Suspected bot behavior
 * 
 * VISUAL EXAMPLE - USER JOURNEY:
 * 
 * New User (Unknown):
 * Score: 1.0 (benefit of doubt)
 * Tier: Good (100 tokens, 10/s refill)
 * ┌────────────────────────────────────┐
 * │ Bucket: [●●●●●●●●●●] 100 tokens   │
 * └────────────────────────────────────┘
 * 
 * After 100 Successful Requests:
 * Score: 1.0 (100/100)
 * Tier: Excellent (200 tokens, 20/s refill) ⬆️
 * ┌────────────────────────────────────┐
 * │ Bucket: [●●●●●●●●●●] 200 tokens   │
 * │ 🎉 Promoted to Excellent!          │
 * └────────────────────────────────────┘
 * 
 * Bot Detected (50 success, 50 failures):
 * Score: 0.5 (50/100)
 * Tier: Poor (50 tokens, 5/s refill) ⬇️
 * ┌────────────────────────────────────┐
 * │ Bucket: [●●●●●] 50 tokens          │
 * │ ⚠️  Degraded to Poor               │
 * └────────────────────────────────────┘
 * 
 * Malicious Actor (10 success, 90 failures):
 * Score: 0.1 (10/100)
 * Tier: Malicious (5 tokens, 0.5/s refill) ⬇️⬇️⬇️
 * ┌────────────────────────────────────┐
 * │ Bucket: [●] 5 tokens               │
 * │ 🚫 Severely throttled!             │
 * └────────────────────────────────────┘
 * 
 * ADAPTIVE ALGORITHM:
 * 
 * 1. Track every request outcome (success/failure)
 * 2. Calculate reputation score periodically
 * 3. Adjust rate limit tier based on score
 * 4. Apply exponential decay to old behavior
 * 5. React quickly to sudden changes
 * 
 * EXPONENTIAL DECAY:
 * Recent behavior weighs more than old behavior
 * 
 * Score = (α × recent_score) + ((1-α) × historical_score)
 * Where α = 0.7 (70% weight to recent behavior)
 * 
 * Example:
 * Historical: 0.9 (good)
 * Recent: 0.3 (suddenly bad)
 * New score: (0.7 × 0.3) + (0.3 × 0.9) = 0.21 + 0.27 = 0.48
 * Result: Quickly downgraded to Poor tier
 * 
 * ADVANTAGES:
 * + Self-healing: Good users auto-promoted
 * + Auto-defense: Bad actors auto-throttled
 * + No manual intervention needed
 * + Rewards good behavior
 * + Punishes abuse dynamically
 * + Adapts to changing patterns
 * + Fair to legitimate users
 * 
 * DISADVANTAGES:
 * - Complex to implement
 * - Requires tracking history
 * - More memory usage
 * - Can be gamed if not careful
 * - Need to tune thresholds
 * 
 * REAL-WORLD USE CASES:
 * 
 * 1. CloudFlare:
 *    - Bot scoring and adaptive rate limiting
 *    - Reputation-based challenges
 * 
 * 2. AWS WAF:
 *    - Rate-based rules with reputation
 *    - Automatic IP reputation tracking
 * 
 * 3. Akamai:
 *    - Behavioral analysis and scoring
 *    - Adaptive rate limiting
 * 
 * 4. Google reCAPTCHA v3:
 *    - Reputation score (0.0 to 1.0)
 *    - Adaptive challenges
 * 
 * 5. Reddit:
 *    - Karma-based rate limiting
 *    - New accounts have stricter limits
 * 
 * WHEN TO USE:
 * ✓ APIs under active attack
 * ✓ High bot traffic
 * ✓ Need to differentiate good/bad users
 * ✓ Want self-healing system
 * ✓ Reduce false positives
 * ✓ Protect against scrapers
 * 
 * WHEN NOT TO USE:
 * ✗ All users should be treated equally
 * ✗ Very predictable traffic
 * ✗ Simple internal APIs
 * ✗ Cannot tolerate complexity
 * 
 * @module algorithms/ReputationBasedRateLimiter
 */

const logger = require('../utils/logger');

// Reputation tier configurations
const REPUTATION_TIERS = {
  EXCELLENT: {
    name: 'Excellent',
    minScore: 0.95,
    maxScore: 1.0,
    capacity: 200,
    refillRate: 20,
    color: '🟢',
    description: 'Trusted user with perfect behavior'
  },
  GOOD: {
    name: 'Good',
    minScore: 0.80,
    maxScore: 0.94,
    capacity: 150,
    refillRate: 15,
    color: '🔵',
    description: 'Reliable user with good behavior'
  },
  FAIR: {
    name: 'Fair',
    minScore: 0.60,
    maxScore: 0.79,
    capacity: 100,
    refillRate: 10,
    color: '🟡',
    description: 'Average user, some issues'
  },
  POOR: {
    name: 'Poor',
    minScore: 0.40,
    maxScore: 0.59,
    capacity: 50,
    refillRate: 5,
    color: '🟠',
    description: 'Suspicious activity detected'
  },
  BAD: {
    name: 'Bad',
    minScore: 0.20,
    maxScore: 0.39,
    capacity: 20,
    refillRate: 2,
    color: '🔴',
    description: 'Frequent violations, likely bot'
  },
  MALICIOUS: {
    name: 'Malicious',
    minScore: 0.0,
    maxScore: 0.19,
    capacity: 5,
    refillRate: 0.5,
    color: '⛔',
    description: 'Severe abuse detected'
  }
};

class ReputationBasedRateLimiter {
  /**
   * Create a Reputation-Based Rate Limiter
   * 
   * @param {Object} options - Configuration options
   * @param {number} options.windowSize - History window size (default: 100)
   * @param {number} options.decayFactor - Weight for recent behavior (default: 0.7)
   * @param {number} options.minRequests - Minimum requests before scoring (default: 10)
   */
  constructor(options = {}) {
    // Configuration
    this.windowSize = options.windowSize || 100; // Track last 100 requests
    this.decayFactor = options.decayFactor || 0.7; // 70% weight to recent
    this.minRequests = options.minRequests || 10; // Need 10 requests to score
    
    // Storage
    // Structure: Map<clientId, {
    //   tokens, lastRefill, tier, capacity, refillRate,
    //   successCount, failureCount, totalRequests,
    //   reputationScore, history: [outcomes]
    // }>
    this.clients = new Map();
    
    // Tiers
    this.tiers = REPUTATION_TIERS;
    
    // Start refill
    this.startRefill();
    
    logger.info('ReputationBased rate limiter initialized', {
      algorithm: 'ReputationBased',
      windowSize: this.windowSize,
      decayFactor: this.decayFactor,
      tiers: Object.keys(this.tiers)
    });
  }

  /**
   * Get tier based on reputation score
   * 
   * @param {number} score - Reputation score (0.0 to 1.0)
   * @returns {Object} Tier configuration
   */
  getTierByScore(score) {
    // Find matching tier
    for (const [key, tier] of Object.entries(this.tiers)) {
      if (score >= tier.minScore && score <= tier.maxScore) {
        return { key, ...tier };
      }
    }
    
    // Default to FAIR if somehow no match
    return { key: 'FAIR', ...this.tiers.FAIR };
  }

  /**
   * Calculate reputation score
   * 
   * Formula: score = successCount / totalRequests
   * With exponential decay for recency
   * 
   * @param {Object} client - Client data
   * @returns {number} Reputation score (0.0 to 1.0)
   */
  calculateReputationScore(client) {
    if (client.totalRequests < this.minRequests) {
      // New users get benefit of doubt (0.8 = Good tier)
      return 0.8;
    }
    
    // Calculate raw score
    const rawScore = client.successCount / client.totalRequests;
    
    // Apply exponential decay to recent history
    if (client.history && client.history.length > 0) {
      const recentCount = Math.min(20, client.history.length);
      const recentHistory = client.history.slice(-recentCount);
      
      const recentSuccess = recentHistory.filter(h => h === true).length;
      const recentScore = recentSuccess / recentHistory.length;
      
      // Weighted average: 70% recent, 30% historical
      return (this.decayFactor * recentScore) + ((1 - this.decayFactor) * rawScore);
    }
    
    return rawScore;
  }

  /**
   * Update reputation based on request outcome
   * 
   * @param {Object} client - Client data
   * @param {boolean} success - Was request successful?
   */
  updateReputation(client, success) {
    // Update counts
    client.totalRequests++;
    
    if (success) {
      client.successCount++;
    } else {
      client.failureCount++;
    }
    
    // Add to history (keep only last windowSize)
    if (!client.history) {
      client.history = [];
    }
    
    client.history.push(success);
    
    if (client.history.length > this.windowSize) {
      client.history.shift(); // Remove oldest
    }
    
    // Recalculate score
    const oldScore = client.reputationScore;
    const newScore = this.calculateReputationScore(client);
    client.reputationScore = newScore;
    
    // Check if tier changed
    const oldTier = client.tier;
    const newTier = this.getTierByScore(newScore);
    
    if (oldTier !== newTier.name) {
      // Tier changed - update capacity and refill rate
      client.tier = newTier.name;
      client.capacity = newTier.capacity;
      client.refillRate = newTier.refillRate;
      
      // Adjust current tokens proportionally
      const ratio = newTier.capacity / (this.tiers[oldTier]?.capacity || 100);
      client.tokens = Math.min(client.tokens * ratio, newTier.capacity);
      
      logger.info('Reputation tier changed', {
        oldTier,
        newTier: newTier.name,
        oldScore: oldScore.toFixed(3),
        newScore: newScore.toFixed(3),
        successRate: `${(newScore * 100).toFixed(1)}%`
      });
    }
  }

  /**
   * Initialize or get client
   * 
   * @param {string} clientId - Client identifier
   * @returns {Object} Client data
   */
  getClient(clientId) {
    let client = this.clients.get(clientId);
    
    if (!client) {
      // New client - start with GOOD tier (benefit of doubt)
      const initialTier = this.tiers.GOOD;
      
      client = {
        tokens: initialTier.capacity,
        lastRefill: Date.now(),
        tier: initialTier.name,
        capacity: initialTier.capacity,
        refillRate: initialTier.refillRate,
        successCount: 0,
        failureCount: 0,
        totalRequests: 0,
        reputationScore: 0.8, // Start with good reputation
        history: []
      };
      
      this.clients.set(clientId, client);
      
      logger.debug('New client initialized', {
        clientId,
        tier: client.tier,
        initialScore: client.reputationScore
      });
    }
    
    return client;
  }

  /**
   * Refill tokens based on time elapsed
   * 
   * @param {Object} client - Client data
   */
  refillTokens(client) {
    const now = Date.now();
    const timeSinceLastRefill = now - client.lastRefill;
    const secondsElapsed = timeSinceLastRefill / 1000;
    
    const tokensToAdd = secondsElapsed * client.refillRate;
    
    if (tokensToAdd > 0) {
      client.tokens = Math.min(
        client.tokens + tokensToAdd,
        client.capacity
      );
      
      client.lastRefill = now;
    }
  }

  /**
   * Check if request should be allowed
   * 
   * @param {string} clientId - Client identifier
   * @param {number} tokensRequired - Tokens needed (default: 1)
   * @returns {Object} Decision object
   */
  async check(clientId, tokensRequired = 1) {
    const client = this.getClient(clientId);
    
    // Refill tokens
    this.refillTokens(client);
    
    // Check if enough tokens
    const allowed = client.tokens >= tokensRequired;
    
    if (allowed) {
      // Consume tokens
      client.tokens -= tokensRequired;
      
      // This is a successful request (for now)
      // Actual success/failure will be reported separately
      
      logger.debug('Request allowed', {
        clientId,
        tier: client.tier,
        score: client.reputationScore.toFixed(3),
        tokensRemaining: client.tokens.toFixed(2)
      });
    } else {
      // Request denied - this counts as failure
      this.updateReputation(client, false);
      
      logger.debug('Request rejected', {
        clientId,
        tier: client.tier,
        score: client.reputationScore.toFixed(3),
        tokensAvailable: client.tokens.toFixed(2)
      });
    }
    
    // Get current tier info
    const tierInfo = this.getTierByScore(client.reputationScore);
    
    // Calculate retry time
    const tokensNeeded = tokensRequired - client.tokens;
    const secondsUntilAvailable = tokensNeeded > 0
      ? Math.ceil(tokensNeeded / client.refillRate)
      : 0;
    
    const result = {
      allowed,
      limit: client.capacity,
      remaining: Math.floor(client.tokens),
      resetIn: secondsUntilAvailable,
      retryAfter: allowed ? 0 : secondsUntilAvailable,
      algorithm: 'ReputationBased',
      reputation: {
        score: parseFloat(client.reputationScore.toFixed(3)),
        tier: client.tier,
        tierIcon: tierInfo.color,
        successRate: `${(client.reputationScore * 100).toFixed(1)}%`,
        totalRequests: client.totalRequests,
        successCount: client.successCount,
        failureCount: client.failureCount
      },
      metadata: {
        tokensAvailable: parseFloat(client.tokens.toFixed(2)),
        capacity: client.capacity,
        refillRate: client.refillRate + ' tokens/s',
        tierRange: `${tierInfo.minScore} - ${tierInfo.maxScore}`,
        tierDescription: tierInfo.description
      }
    };
    
    return result;
  }

  /**
   * Report request outcome (success or failure)
   * This is called AFTER the request completes
   * 
   * @param {string} clientId - Client identifier
   * @param {boolean} success - Was request successful?
   * @param {number} statusCode - HTTP status code (optional)
   */
  async reportOutcome(clientId, success, statusCode = null) {
    const client = this.clients.get(clientId);
    
    if (!client) {
      logger.warn('Outcome reported for unknown client', { clientId });
      return;
    }
    
    // Determine success based on status code if provided
    if (statusCode !== null) {
      // 2xx = success, 4xx/5xx = failure
      success = statusCode >= 200 && statusCode < 300;
    }
    
    // Update reputation
    this.updateReputation(client, success);
    
    logger.debug('Outcome reported', {
      clientId,
      success,
      statusCode,
      newScore: client.reputationScore.toFixed(3),
      tier: client.tier
    });
  }

  /**
   * Get client state
   * 
   * @param {string} clientId - Client identifier
   * @returns {Object|null} Client state
   */
  getClientState(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return null;
    
    this.refillTokens(client);
    
    const tierInfo = this.getTierByScore(client.reputationScore);
    
    return {
      tier: client.tier,
      tierIcon: tierInfo.color,
      reputationScore: parseFloat(client.reputationScore.toFixed(3)),
      successRate: `${(client.reputationScore * 100).toFixed(1)}%`,
      tokens: parseFloat(client.tokens.toFixed(2)),
      capacity: client.capacity,
      refillRate: client.refillRate + ' tokens/s',
      statistics: {
        totalRequests: client.totalRequests,
        successCount: client.successCount,
        failureCount: client.failureCount,
        recentHistory: client.history.slice(-10).map(h => h ? '✓' : '✗').join(' ')
      }
    };
  }

  /**
   * Start periodic refill
   */
  startRefill() {
    this.refillInterval = setInterval(() => {
      for (const client of this.clients.values()) {
        this.refillTokens(client);
      }
    }, 100);
    
    if (this.refillInterval.unref) {
      this.refillInterval.unref();
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    // Group clients by tier
    const tierStats = {};
    
    for (const [clientId, client] of this.clients.entries()) {
      if (!tierStats[client.tier]) {
        tierStats[client.tier] = {
          count: 0,
          avgScore: 0,
          totalScore: 0,
          config: {
            capacity: client.capacity,
            refillRate: client.refillRate
          }
        };
      }
      
      tierStats[client.tier].count++;
      tierStats[client.tier].totalScore += client.reputationScore;
    }
    
    // Calculate averages
    for (const tier in tierStats) {
      tierStats[tier].avgScore = 
        (tierStats[tier].totalScore / tierStats[tier].count).toFixed(3);
    }
    
    return {
      algorithm: 'ReputationBased',
      activeClients: this.clients.size,
      tiers: tierStats,
      tierConfigurations: this.tiers,
      config: {
        windowSize: this.windowSize,
        decayFactor: this.decayFactor,
        minRequests: this.minRequests
      }
    };
  }

  /**
   * Reset all clients
   */
  reset() {
    this.clients.clear();
    logger.info('All clients reset');
  }

  /**
   * Stop refill interval
   */
  stop() {
    if (this.refillInterval) {
      clearInterval(this.refillInterval);
    }
  }
}

module.exports = ReputationBasedRateLimiter;