/**
 * Hybrid Adaptive Rate Limiting Middleware
 * 
 * Combines priority levels, endpoint costs, and reputation tracking
 */

const logger = require('../utils/logger');
const { getClientId } = require('../utils/clientId');

/**
 * Extract user tier from request
 */
function getUserTier(req) {
  if (req.headers['x-user-tier']) {
    return req.headers['x-user-tier'].toLowerCase();
  }
  
  if (req.query.tier) {
    return req.query.tier.toLowerCase();
  }
  
  // In production, check authentication
  // if (req.user && req.user.subscription) {
  //   return req.user.subscription.tier;
  // }
  
  return 'free';
}

/**
 * Create hybrid adaptive rate limiter middleware
 */
function createHybridRateLimiter(limiter) {
  return async (req, res, next) => {
    const clientId = getClientId(req);
    const userTier = getUserTier(req);
    const method = req.method;
    const path = req.path;
    
    try {
      // Check rate limit with endpoint cost
      const result = await limiter.check(clientId, userTier, method, path);
      
      // Set response headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Algorithm', result.algorithm);
      res.setHeader('X-RateLimit-Tier', result.tier.name);
      res.setHeader('X-RateLimit-Priority', result.tier.priority);
      res.setHeader('X-RateLimit-Endpoint-Cost', result.endpoint.cost);
      res.setHeader('X-RateLimit-Reputation-Multiplier', result.reputation.multiplier);
      res.setHeader('X-RateLimit-Actual-Rate', result.performance.actualRefillRate);
      
      if (!result.allowed) {
        // Rate limit exceeded
        res.setHeader('Retry-After', result.retryAfter);
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Tier: ${result.tier.name}, Endpoint cost: ${result.endpoint.cost} tokens`,
          tier: result.tier,
          endpoint: result.endpoint,
          reputation: result.reputation,
          performance: result.performance,
          retryAfter: result.retryAfter + 's',
          tokensNeeded: result.endpoint.cost,
          tokensAvailable: result.remaining,
          improvement: result.reputation.multiplier < 1.0
            ? `Your reputation multiplier is ${result.reputation.multiplier}. Improve success rate to get better limits.`
            : result.tier.name === 'Anonymous' || result.tier.name === 'Free'
            ? `Upgrade to ${result.tier.name === 'Anonymous' ? 'Free' : 'Premium'} tier for ${result.tier.name === 'Anonymous' ? '5x' : '4x'} higher limits`
            : 'Wait for tokens to refill'
        });
      }
      
      // Store info for outcome reporting
      req.rateLimit = result;
      req.rateLimitClientId = clientId;
      
      // Intercept response to report outcome
      const originalSend = res.send;
      const originalJson = res.json;
      
      let outcomeReported = false;
      
      const reportOutcome = async () => {
        if (outcomeReported) return;
        outcomeReported = true;
        
        const statusCode = res.statusCode;
        const success = statusCode >= 200 && statusCode < 400;
        
        await limiter.reportOutcome(clientId, success, statusCode);
        
        logger.debug('Request outcome reported', {
          clientId,
          statusCode,
          success,
          method,
          path
        });
      };
      
      res.send = function(data) {
        reportOutcome();
        return originalSend.call(this, data);
      };
      
      res.json = function(data) {
        reportOutcome();
        return originalJson.call(this, data);
      };
      
      res.on('finish', () => {
        reportOutcome();
      });
      
      next();
      
    } catch (error) {
      logger.error('Hybrid rate limiter error', {
        error: error.message,
        clientId,
        userTier
      });
      
      // Fail open
      next();
    }
  };
}

module.exports = createHybridRateLimiter;