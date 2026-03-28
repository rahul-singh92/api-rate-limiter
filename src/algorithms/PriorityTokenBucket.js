/**
 * Priority Token Bucket Rate Limiting Algorithm
 * 
 * ALGORITHM DESCRIPTION:
 * This is an ADVANCED rate limiting algorithm that combines Token Bucket
 * with priority-based resource allocation. Different users get different
 * capacities and refill rates based on their priority tier.
 * 
 * INSPIRATION - Network Scheduling Algorithms:
 * 
 * 1. WEIGHTED FAIR QUEUING (WFQ):
 *    - Network scheduling algorithm
 *    - Each flow gets a weight determining bandwidth share
 *    - Higher weight = more bandwidth
 *    - Used in routers and network QoS
 * 
 * 2. PRIORITY QUEUING:
 *    - Multiple queues with different priorities
 *    - High-priority queue served first
 *    - Used in OS scheduling and network devices
 * 
 * HOW IT WORKS:
 * 
 * User Tiers (Priority Levels):
 * ┌──────────────┬──────────┬────────────┬─────────────┐
 * │ Tier         │ Priority │ Capacity   │ Refill Rate │
 * ├──────────────┼──────────┼────────────┼─────────────┤
 * │ Anonymous    │ 1 (Low)  │ 10 tokens  │ 1 token/s   │
 * │ Free         │ 2        │ 50 tokens  │ 5 tokens/s  │
 * │ Premium      │ 3        │ 200 tokens │ 20 tokens/s │
 * │ Enterprise   │ 4 (High) │ 1000 tokens│ 100 tokens/s│
 * └──────────────┴──────────┴────────────┴─────────────┘
 * 
 * VISUAL EXAMPLE:
 * 
 * Anonymous User (Priority 1):
 * ┌──────────────────────────────────────────────────────┐
 * │ Bucket: [○○○○○○○○○○] 10 tokens max                   │
 * │ Refill: +1 token/second                              │
 * │ Burst:  Can send 10 requests instantly               │
 * │ Sustained: 1 request/second                          │
 * └──────────────────────────────────────────────────────┘
 * 
 * Premium User (Priority 3):
 * ┌──────────────────────────────────────────────────────┐
 * │ Bucket: [○○○○○○○○○○...] 200 tokens max               │
 * │ Refill: +20 tokens/second                            │
 * │ Burst:  Can send 200 requests instantly              │
 * │ Sustained: 20 requests/second                        │
 * └──────────────────────────────────────────────────────┘
 * 
 * PRIORITY QUEUE PROCESSING:
 * 
 * When system is under load, process in priority order:
 * 
 * Round 1: Process 5 Premium requests
 * ┌─────────────────────────────────────┐
 * │ Premium Queue:  [R][R][R][R][R]     │ → Process all 5
 * │ Free Queue:     [R][R][R]           │ → Wait
 * │ Anonymous Queue:[R][R]              │ → Wait
 * └─────────────────────────────────────┘
 * 
 * Round 2: Process 1 Free request
 * ┌─────────────────────────────────────┐
 * │ Premium Queue:  []                  │ → Empty
 * │ Free Queue:     [R][R][R]           │ → Process 1
 * │ Anonymous Queue:[R][R]              │ → Wait
 * └─────────────────────────────────────┘
 * 
 * Round 3: Process 1 Anonymous request (if quota available)
 * ┌─────────────────────────────────────┐
 * │ Premium Queue:  []                  │ → Empty
 * │ Free Queue:     [R][R]              │ → Wait
 * │ Anonymous Queue:[R][R]              │ → Process 1
 * └─────────────────────────────────────┘
 * 
 * WEIGHTED FAIR QUEUING FORMULA:
 * 
 * Service Share = (User Weight / Total Weights) × Total Capacity
 * 
 * Example with 3 users:
 * - Premium (weight=3): 3/(3+2+1) = 50% of capacity
 * - Free (weight=2):    2/(3+2+1) = 33% of capacity
 * - Anonymous (weight=1): 1/(3+2+1) = 17% of capacity
 * 
 * REAL-WORLD USE CASES:
 * 
 * 1. AWS API Gateway:
 *    - Different limits for different AWS accounts
 *    - Reserved capacity for enterprise customers
 * 
 * 2. Stripe API:
 *    - Higher rate limits for verified businesses
 *    - Lower limits for new/unverified accounts
 * 
 * 3. Cloudflare:
 *    - Free plan: Basic protection
 *    - Pro plan: Enhanced DDoS protection
 *    - Enterprise: Dedicated resources
 * 
 * 4. GitHub API:
 *    - Unauthenticated: 60 req/hour
 *    - Authenticated: 5000 req/hour
 *    - Enterprise: Custom limits
 * 
 * 5. Twilio:
 *    - Trial accounts: Strict limits
 *    - Paid accounts: Higher limits
 *    - Enterprise: Dedicated infrastructure
 * 
 * ADVANTAGES:
 * + Fair resource allocation based on user value
 * + Prevents low-priority users from starving high-priority
 * + Monetization friendly (encourage upgrades)
 * + Protects against abuse from free tier
 * + Flexible (can adjust weights dynamically)
 * + Production-proven (used by major APIs)
 * 
 * DISADVANTAGES:
 * - More complex than simple token bucket
 * - Need user authentication/identification
 * - Need pricing tier management
 * - Can feel unfair to free users
 * - Requires monitoring per tier
 * 
 * COMPARISON WITH BASIC TOKEN BUCKET:
 * 
 * Basic Token Bucket:
 * - Everyone gets same limit
 * - One size fits all
 * - Simple but inflexible
 * 
 * Priority Token Bucket:
 * - Each tier gets different limits
 * - Fair resource distribution
 * - Complex but powerful
 * 
 * WHEN TO USE:
 * ✓ SaaS products with pricing tiers
 * ✓ APIs with free and paid plans
 * ✓ High-traffic production systems
 * ✓ Need to prioritize paying customers
 * ✓ Want to encourage plan upgrades
 * ✓ Multi-tenant systems
 * 
 * WHEN NOT TO USE:
 * ✗ All users should be treated equally
 * ✗ Simple internal APIs
 * ✗ No pricing tiers
 * ✗ Low traffic (overkill)
 * 
 * @module algorithms/PriorityTokenBucket
 */

