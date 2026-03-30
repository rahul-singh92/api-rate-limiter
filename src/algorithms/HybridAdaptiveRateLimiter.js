/**
 * Hybrid Adaptive Priority Token Bucket Rate Limiting Algorithm
 * 
 * ALGORITHM DESCRIPTION:
 * This is the ULTIMATE rate limiting algorithm - a sophisticated hybrid that combines:
 * 1. Token Bucket (base mechanism)
 * 2. Priority Levels (from Priority Token Bucket)
 * 3. Dynamic Limits (adaptive like Reputation-Based)
 * 4. Endpoint Cost (different endpoints have different costs)
 * 
 * This is a PRODUCTION-GRADE algorithm used by companies like:
 * - AWS API Gateway (different costs per endpoint)
 * - Google Cloud (quota units per API call)
 * - Stripe (different costs for different operations)
 * - Twilio (adaptive limits based on account standing)
 * 
 * CORE FEATURES:
 * 
 * ┌────────────────────────────────────────────────────────────────┐
 * │                    HYBRID ADAPTIVE SYSTEM                      │
 * ├────────────────────────────────────────────────────────────────┤
 * │ 1. Token Bucket Base:                                          │
 * │    - Capacity: Varies by tier                                  │
 * │    - Refill Rate: Varies by tier and reputation               │
 * │                                                                 │
 * │ 2. Priority Levels (4 tiers):                                  │
 * │    - Anonymous:   capacity=10,  base_rate=1                   │
 * │    - Free:        capacity=50,  base_rate=5                   │
 * │    - Premium:     capacity=200, base_rate=20                  │
 * │    - Enterprise:  capacity=1000, base_rate=100                │
 * │                                                                 │
 * │ 3. Dynamic Adaptation:                                         │
 * │    - Tracks success/failure rate                              │
 * │    - Adjusts refill rate based on behavior                    │
 * │    - Formula: actual_rate = base_rate × reputation_multiplier │
 * │                                                                 │
 * │ 4. Endpoint Cost System:                                       │
 * │    - Simple GET:    1 token                                   │
 * │    - Complex Query: 5 tokens                                  │
 * │    - Write Operation: 10 tokens                               │
 * │    - Heavy Compute: 50 tokens                                 │
 * └────────────────────────────────────────────────────────────────┘
 * 
 * DECISION FORMULA:
 * 
 * allowed = (available_tokens >= endpoint_cost)
 * 
 * Where:
 * - available_tokens = current token count
 * - endpoint_cost = cost configured for the endpoint
 * 
 * REFILL FORMULA:
 * 
 * refill_rate = base_rate × priority_multiplier × reputation_multiplier
 * 
 * Where:
 * - base_rate = tier's base refill rate (e.g., 20 for Premium)
 * - priority_multiplier = tier priority (1.0 - 2.0)
 * - reputation_multiplier = based on success rate (0.5 - 1.5)
 * 
 * REPUTATION MULTIPLIER CALCULATION:
 * 
 * success_rate = successful_requests / total_requests
 * 
 * reputation_multiplier = {
 *   1.5  if success_rate >= 0.95  (Excellent: +50% refill)
 *   1.2  if success_rate >= 0.85  (Good: +20% refill)
 *   1.0  if success_rate >= 0.70  (Fair: normal refill)
 *   0.8  if success_rate >= 0.50  (Poor: -20% refill)
 *   0.5  if success_rate < 0.50   (Bad: -50% refill)
 * }
 * 
 * EXAMPLE SCENARIOS:
 * 
 * Scenario 1: Premium User, Excellent Behavior, Simple GET
 * ────────────────────────────────────────────────────────
 * Tier: Premium
 * Base Rate: 20 tokens/s
 * Priority Multiplier: 1.5 (Premium gets boost)
 * Reputation Multiplier: 1.5 (95%+ success rate)
 * Endpoint Cost: 1 token (simple GET)
 * 
 * Actual Refill: 20 × 1.5 × 1.5 = 45 tokens/s 🚀
 * Capacity: 200 tokens
 * Burst: 200 simple requests instantly
 * Sustained: 45 requests/second
 * 
 * Scenario 2: Free User, Poor Behavior, Heavy Operation
 * ────────────────────────────────────────────────────────
 * Tier: Free
 * Base Rate: 5 tokens/s
 * Priority Multiplier: 1.0 (Free tier)
 * Reputation Multiplier: 0.5 (bad behavior)
 * Endpoint Cost: 50 tokens (heavy operation)
 * 
 * Actual Refill: 5 × 1.0 × 0.5 = 2.5 tokens/s ⚠️
 * Capacity: 50 tokens
 * Burst: 1 heavy operation initially
 * Sustained: 1 heavy operation per 20 seconds
 * 
 * Scenario 3: Enterprise User, Good Behavior, Write Operation
 * ────────────────────────────────────────────────────────
 * Tier: Enterprise
 * Base Rate: 100 tokens/s
 * Priority Multiplier: 2.0 (Enterprise premium)
 * Reputation Multiplier: 1.2 (85%+ success)
 * Endpoint Cost: 10 tokens (write)
 * 
 * Actual Refill: 100 × 2.0 × 1.2 = 240 tokens/s 🔥
 * Capacity: 1000 tokens
 * Burst: 100 write operations instantly
 * Sustained: 24 write operations/second
 * 
 * ENDPOINT COST EXAMPLES:
 * 
 * ┌──────────────────────┬────────┬─────────────────────────┐
 * │ Operation            │ Cost   │ Reasoning               │
 * ├──────────────────────┼────────┼─────────────────────────┤
 * │ GET /users/:id       │ 1      │ Simple lookup           │
 * │ GET /search?q=...    │ 5      │ Complex query           │
 * │ POST /users          │ 10     │ Write + validation      │
 * │ PUT /users/:id       │ 10     │ Write + validation      │
 * │ POST /export         │ 50     │ Heavy computation       │
 * │ POST /ai/generate    │ 100    │ AI/ML processing        │
 * │ POST /batch          │ 500    │ Bulk operations         │
 * └──────────────────────┴────────┴─────────────────────────┘
 * 
 * ADAPTIVE BEHAVIOR:
 * 
 * User Journey Example:
 * 
 * Day 1 (New Premium User):
 * ├─ Success Rate: 100% (0/0 failures)
 * ├─ Multiplier: 1.5 (excellent)
 * ├─ Refill: 20 × 1.5 × 1.5 = 45/s
 * └─ Status: 🟢 Excellent
 * 
 * Day 7 (Some Errors):
 * ├─ Success Rate: 88% (12/100 failures)
 * ├─ Multiplier: 1.2 (good)
 * ├─ Refill: 20 × 1.5 × 1.2 = 36/s
 * └─ Status: 🔵 Good
 * 
 * Day 14 (Bot Detected):
 * ├─ Success Rate: 45% (55/100 failures)
 * ├─ Multiplier: 0.5 (bad)
 * ├─ Refill: 20 × 1.5 × 0.5 = 15/s
 * └─ Status: 🔴 Auto-Throttled
 * 
 * Day 21 (Behavior Improved):
 * ├─ Success Rate: 92% (8/100 failures)
 * ├─ Multiplier: 1.2 (good)
 * ├─ Refill: 20 × 1.5 × 1.2 = 36/s
 * └─ Status: 🔵 Recovered
 * 
 * ADVANTAGES:
 * 
 * + Most flexible rate limiting system
 * + Fair to all user tiers
 * + Rewards good behavior automatically
 * + Punishes abuse automatically
 * + Protects expensive endpoints
 * + Production-proven approach
 * + Scales to millions of users
 * + No manual intervention needed
 * 
 * DISADVANTAGES:
 * 
 * - Complex to implement
 * - Complex to configure
 * - Requires endpoint cost mapping
 * - Higher memory usage
 * - More CPU for calculations
 * - Need monitoring dashboards
 * 
 * REAL-WORLD IMPLEMENTATIONS:
 * 
 * 1. AWS API Gateway:
 *    - Different costs per endpoint
 *    - Throttling based on account tier
 *    - Burst capacity per tier
 * 
 * 2. Google Cloud APIs:
 *    - Quota units per API call
 *    - Different costs for read/write
 *    - Auto-scaling based on usage
 * 
 * 3. Stripe API:
 *    - Higher limits for verified accounts
 *    - Different costs for operations
 *    - Adaptive rate limiting
 * 
 * 4. Twilio:
 *    - Tier-based rate limits
 *    - Endpoint-specific costs
 *    - Reputation-based throttling
 * 
 * 5. OpenAI API:
 *    - Token-based pricing
 *    - Different models = different costs
 *    - Tier-based rate limits
 * 
 * WHEN TO USE:
 * 
 * ✓ Production SaaS with pricing tiers
 * ✓ APIs with expensive operations
 * ✓ Need to prevent abuse
 * ✓ Want automatic adaptation
 * ✓ Have different endpoint costs
 * ✓ Multi-tenant systems
 * ✓ High-value APIs
 * 
 * WHEN NOT TO USE:
 * 
 * ✗ Simple internal APIs
 * ✗ All operations equal cost
 * ✗ All users treated equally
 * ✗ Low traffic
 * ✗ Cannot tolerate complexity
 * 
 * @module algorithms/HybridAdaptiveRateLimiter
 */

