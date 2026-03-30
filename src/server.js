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
const {
  FixedWindow,
  TokenBucket,
  LeakyBucket,
  SlidingWindowLog,
  SlidingWindowCounter,
  PriorityTokenBucket,
  ReputationBased,
  HybridAdaptive
} = require('./algorithms');
const createRateLimiter = require('./middleware/rateLimiter');
const createPriorityRateLimiter = require('./middleware/priorityRateLimiter');
const createReputationRateLimiter = require('./middleware/reputationRateLimiter');
const createHybridRateLimiter = require('./middleware/hybridRateLimiter');
const { getClientId } = require('./utils/clientId');

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

// ============================================
// Initialize Rate Limiters
// ============================================

// Fixed Window Limiter
const fixedWindowLimiter = new FixedWindow({
  windowMs: config.rateLimit.fixedWindow.windowMs,
  maxRequests: config.rateLimit.fixedWindow.maxRequests
});

// Token Bucket Limiter
const tokenBucketLimiter = new TokenBucket({
  capacity: 100,
  refillRate: 10,
  tokensPerRequest: 1
});

// Leaky Bucket Limiter
const leakyBucketLimiter = new LeakyBucket({
  capacity: 100,
  leakRate: 10,
  queueRequests: false
});

// Sliding Window Log Limiter
const slidingWindowLogLimiter = new SlidingWindowLog({
  windowMs: 60000,
  maxRequests: 100
});

// Sliding Window Counter Limiter
const slidingWindowCounterLimiter = new SlidingWindowCounter({
  windowMs: 60000,
  maxRequests: 100
});

// Priority Token Bucket Limiter
const priorityTokenBucketLimiter = new PriorityTokenBucket({
  enablePriorityQueue: false
});

const reputationBasedLimiter = new ReputationBased({
  windowSize: 100,      // Track last 100 requests
  decayFactor: 0.7,     // 70% weight to recent behavior
  minRequests: 10       // Need 10 requests before scoring
});

const hybridAdaptiveLimiter = new HybridAdaptive({
  endpointCosts: {
    'GET:/api/hybrid/simple': 1,
    'GET:/api/hybrid/data': 1,
    'GET:/api/hybrid/search': 5,
    'POST:/api/hybrid/create': 10,
    'POST:/api/hybrid/export': 50,
    'POST:/api/hybrid/compute': 100
  },
  reputationWindow: 100
});


// ============================================
// Apply Rate Limiting Middleware
// ============================================

app.use('/api/fixed', createRateLimiter(fixedWindowLimiter));
app.use('/api/token', createRateLimiter(tokenBucketLimiter));
app.use('/api/leaky', createRateLimiter(leakyBucketLimiter));
app.use('/api/sliding', createRateLimiter(slidingWindowLogLimiter));
app.use('/api/counter', createRateLimiter(slidingWindowCounterLimiter));
app.use('/api/priority', createPriorityRateLimiter(priorityTokenBucketLimiter));
app.use('/api/reputation', createReputationRateLimiter(reputationBasedLimiter));
app.use('/api/hybrid', createHybridRateLimiter(hybridAdaptiveLimiter));

// Default rate limiting for generic /api routes
app.use('/api', createRateLimiter(fixedWindowLimiter));

// ============================================
// API Routes
// ============================================

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    algorithms: [
      'FixedWindow',
      'TokenBucket',
      'LeakyBucket',
      'SlidingWindowLog',
      'SlidingWindowCounter',
      'PriorityTokenBucket',
      'ReputationBased',
      'HybridAdaptive'
    ]
  });
});

/**
 * Fixed Window endpoints
 */
app.get('/api/fixed/data', (req, res) => {
  res.json({
    message: 'This endpoint uses Fixed Window rate limiting',
    algorithm: 'FixedWindow',
    data: {
      timestamp: new Date().toISOString(),
      characteristics: {
        complexity: 'O(1)',
        accuracy: 'Poor',
        boundaryProblem: 'Yes'
      }
    }
  });
});

/**
 * Token Bucket endpoints
 */
