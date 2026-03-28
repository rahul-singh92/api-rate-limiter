/**
 * Priority-Based Rate Limiting Middleware
 */
const logger = require('../utils/logger');

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
  
  return 'anonymous';
}

/**
 * Get user identifier for rate limiting
 */
function getUserIdentifier(req, tier) {
  // Check X-Forwarded-For header
  let ip = req.headers['x-forwarded-for'];
  
  if (!ip) {
    ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  }
  
  // Extract first IP if comma-separated
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  
  // Clean up IPv6
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }
  
  return `${tier}:${ip}`;
}

/**
 * Create priority rate limiter middleware
 */
function createPriorityRateLimiter(limiter) {
  return async (req, res, next) => {
    const userTier = getUserTier(req);
    const clientId = getUserIdentifier(req, userTier);
    
    try {
      const result = await limiter.check(clientId, userTier, 1);
      
      // Set response headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Algorithm', result.algorithm);
      res.setHeader('X-RateLimit-Tier', result.tier.name);
      res.setHeader('X-RateLimit-Priority', result.tier.priority);
      res.setHeader('X-RateLimit-Weight', result.tier.weight);
      
      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter);
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded for ${result.tier.name} tier`,
          tier: result.tier,
          retryAfter: result.retryAfter + 's',
          upgradeMessage: result.tier.name === 'Anonymous' 
            ? 'Authenticate for higher limits'
            : result.tier.name === 'Free'
            ? 'Upgrade to Premium for 4x higher limits'
            : 'Consider Enterprise for dedicated resources'
        });
      }
      
      // Add tier info to response
      req.rateLimit = result;
      
      next();
      
    } catch (error) {
      logger.error('Rate limiter error', {
        error: error.message,
        clientId,
        userTier
      });
      
      // Fail open
      next();
    }
  };
}

module.exports = createPriorityRateLimiter;