const logger = require('../utils/logger');

// Priority tier configurations
const PRIORITY_TIERS = {
  ANONYMOUS: {
    name: 'Anonymous',
    priority: 1,
    weight: 1,
    capacity: 10,
    refillRate: 1,        // tokens per second
    description: 'Unauthenticated users'
  },
  FREE: {
    name: 'Free',
    priority: 2,
    weight: 2,
    capacity: 50,
    refillRate: 5,
    description: 'Free tier users'
  },
  PREMIUM: {
    name: 'Premium',
    priority: 3,
    weight: 3,
    capacity: 200,
    refillRate: 20,
    description: 'Premium subscription users'
  },
  ENTERPRISE: {
    name: 'Enterprise',
    priority: 4,
    weight: 5,
    capacity: 1000,
    refillRate: 100,
    description: 'Enterprise customers'
  }
};

class PriorityTokenBucketRateLimiter {
  /**
   * Create a Priority Token Bucket Rate Limiter
   * 
   * @param {Object} options - Configuration options
   * @param {boolean} options.enablePriorityQueue - Use priority queue processing
   */
  constructor(options = {}) {
    // Storage for client buckets
    // Structure: Map<clientId, { tokens, lastRefill, tier, priority }>
    this.buckets = new Map();
    
    // Priority queues (only used if enablePriorityQueue is true)
    this.enablePriorityQueue = options.enablePriorityQueue || false;
    this.priorityQueues = this.enablePriorityQueue ? new Map() : null;
    
    // Tier configurations
    this.tiers = PRIORITY_TIERS;
    
    // Start refill interval
    this.startRefill();
    
    logger.info('PriorityTokenBucket rate limiter initialized', {
      algorithm: 'PriorityTokenBucket',
      tiers: Object.keys(this.tiers),
      priorityQueueEnabled: this.enablePriorityQueue
    });
  }