app.get('/api/token/data', (req, res) => {
  res.json({
    message: 'This endpoint uses Token Bucket rate limiting',
    algorithm: 'TokenBucket',
    data: {
      timestamp: new Date().toISOString(),
      characteristics: {
        complexity: 'O(1)',
        accuracy: 'Good',
        allowsBursts: 'Yes'
      }
    }
  });
});

/**
 * Leaky Bucket endpoints
 */
app.get('/api/leaky/data', (req, res) => {
  res.json({
    message: 'This endpoint uses Leaky Bucket rate limiting',
    algorithm: 'LeakyBucket',
    data: {
      timestamp: new Date().toISOString(),
      characteristics: {
        complexity: 'O(1)',
        outputRate: 'Constant',
        rejectsBursts: 'Yes'
      }
    }
  });
});

/**
 * Sliding Window Log endpoints
 */
app.get('/api/sliding/data', (req, res) => {
  res.json({
    message: 'This endpoint uses Sliding Window Log rate limiting',
    algorithm: 'SlidingWindowLog',
    data: {
      timestamp: new Date().toISOString(),
      characteristics: {
        complexity: 'O(n)',
        accuracy: 'Perfect',
        memory: 'High'
      }
    }
  });
});

/**
 * Sliding Window Counter endpoints
 */
app.get('/api/counter/data', (req, res) => {
  res.json({
    message: 'This endpoint uses Sliding Window Counter rate limiting',
    algorithm: 'SlidingWindowCounter',
    data: {
      timestamp: new Date().toISOString(),
      characteristics: {
        complexity: 'O(1)',
        accuracy: 'Excellent (~95%)',
        recommended: 'Production use'
      }
    }
  });
});

/**
 * Priority Token Bucket endpoints
 */
/**
 * Priority Token Bucket endpoints
 */
app.get('/api/priority/data', (req, res) => {
  // Get rate limit info from middleware
  const rateLimit = req.rateLimit || {};

  res.json({
    message: 'This endpoint uses Priority Token Bucket rate limiting',
    algorithm: 'PriorityTokenBucket',
    allowed: rateLimit.allowed,
    limit: rateLimit.limit,
    remaining: rateLimit.remaining,
    tier: rateLimit.tier,
    metadata: rateLimit.metadata,
    data: {
      timestamp: new Date().toISOString(),
      characteristics: {
        complexity: 'O(1)',
        fairness: 'Weighted by tier',
        production: 'SaaS/Multi-tenant'
      }
    }
  });
});

app.get('/api/reputation/data', (req, res) => {
  // Get rate limit info
  const rateLimit = req.rateLimit || {};

  res.json({
    message: 'This endpoint uses Reputation-Based rate limiting',
    algorithm: 'ReputationBased',
    allowed: rateLimit.allowed,
    limit: rateLimit.limit,
    remaining: rateLimit.remaining,
    reputation: rateLimit.reputation,
    metadata: rateLimit.metadata,
    data: {
      timestamp: new Date().toISOString(),
      characteristics: {
        adaptive: 'Yes',
        selfHealing: 'Yes',
        autoThrottle: 'Bad actors automatically limited'
      }
    }
  });
});

app.get('/api/reputation/bad', (req, res) => {
  // This will return 400 and hurt reputation
  res.status(400).json({
    error: 'Bad Request',
    message: 'This simulates a bad request to test reputation tracking',
    impact: 'This will decrease your reputation score'
  });
});

/**
 * Get reputation status
 */
/**
 * Get reputation status
 */
