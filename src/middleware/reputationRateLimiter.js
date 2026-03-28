/**
 * Reputation-Based Rate Limiting Middleware
 * 
 * This middleware applies reputation-based rate limiting and
 * automatically reports request outcomes to update reputation scores
 */

const logger = require('../utils/logger');

/**
 * Get client identifier
 */
function getClientId(req) {
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
  
  // In production, you might also include user ID
  // if (req.user && req.user.id) {
  //   return `user:${req.user.id}`;
  // }
  
  return ip;
}

/**
 * Create reputation rate limiter middleware
 */
function createReputationRateLimiter(limiter) {
  return async (req, res, next) => {
    const clientId = getClientId(req);
    
    try {
      // Check rate limit
      const result = await limiter.check(clientId, 1);
      
      // Set response headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Algorithm', result.algorithm);
      res.setHeader('X-RateLimit-Reputation-Score', result.reputation.score);
      res.setHeader('X-RateLimit-Reputation-Tier', result.reputation.tier);
      res.setHeader('X-RateLimit-Success-Rate', result.reputation.successRate);
      
      if (!result.allowed) {
        // Rate limit exceeded
        res.setHeader('Retry-After', result.retryAfter);
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Your reputation tier: ${result.reputation.tier}`,
          reputation: result.reputation,
          retryAfter: result.retryAfter + 's',
          improvement: result.reputation.tier === 'Malicious' || result.reputation.tier === 'Bad'
            ? 'Reduce errors and invalid requests to improve your reputation'
            : result.reputation.tier === 'Poor'
            ? 'Make valid requests to improve your reputation score'
            : 'Wait for rate limit to reset'
        });
      }
      
      // Store rate limit info and clientId for later outcome reporting
      req.rateLimit = result;
      req.rateLimitClientId = clientId;
      
      // Intercept response to report outcome
      const originalSend = res.send;
      const originalJson = res.json;
      
      // Flag to ensure we only report once
      let outcomeReported = false;
      
      const reportOutcome = async () => {
        if (outcomeReported) return;
        outcomeReported = true;
        
        const statusCode = res.statusCode;
        const success = statusCode >= 200 && statusCode < 400;
        
        // Report outcome to update reputation
        await limiter.reportOutcome(clientId, success, statusCode);
        
        logger.debug('Request outcome reported', {
          clientId,
          statusCode,
          success,
          path: req.path
        });
      };
      
      // Override res.send
      res.send = function(data) {
        reportOutcome();
        return originalSend.call(this, data);
      };
      
      // Override res.json
      res.json = function(data) {
        reportOutcome();
        return originalJson.call(this, data);
      };
      
      // Also handle response finish event as fallback
      res.on('finish', () => {
        reportOutcome();
      });
      
      next();
      
    } catch (error) {
      logger.error('Reputation rate limiter error', {
        error: error.message,
        clientId
      });
      
      // Fail open
      next();
    }
  };
}

module.exports = createReputationRateLimiter;