  /**
   * Get tier configuration for a user
   * In production, this would check database/auth service
   * 
   * @param {string} clientId - Client identifier
   * @param {string} userTier - User's tier (anonymous, free, premium, enterprise)
   * @returns {Object} Tier configuration
   */
  getTierConfig(clientId, userTier = 'anonymous') {
    const tier = userTier.toUpperCase();
    
    if (this.tiers[tier]) {
      return this.tiers[tier];
    }
    
    // Default to anonymous if tier not found
    logger.warn('Unknown tier, defaulting to ANONYMOUS', {
      clientId,
      requestedTier: userTier
    });
    
    return this.tiers.ANONYMOUS;
  }

  /**
   * Initialize or get bucket for a client
   * 
   * @param {string} clientId - Client identifier
   * @param {string} userTier - User's tier
   * @returns {Object} Bucket state
   */
  getBucket(clientId, userTier) {
    let bucket = this.buckets.get(clientId);
    
    if (!bucket) {
      const config = this.getTierConfig(clientId, userTier);
      
      bucket = {
        tokens: config.capacity,
        lastRefill: Date.now(),
        tier: config.name,
        priority: config.priority,
        weight: config.weight,
        capacity: config.capacity,
        refillRate: config.refillRate
      };
      
      this.buckets.set(clientId, bucket);
      
      logger.debug('New bucket created', {
        clientId,
        tier: bucket.tier,
        priority: bucket.priority,
        capacity: bucket.capacity
      });
    }
    
    return bucket;
  }

  /**
   * Refill tokens based on time elapsed
   * 
   * ALGORITHM:
   * tokensToAdd = (timeElapsed / 1000) × refillRate
   * newTokens = min(currentTokens + tokensToAdd, capacity)
   * 
   * @param {Object} bucket - Bucket state
   */
  refillTokens(bucket) {
    const now = Date.now();
    const timeSinceLastRefill = now - bucket.lastRefill;
    const secondsElapsed = timeSinceLastRefill / 1000;
    
    // Calculate tokens to add
    const tokensToAdd = secondsElapsed * bucket.refillRate;
    
    if (tokensToAdd > 0) {
      // Add tokens, but don't exceed capacity
      bucket.tokens = Math.min(
        bucket.tokens + tokensToAdd,
        bucket.capacity
      );
      
      bucket.lastRefill = now;
      
      logger.debug('Tokens refilled', {
        tokensAdded: tokensToAdd.toFixed(2),
        currentTokens: bucket.tokens.toFixed(2),
        capacity: bucket.capacity,
        tier: bucket.tier
      });
    }
  }

  /**
   * Check if a request should be allowed
   * 
   * ALGORITHM STEPS:
   * 1. Get or create bucket for client
   * 2. Refill tokens based on time elapsed
   * 3. Check if enough tokens available
   * 4. If yes: consume tokens and allow
   * 5. If no: reject request
   * 6. Return decision with priority metadata
   * 
   * @param {string} clientId - Unique identifier for client
   * @param {string} userTier - User's tier (anonymous, free, premium, enterprise)
   * @param {number} tokensRequired - Number of tokens needed (default: 1)
   * @returns {Object} Decision object
   */
  async check(clientId, userTier = 'anonymous', tokensRequired = 1) {
    const bucket = this.getBucket(clientId, userTier);
    
    // Refill tokens first
    this.refillTokens(bucket);
    
    // Check if enough tokens
    const allowed = bucket.tokens >= tokensRequired;
    
    if (allowed) {
      // Consume tokens
      bucket.tokens -= tokensRequired;
      
      logger.debug('Request allowed', {
        clientId,
        tier: bucket.tier,
        priority: bucket.priority,
        tokensConsumed: tokensRequired,
        tokensRemaining: bucket.tokens.toFixed(2)
      });
    } else {
      logger.debug('Request rejected', {
        clientId,
        tier: bucket.tier,
        priority: bucket.priority,
        tokensAvailable: bucket.tokens.toFixed(2),
        tokensRequired
      });
    }
    
    // Calculate when bucket will have enough tokens
    const tokensNeeded = tokensRequired - bucket.tokens;
    const secondsUntilAvailable = tokensNeeded > 0 
      ? Math.ceil(tokensNeeded / bucket.refillRate)
      : 0;
    
    const result = {
      allowed,
      limit: bucket.capacity,
      remaining: Math.floor(bucket.tokens),
      resetIn: secondsUntilAvailable,
      retryAfter: allowed ? 0 : secondsUntilAvailable,
      algorithm: 'PriorityTokenBucket',
      tier: {
        name: bucket.tier,
        priority: bucket.priority,
        weight: bucket.weight,
        capacity: bucket.capacity,
        refillRate: bucket.refillRate,
        sustainedRate: `${bucket.refillRate} req/s`,
        burstCapacity: bucket.capacity
      },
      metadata: {
        tokensAvailable: parseFloat(bucket.tokens.toFixed(2)),
        tokensRequired,
        tokensConsumed: allowed ? tokensRequired : 0,
        refillRate: bucket.refillRate + ' tokens/s',
        timeUntilFull: Math.ceil((bucket.capacity - bucket.tokens) / bucket.refillRate) + 's'
      }
    };
    
    return result;
  }