app.get('/api/reputation/status', (req, res) => {
  const clientId = getClientId(req);
  const state = reputationBasedLimiter.getClientState(clientId);

  if (!state) {
    return res.json({
      message: 'No reputation data yet',
      tip: 'Make some requests to /api/reputation/data to build reputation',
      clientId: clientId,
      debug: {
        'x-forwarded-for': req.headers['x-forwarded-for'] || 'not set',
        'req.ip': req.ip || 'not set',
        'detected': clientId
      }
    });
  }

  res.json({
    clientId: clientId,
    reputation: state,
    tiers: {
      excellent: '🟢 0.95-1.0: 200 capacity, 20/s refill',
      good: '🔵 0.80-0.94: 150 capacity, 15/s refill',
      fair: '🟡 0.60-0.79: 100 capacity, 10/s refill',
      poor: '🟠 0.40-0.59: 50 capacity, 5/s refill',
      bad: '🔴 0.20-0.39: 20 capacity, 2/s refill',
      malicious: '⛔ 0.0-0.19: 5 capacity, 0.5/s refill'
    },
    howToImprove: state.tier === 'Poor' || state.tier === 'Bad' || state.tier === 'Malicious'
      ? 'Make successful requests (2xx status) to improve your score'
      : 'Keep making valid requests to maintain your reputation'
  });
});

/**
 * Reputation tiers info
 */
app.get('/api/reputation/tiers', (req, res) => {
  res.json({
    tiers: {
      excellent: {
        icon: '🟢',
        scoreRange: '0.95 - 1.0',
        successRate: '95%+',
        capacity: 200,
        refillRate: '20 tokens/s',
        description: 'Trusted user with perfect behavior'
      },
      good: {
        icon: '🔵',
        scoreRange: '0.80 - 0.94',
        successRate: '80-94%',
        capacity: 150,
        refillRate: '15 tokens/s',
        description: 'Reliable user with good behavior'
      },
      fair: {
        icon: '🟡',
        scoreRange: '0.60 - 0.79',
        successRate: '60-79%',
        capacity: 100,
        refillRate: '10 tokens/s',
        description: 'Average user, some issues'
      },
      poor: {
        icon: '🟠',
        scoreRange: '0.40 - 0.59',
        successRate: '40-59%',
        capacity: 50,
        refillRate: '5 tokens/s',
        description: 'Suspicious activity detected'
      },
      bad: {
        icon: '🔴',
        scoreRange: '0.20 - 0.39',
        successRate: '20-39%',
        capacity: 20,
        refillRate: '2 tokens/s',
        description: 'Frequent violations, likely bot'
      },
      malicious: {
        icon: '⛔',
        scoreRange: '0.0 - 0.19',
        successRate: '<20%',
        capacity: 5,
        refillRate: '0.5 tokens/s',
        description: 'Severe abuse detected'
      }
    },
    algorithm: {
      formula: 'score = successful_requests / total_requests',
      decay: 'Recent behavior weighted at 70%',
      newUsers: 'Start at Good tier (0.8 score)',
      adaptation: 'Automatic tier adjustment based on behavior'
    },
    realWorldExamples: {
      cloudflare: 'Bot scoring and adaptive challenges',
      awsWaf: 'IP reputation tracking',
      reddit: 'Karma-based rate limiting',
      google: 'reCAPTCHA v3 reputation scores'
    }
  });
});

/**
 * Show all available tiers
 */
app.get('/api/priority/tiers', (req, res) => {
  res.json({
    tiers: {
      anonymous: {
        priority: 1,
        weight: 1,
        capacity: 10,
        refillRate: '1 token/s',
        sustained: '1 req/s',
        burst: '10 requests',
        cost: 'Free',
        description: 'No authentication required'
      },
      free: {
        priority: 2,
        weight: 2,
        capacity: 50,
        refillRate: '5 tokens/s',
        sustained: '5 req/s',
        burst: '50 requests',
        cost: 'Free',
        description: 'Sign up required'
      },
      premium: {
        priority: 3,
        weight: 3,
        capacity: 200,
        refillRate: '20 tokens/s',
        sustained: '20 req/s',
        burst: '200 requests',
        cost: '$49/month',
        description: 'Professional tier'
      },
      enterprise: {
        priority: 4,
        weight: 5,
        capacity: 1000,
        refillRate: '100 tokens/s',
        sustained: '100 req/s',
        burst: '1000 requests',
        cost: 'Custom',
        description: 'Dedicated resources'
      }
    },
    comparison: {
      'Anonymous vs Free': '5x higher limits',
      'Free vs Premium': '4x higher limits',
      'Premium vs Enterprise': '5x higher limits',
      'Anonymous vs Enterprise': '100x higher limits'
    },
    howToTest: {
      anonymous: 'curl http://localhost:3000/api/priority/data',
      free: 'curl -H "X-User-Tier: free" http://localhost:3000/api/priority/data',
      premium: 'curl -H "X-User-Tier: premium" http://localhost:3000/api/priority/data',
      enterprise: 'curl -H "X-User-Tier: enterprise" http://localhost:3000/api/priority/data'
    },
    realWorldExamples: {
      'AWS API Gateway': 'Different limits per account tier',
      'Stripe API': 'Higher limits for verified businesses',
      'GitHub API': 'Unauthenticated: 60/hr, Authenticated: 5000/hr',
      'Twilio': 'Trial vs Paid account limits',
      'Cloudflare': 'Free vs Pro vs Enterprise tiers'
    }
  });
});