const logger = require('../utils/logger');

// Priority tier configurations
const PRIORITY_TIERS = {
  ANONYMOUS: {
    name: 'Anonymous',
    priority: 1,
    capacity: 10,
    baseRate: 1,
    priorityMultiplier: 0.8,
    description: 'Unauthenticated users'
  },
  FREE: {
    name: 'Free',
    priority: 2,
    capacity: 50,
    baseRate: 5,
    priorityMultiplier: 1.0,
    description: 'Free tier users'
  },
  PREMIUM: {
    name: 'Premium',
    priority: 3,
    capacity: 200,
    baseRate: 20,
    priorityMultiplier: 1.5,
    description: 'Premium subscription'
  },
  ENTERPRISE: {
    name: 'Enterprise',
    priority: 4,
    capacity: 1000,
    baseRate: 100,
    priorityMultiplier: 2.0,
    description: 'Enterprise customers'
  }
};

// Endpoint cost configurations
const ENDPOINT_COSTS = {
  'GET:/simple': 1,
  'GET:/data': 1,
  'GET:/list': 2,
  'GET:/search': 5,
  'POST:/create': 10,
  'PUT:/update': 10,
  'DELETE:/remove': 10,
  'POST:/export': 50,
  'POST:/compute': 100,
  'POST:/ai': 100,
  'POST:/batch': 500
};