  /**
   * Get bucket state for a client
   * 
   * @param {string} clientId - Client identifier
   * @returns {Object|null} Bucket state or null
   */
  getBucketState(clientId) {
    const bucket = this.buckets.get(clientId);
    if (!bucket) return null;
    
    // Refill before returning state
    this.refillTokens(bucket);
    
    return {
      tier: bucket.tier,
      priority: bucket.priority,
      weight: bucket.weight,
      tokens: parseFloat(bucket.tokens.toFixed(2)),
      capacity: bucket.capacity,
      fillPercentage: (bucket.tokens / bucket.capacity * 100).toFixed(2) + '%',
      refillRate: bucket.refillRate + ' tokens/s',
      sustainedRate: bucket.refillRate + ' req/s',
      burstCapacity: bucket.capacity + ' requests',
      timeUntilFull: Math.ceil((bucket.capacity - bucket.tokens) / bucket.refillRate) + 's'
    };
  }

  /**
   * Start periodic refill for all buckets
   */
  startRefill() {
    // Refill interval: every 100ms for smooth operation
    this.refillInterval = setInterval(() => {
      this.refillAll();
    }, 100);
    
    if (this.refillInterval.unref) {
      this.refillInterval.unref();
    }
  }

  /**
   * Refill all buckets
   */
  refillAll() {
    for (const bucket of this.buckets.values()) {
      this.refillTokens(bucket);
    }
  }

  /**
   * Get statistics grouped by tier
   * 
   * @returns {Object} Statistics
   */
  getStats() {
    // Group buckets by tier
    const tierStats = {};
    
    for (const [clientId, bucket] of this.buckets.entries()) {
      if (!tierStats[bucket.tier]) {
        tierStats[bucket.tier] = {
          count: 0,
          totalTokens: 0,
          avgTokens: 0,
          config: {
            priority: bucket.priority,
            weight: bucket.weight,
            capacity: bucket.capacity,
            refillRate: bucket.refillRate
          }
        };
      }
      
      tierStats[bucket.tier].count++;
      tierStats[bucket.tier].totalTokens += bucket.tokens;
    }
    
    // Calculate averages
    for (const tier in tierStats) {
      tierStats[tier].avgTokens = 
        (tierStats[tier].totalTokens / tierStats[tier].count).toFixed(2);
    }
    
    return {
      algorithm: 'PriorityTokenBucket',
      activeBuckets: this.buckets.size,
      priorityQueueEnabled: this.enablePriorityQueue,
      tiers: tierStats,
      tierConfigurations: this.tiers,
      comparison: {
        'Anonymous (Priority 1)': '10 tokens, 1/s refill',
        'Free (Priority 2)': '50 tokens, 5/s refill',
        'Premium (Priority 3)': '200 tokens, 20/s refill',
        'Enterprise (Priority 4)': '1000 tokens, 100/s refill'
      }
    };
  }

  /**
   * Reset all buckets (useful for testing)
   */
  reset() {
    this.buckets.clear();
    if (this.priorityQueues) {
      this.priorityQueues.clear();
    }
    logger.info('All buckets reset');
  }

  /**
   * Stop the refill interval
   */
  stop() {
    if (this.refillInterval) {
      clearInterval(this.refillInterval);
    }
  }
}

module.exports = PriorityTokenBucketRateLimiter;