// endpoints for hybrid adaptive rate limiter
app.get('/api/hybrid/simple', (req, res) => {
  const rateLimit = req.rateLimit || {};

  res.json({
    message: 'Simple operation - costs 1 token',
    algorithm: 'HybridAdaptive',
    cost: 1,
    tier: rateLimit.tier,
    reputation: rateLimit.reputation,
    performance: rateLimit.performance,
    data: { timestamp: new Date().toISOString() }
  });
});

app.get('/api/hybrid/data', (req, res) => {
  const rateLimit = req.rateLimit || {};

  res.json({
    message: 'Standard data retrieval - costs 1 token',
    algorithm: 'HybridAdaptive',
    cost: 1,
    tier: rateLimit.tier,
    reputation: rateLimit.reputation,
    performance: rateLimit.performance,
    data: {
      timestamp: new Date().toISOString(),
      records: ['item1', 'item2', 'item3']
    }
  });
});

app.get('/api/hybrid/search', (req, res) => {
  const rateLimit = req.rateLimit || {};
  const query = req.query.q || '';

  res.json({
    message: 'Complex search - costs 5 tokens',
    algorithm: 'HybridAdaptive',
    cost: 5,
    query: query,
    tier: rateLimit.tier,
    reputation: rateLimit.reputation,
    performance: rateLimit.performance,
    results: [
      { id: 1, title: 'Result 1', score: 0.95 },
      { id: 2, title: 'Result 2', score: 0.87 }
    ]
  });
});

app.post('/api/hybrid/create', (req, res) => {
  const rateLimit = req.rateLimit || {};

  res.json({
    message: 'Create operation - costs 10 tokens',
    algorithm: 'HybridAdaptive',
    cost: 10,
    tier: rateLimit.tier,
    reputation: rateLimit.reputation,
    performance: rateLimit.performance,
    created: {
      id: Math.floor(Math.random() * 10000),
      timestamp: new Date().toISOString()
    }
  });
});

app.post('/api/hybrid/export', (req, res) => {
  const rateLimit = req.rateLimit || {};

  res.json({
    message: 'Heavy export operation - costs 50 tokens',
    algorithm: 'HybridAdaptive',
    cost: 50,
    tier: rateLimit.tier,
    reputation: rateLimit.reputation,
    performance: rateLimit.performance,
    export: {
      format: 'CSV',
      size: '15MB',
      downloadUrl: '/downloads/export_' + Date.now() + '.csv'
    }
  });
});

app.post('/api/hybrid/compute', (req, res) => {
  const rateLimit = req.rateLimit || {};

  res.json({
    message: 'Very expensive computation - costs 100 tokens',
    algorithm: 'HybridAdaptive',
    cost: 100,
    tier: rateLimit.tier,
    reputation: rateLimit.reputation,
    performance: rateLimit.performance,
    computation: {
      type: 'ML Model Training',
      duration: '45 seconds',
      result: 'Completed'
    }
  });
});

// Bad endpoint for testing (causes failures)
app.get('/api/hybrid/bad', (req, res) => {
  res.status(400).json({
    error: 'Bad Request',
    message: 'This simulates a bad request to test reputation tracking',
    impact: 'This will decrease your reputation multiplier'
  });
});