class HybridAdaptiveRateLimiter {
  /**
   * Create a Hybrid Adaptive Rate Limiter
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.endpointCosts - Custom endpoint costs
   * @param {number} options.reputationWindow - Window for reputation tracking
   */
  constructor(options = {}) {
    // Configurations
    this.tiers = PRIORITY_TIERS;
    this.endpointCosts = { ...ENDPOINT_COSTS, ...(options.endpointCosts || {}) };
    this.reputationWindow = options.reputationWindow || 100;
    
    // Storage
    // Structure: Map<clientId, {
    //   tokens, lastRefill, tier, capacity, baseRate,
    //   successCount, failureCount, totalRequests,
    //   reputationMultiplier, history
    // }>
    this.clients = new Map();
    
    // Start refill
    this.startRefill();
    
    logger.info('HybridAdaptive rate limiter initialized', {
      algorithm: 'HybridAdaptive',
      tiers: Object.keys(this.tiers),
      endpointCosts: Object.keys(this.endpointCosts).length
    });
  }

  /**
   * Get tier configuration
   * 
   * @param {string} tierName - Tier name
   * @returns {Object} Tier config
   */
  getTierConfig(tierName = 'free') {
    const tier = tierName.toUpperCase();
    return this.tiers[tier] || this.tiers.FREE;
  }

  /**
   * Get endpoint cost
   * 
   * @param {string} method - HTTP method
   * @param {string} path - Endpoint path
   * @returns {number} Token cost
   */
  getEndpointCost(method, path) {
    // Try exact match
    const exactKey = `${method}:${path}`;
    if (this.endpointCosts[exactKey]) {
      return this.endpointCosts[exactKey];
    }
    
    // Try pattern match (simplified)
    for (const [pattern, cost] of Object.entries(this.endpointCosts)) {
      if (pattern.includes('*') && path.includes(pattern.split('*')[0])) {
        return cost;
      }
    }
    
    // Default costs by method
    const defaultCosts = {
      'GET': 1,
      'POST': 10,
      'PUT': 10,
      'DELETE': 10,
      'PATCH': 10
    };
    
    return defaultCosts[method] || 1;
  }

  /**
   * Calculate reputation multiplier
   * 
   * @param {Object} client - Client data
   * @returns {number} Multiplier (0.5 - 1.5)
   */
  calculateReputationMultiplier(client) {
    if (client.totalRequests < 10) {
      return 1.0; // Neutral for new users
    }
    
    const successRate = client.successCount / client.totalRequests;
    
    if (successRate >= 0.95) return 1.5;  // Excellent: +50%
    if (successRate >= 0.85) return 1.2;  // Good: +20%
    if (successRate >= 0.70) return 1.0;  // Fair: normal
    if (successRate >= 0.50) return 0.8;  // Poor: -20%
    return 0.5;                           // Bad: -50%
  }

  /**
   * Get reputation tier name
   */
  getReputationTier(multiplier) {
    if (multiplier >= 1.5) return 'Excellent 🟢';
    if (multiplier >= 1.2) return 'Good 🔵';
    if (multiplier >= 1.0) return 'Fair 🟡';
    if (multiplier >= 0.8) return 'Poor 🟠';
    return 'Bad 🔴';
  }

  /**
   * Calculate actual refill rate
   * 
   * Formula: base_rate × priority_multiplier × reputation_multiplier
   * 
   * @param {Object} client - Client data
   * @param {Object} tierConfig - Tier configuration
   * @returns {number} Actual refill rate
   */
  calculateRefillRate(client, tierConfig) {
    const reputationMultiplier = this.calculateReputationMultiplier(client);
    
    return tierConfig.baseRate * 
           tierConfig.priorityMultiplier * 
           reputationMultiplier;
  }

  /**
   * Initialize or get client
   */
  getClient(clientId, tierName) {
    let client = this.clients.get(clientId);
    
    if (!client) {
      const tierConfig = this.getTierConfig(tierName);
      
      client = {
        tokens: tierConfig.capacity,
        lastRefill: Date.now(),
        tier: tierConfig.name,
        capacity: tierConfig.capacity,
        baseRate: tierConfig.baseRate,
        priorityMultiplier: tierConfig.priorityMultiplier,
        successCount: 0,
        failureCount: 0,
        totalRequests: 0,
        reputationMultiplier: 1.0,
        history: []
      };
      
      this.clients.set(clientId, client);
      
      logger.debug('New client initialized', {
        clientId,
        tier: client.tier
      });
    }
    
    return client;
  }

  /**
   * Refill tokens
   */
  refillTokens(client, tierConfig) {
    const now = Date.now();
    const timeSinceLastRefill = now - client.lastRefill;
    const secondsElapsed = timeSinceLastRefill / 1000;
    
    // Calculate actual refill rate with all multipliers
    const actualRefillRate = this.calculateRefillRate(client, tierConfig);
    const tokensToAdd = secondsElapsed * actualRefillRate;
    
    if (tokensToAdd > 0) {
      client.tokens = Math.min(
        client.tokens + tokensToAdd,
        client.capacity
      );
      
      client.lastRefill = now;
    }
  }

  /**
   * Update reputation
   */
  updateReputation(client, success) {
    client.totalRequests++;
    
    if (success) {
      client.successCount++;
    } else {
      client.failureCount++;
    }
    
    if (!client.history) {
      client.history = [];
    }
    
    client.history.push(success);
    
    if (client.history.length > this.reputationWindow) {
      client.history.shift();
    }
    
    // Recalculate multiplier
    client.reputationMultiplier = this.calculateReputationMultiplier(client);
  }

  /**
   * Check if request should be allowed
   * 
   * @param {string} clientId - Client identifier
   * @param {string} tierName - User tier (anonymous, free, premium, enterprise)
   * @param {string} method - HTTP method
   * @param {string} path - Endpoint path
   * @returns {Object} Decision object
   */
  async check(clientId, tierName = 'free', method = 'GET', path = '/data') {
    const tierConfig = this.getTierConfig(tierName);
    const client = this.getClient(clientId, tierName);
    
    // Refill tokens
    this.refillTokens(client, tierConfig);
    
    // Get endpoint cost
    const endpointCost = this.getEndpointCost(method, path);
    
    // Check if enough tokens
    const allowed = client.tokens >= endpointCost;
    
    if (allowed) {
      // Consume tokens
      client.tokens -= endpointCost;
      
      logger.debug('Request allowed', {
        clientId,
        tier: client.tier,
        cost: endpointCost,
        tokensRemaining: client.tokens.toFixed(2)
      });
    } else {
      // Request denied
      this.updateReputation(client, false);
      
      logger.debug('Request rejected', {
        clientId,
        tier: client.tier,
        cost: endpointCost,
        tokensAvailable: client.tokens.toFixed(2)
      });
    }
    
    // Calculate actual refill rate
    const actualRefillRate = this.calculateRefillRate(client, tierConfig);
    
    // Calculate retry time
    const tokensNeeded = endpointCost - client.tokens;
    const secondsUntilAvailable = tokensNeeded > 0
      ? Math.ceil(tokensNeeded / actualRefillRate)
      : 0;
    
    const result = {
      allowed,
      limit: client.capacity,
      remaining: Math.floor(client.tokens),
      resetIn: secondsUntilAvailable,
      retryAfter: allowed ? 0 : secondsUntilAvailable,
      algorithm: 'HybridAdaptive',
      tier: {
        name: client.tier,
        priority: tierConfig.priority,
        baseCapacity: tierConfig.capacity,
        baseRate: tierConfig.baseRate + ' tokens/s',
        priorityMultiplier: tierConfig.priorityMultiplier
      },
      endpoint: {
        method,
        path,
        cost: endpointCost,
        costDescription: endpointCost === 1 ? 'Simple operation' :
                        endpointCost <= 5 ? 'Standard operation' :
                        endpointCost <= 10 ? 'Write operation' :
                        endpointCost <= 50 ? 'Heavy operation' :
                        'Very expensive operation'
      },
      reputation: {
        multiplier: client.reputationMultiplier,
        tier: this.getReputationTier(client.reputationMultiplier),
        successRate: client.totalRequests > 0 
          ? ((client.successCount / client.totalRequests) * 100).toFixed(1) + '%'
          : 'N/A',
        totalRequests: client.totalRequests,
        successCount: client.successCount,
        failureCount: client.failureCount
      },
      performance: {
        actualRefillRate: actualRefillRate.toFixed(2) + ' tokens/s',
        formula: `${tierConfig.baseRate} × ${tierConfig.priorityMultiplier} × ${client.reputationMultiplier} = ${actualRefillRate.toFixed(2)}`,
        sustainedRate: `${(actualRefillRate / endpointCost).toFixed(2)} requests/s`,
        burstCapacity: Math.floor(client.capacity / endpointCost) + ' requests'
      }
    };
    
    return result;
  }