// Status endpoint
app.get('/api/hybrid/status', (req, res) => {
  const clientId = getClientId(req);
  const state = hybridAdaptiveLimiter.getClientState(clientId);

  if (!state) {
    return res.json({
      message: 'No data yet',
      tip: 'Make some requests to build history',
      clientId: clientId
    });
  }

  res.json({
    clientId: clientId,
    state: state,
    endpointCosts: {
      'GET /simple': '1 token (simple)',
      'GET /data': '1 token (standard)',
      'GET /search': '5 tokens (complex)',
      'POST /create': '10 tokens (write)',
      'POST /export': '50 tokens (heavy)',
      'POST /compute': '100 tokens (very expensive)'
    },
    formula: {
      actualRate: 'base_rate × priority_multiplier × reputation_multiplier',
      example: state.actualRefillRate,
      breakdown: `${state.baseRate} × ${state.priorityMultiplier} × ${state.reputationMultiplier}`
    }
  });
});

// Costs endpoint
app.get('/api/hybrid/costs', (req, res) => {
  res.json({
    endpointCosts: {
      simple: {
        path: '/api/hybrid/simple',
        method: 'GET',
        cost: 1,
        description: 'Simple data retrieval'
      },
      data: {
        path: '/api/hybrid/data',
        method: 'GET',
        cost: 1,
        description: 'Standard data retrieval'
      },
      search: {
        path: '/api/hybrid/search',
        method: 'GET',
        cost: 5,
        description: 'Complex search query'
      },
      create: {
        path: '/api/hybrid/create',
        method: 'POST',
        cost: 10,
        description: 'Create new resource'
      },
      export: {
        path: '/api/hybrid/export',
        method: 'POST',
        cost: 50,
        description: 'Heavy export operation'
      },
      compute: {
        path: '/api/hybrid/compute',
        method: 'POST',
        cost: 100,
        description: 'Very expensive computation'
      }
    },
    tiers: {
      anonymous: {
        baseCapacity: 10,
        baseRate: '1 token/s',
        priorityMultiplier: 0.8,
        worstCase: '0.5 × 0.8 × 1 = 0.4 tokens/s',
        bestCase: '1.5 × 0.8 × 1 = 1.2 tokens/s'
      },
      free: {
        baseCapacity: 50,
        baseRate: '5 tokens/s',
        priorityMultiplier: 1.0,
        worstCase: '0.5 × 1.0 × 5 = 2.5 tokens/s',
        bestCase: '1.5 × 1.0 × 5 = 7.5 tokens/s'
      },
      premium: {
        baseCapacity: 200,
        baseRate: '20 tokens/s',
        priorityMultiplier: 1.5,
        worstCase: '0.5 × 1.5 × 20 = 15 tokens/s',
        bestCase: '1.5 × 1.5 × 20 = 45 tokens/s'
      },
      enterprise: {
        baseCapacity: 1000,
        baseRate: '100 tokens/s',
        priorityMultiplier: 2.0,
        worstCase: '0.5 × 2.0 × 100 = 100 tokens/s',
        bestCase: '1.5 × 2.0 × 100 = 300 tokens/s'
      }
    },
    reputationMultipliers: {
      excellent: '1.5 (success rate ≥ 95%)',
      good: '1.2 (success rate ≥ 85%)',
      fair: '1.0 (success rate ≥ 70%)',
      poor: '0.8 (success rate ≥ 50%)',
      bad: '0.5 (success rate < 50%)'
    }
  });
});

/**
 * Generic endpoint
 */
app.get('/api/data', (req, res) => {
  res.json({
    message: 'This endpoint uses default rate limiting',
    algorithm: 'FixedWindow (default)',
    data: { timestamp: new Date().toISOString() }
  });
});

/**
 * Sample POST endpoint
 */