  /**
   * Report request outcome
   */
  async reportOutcome(clientId, success, statusCode = null) {
    const client = this.clients.get(clientId);
    
    if (!client) {
      logger.warn('Outcome reported for unknown client', { clientId });
      return;
    }
    
    if (statusCode !== null) {
      success = statusCode >= 200 && statusCode < 400;
    }
    
    this.updateReputation(client, success);
    
    logger.debug('Outcome reported', {
      clientId,
      success,
      statusCode,
      newMultiplier: client.reputationMultiplier
    });
  }

  /**
   * Get client state
   */
  getClientState(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return null;
    
    const tierConfig = this.getTierConfig(client.tier);
    this.refillTokens(client, tierConfig);
    
    const actualRefillRate = this.calculateRefillRate(client, tierConfig);
    
    return {
      tier: client.tier,
      tokens: parseFloat(client.tokens.toFixed(2)),
      capacity: client.capacity,
      baseRate: client.baseRate,
      actualRefillRate: actualRefillRate.toFixed(2) + ' tokens/s',
      priorityMultiplier: client.priorityMultiplier,
      reputationMultiplier: client.reputationMultiplier,
      reputationTier: this.getReputationTier(client.reputationMultiplier),
      statistics: {
        totalRequests: client.totalRequests,
        successCount: client.successCount,
        failureCount: client.failureCount,
        successRate: client.totalRequests > 0
          ? ((client.successCount / client.totalRequests) * 100).toFixed(1) + '%'
          : 'N/A'
      }
    };
  }

  /**
   * Start refill interval
   */
  startRefill() {
    this.refillInterval = setInterval(() => {
      for (const [clientId, client] of this.clients.entries()) {
        const tierConfig = this.getTierConfig(client.tier);
        this.refillTokens(client, tierConfig);
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
    const tierStats = {};
    
    for (const [clientId, client] of this.clients.entries()) {
      if (!tierStats[client.tier]) {
        tierStats[client.tier] = {
          count: 0,
          avgReputation: 0,
          totalReputation: 0
        };
      }
      
      tierStats[client.tier].count++;
      tierStats[client.tier].totalReputation += client.reputationMultiplier;
    }
    
    for (const tier in tierStats) {
      tierStats[tier].avgReputation = 
        (tierStats[tier].totalReputation / tierStats[tier].count).toFixed(2);
    }
    
    return {
      algorithm: 'HybridAdaptive',
      activeClients: this.clients.size,
      tiers: tierStats,
      tierConfigurations: this.tiers,
      endpointCosts: this.endpointCosts,
      features: {
        tokenBucket: 'Yes',
        priorityLevels: '4 tiers',
        dynamicAdaptation: 'Reputation-based',
        endpointCosts: Object.keys(this.endpointCosts).length + ' configured'
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

module.exports = HybridAdaptiveRateLimiter;