app.post('/api/submit', (req, res) => {
  res.json({
    message: 'Data submitted successfully',
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

/**
 * Metrics endpoint
 */
app.get('/metrics', (req, res) => {
  const summary = metrics.getSummary();

  res.json({
    server: summary,
    rateLimiters: {
      fixedWindow: fixedWindowLimiter.getStats(),
      tokenBucket: tokenBucketLimiter.getStats(),
      leakyBucket: leakyBucketLimiter.getStats(),
      slidingWindowLog: slidingWindowLogLimiter.getStats(),
      slidingWindowCounter: slidingWindowCounterLimiter.getStats(),
      priorityTokenBucket: priorityTokenBucketLimiter.getStats(),
      reputationBased: reputationBasedLimiter.getStats(),
      hybridAdaptive: hybridAdaptiveLimiter.getStats()
    }
  });
});

/**
 * Algorithm comparison endpoint
 */
app.get('/algorithms', (req, res) => {
  res.json({
    available: [
      {
        name: 'FixedWindow',
        endpoint: '/api/fixed/*',
        description: 'Fixed time windows with request counting',
        complexity: { time: 'O(1)', space: 'O(1)' },
        accuracy: 'Poor',
        bestFor: 'Simple use cases, learning'
      },
      {
        name: 'TokenBucket',
        endpoint: '/api/token/*',
        description: 'Token-based with burst capability',
        complexity: { time: 'O(1)', space: 'O(1)' },
        accuracy: 'Good',
        bestFor: 'Production APIs, bursty traffic'
      },
      {
        name: 'LeakyBucket',
        endpoint: '/api/leaky/*',
        description: 'Constant rate processing',
        complexity: { time: 'O(1)', space: 'O(1)' },
        accuracy: 'Good',
        bestFor: 'Network QoS, constant rate'
      },
      {
        name: 'SlidingWindowLog',
        endpoint: '/api/sliding/*',
        description: 'Precise sliding window with timestamps',
        complexity: { time: 'O(n)', space: 'O(n)' },
        accuracy: 'Perfect',
        bestFor: 'Low-traffic, perfect accuracy'
      },
      {
        name: 'SlidingWindowCounter',
        endpoint: '/api/counter/*',
        description: 'Efficient sliding window approximation',
        complexity: { time: 'O(1)', space: 'O(1)' },
        accuracy: 'Excellent (~95%)',
        bestFor: 'High-traffic production (RECOMMENDED)'
      },
      {
        name: 'PriorityTokenBucket',
        endpoint: '/api/priority/*',
        description: 'Priority-based token bucket with tiers',
        complexity: { time: 'O(1)', space: 'O(1)' },
        accuracy: 'Good',
        bestFor: 'SaaS, Multi-tenant, Pricing tiers'
      },
      {
        name: 'ReputationBased',
        endpoint: '/api/reputation/*',
        description: 'Adaptive rate limiting based on behavior',
        bestFor: 'Bot protection, Auto-defense, Smart APIs'
      },
      {
        name: 'HybridAdaptive',
        endpoint: '/api/hybrid/*',
        description: 'Ultimate: Priority + Reputation + Endpoint Costs',
        bestFor: 'Production SaaS (BEST)'
      }
    ],
    recommendations: {
      'Most Web APIs': 'SlidingWindowCounter or TokenBucket',
      'High Traffic': 'SlidingWindowCounter',
      'Need Bursts': 'TokenBucket',
      'Bot Protection': 'ReputationBased',
      'Perfect Accuracy': 'SlidingWindowLog',
      'Constant Rate': 'LeakyBucket',
      'SaaS/Multi-tenant': 'PriorityTokenBucket',
      'Learning': 'FixedWindow',
      'Production SaaS': 'HybridAdaptive',
    }
  });
});

/**
 * Get specific algorithm info
 */
app.get('/algorithm/info/:name', (req, res) => {
  const { name } = req.params;

  const algorithms = {
    fixed: {
      name: 'Fixed Window',
      config: fixedWindowLimiter.getStats()
    },
    token: {
      name: 'Token Bucket',
      config: tokenBucketLimiter.getStats()
    },
    leaky: {
      name: 'Leaky Bucket',
      config: leakyBucketLimiter.getStats()
    },
    sliding: {
      name: 'Sliding Window Log',
      config: slidingWindowLogLimiter.getStats()
    },
    counter: {
      name: 'Sliding Window Counter',
      config: slidingWindowCounterLimiter.getStats()
    },
    priority: {
      name: 'Priority Token Bucket',
      config: priorityTokenBucketLimiter.getStats()
    },
    reputation: {
      name: 'Reputation Based',
      config: reputationBasedLimiter.getStats()
    },
    hybrid: { 
      name: 'Hybrid Adaptive', 
      config: hybridAdaptiveLimiter.getStats() 
    }
  };

  const algo = algorithms[name.toLowerCase()];

  if (!algo) {
    return res.status(404).json({
      error: 'Algorithm not found',
      available: ['fixed', 'token', 'leaky', 'sliding', 'counter', 'priority', 'reputation','hybrid']
    });
  }

  res.json(algo);
});

/**
 * Test endpoint
 */
app.get('/test', (req, res) => {
  res.json({
    message: 'Test endpoint - check response headers',
    availableEndpoints: {
      fixedWindow: '/api/fixed/data',
      tokenBucket: '/api/token/data',
      leakyBucket: '/api/leaky/data',
      slidingWindowLog: '/api/sliding/data',
      slidingWindowCounter: '/api/counter/data',
      priorityTokenBucket: '/api/priority/data',
      priorityTiers: '/api/priority/tiers'
    }
  });
});

// ============================================
// Error Handlers
// ============================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
});

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

// ============================================
// Start Server
// ============================================

const PORT = config.server.port;

const server = app.listen(PORT, () => {
  logger.info(`Server started`, {
    port: PORT,
    environment: config.server.env,
    algorithms: [
      'FixedWindow',
      'TokenBucket',
      'LeakyBucket',
      'SlidingWindowLog',
      'SlidingWindowCounter',
      'PriorityTokenBucket',
      'ReputationBased',
      'HybridAdaptive'
    ]
  });

  console.log(`\n🚀 API Rate Limiter Server running on port ${PORT}`);
  console.log(`\n📊 Available Algorithms:`);
  console.log(`   • Fixed Window:           http://localhost:${PORT}/api/fixed/data`);
  console.log(`   • Token Bucket:           http://localhost:${PORT}/api/token/data`);
  console.log(`   • Leaky Bucket:           http://localhost:${PORT}/api/leaky/data`);
  console.log(`   • Sliding Window Log:     http://localhost:${PORT}/api/sliding/data`);
  console.log(`   • Sliding Window Counter: http://localhost:${PORT}/api/counter/data`);
  console.log(`   • Priority Token Bucket:  http://localhost:${PORT}/api/priority/data`);
  console.log(`   • Reputation Based:       http://localhost:${PORT}/api/reputation/data`);
  console.log(`   • Hybrid Adaptive:        http://localhost:${PORT}/api/hybrid/data`);
  console.log(`\n📈 Utilities:`);
  console.log(`   • Metrics:                http://localhost:${PORT}/metrics`);
  console.log(`   • Algorithms Info:        http://localhost:${PORT}/algorithms`);
  console.log(`   • Priority Tiers:         http://localhost:${PORT}/api/priority/tiers`);
  console.log(`   • Health Check:           http://localhost:${PORT}/health`);
  console.log(`\n✨ NEW: Priority Token Bucket - SaaS/Multi-tenant rate limiting!\n`);
});

// ============================================
// Graceful Shutdown
// ============================================

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    fixedWindowLimiter.stop();
    tokenBucketLimiter.stop();
    leakyBucketLimiter.stop();
    slidingWindowLogLimiter.stop();
    slidingWindowCounterLimiter.stop();
    priorityTokenBucketLimiter.stop();
    reputationBasedLimiter.stop();
    hybridAdaptiveLimiter.stop();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    fixedWindowLimiter.stop();
    tokenBucketLimiter.stop();
    leakyBucketLimiter.stop();
    slidingWindowLogLimiter.stop();
    slidingWindowCounterLimiter.stop();
    priorityTokenBucketLimiter.stop();
    reputationBasedLimiter.stop();
    hybridAdaptiveLimiter.stop();
    process.exit(0);
  });
});

module.exports = app;
