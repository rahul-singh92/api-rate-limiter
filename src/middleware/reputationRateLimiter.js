/**
 * Reputation-Based Rate Limiting Middleware
 */

const logger = require('../utils/logger');
const { getClientId } = require('../utils/clientId');

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
      res.setHeader('X-RateLimit-Client-ID', clientId); // Added for debugging
      
      if (!result.allowed) {
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
      
      // Store info for response
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
          path: req.path
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
      logger.error('Reputation rate limiter error', {
        error: error.message,
        clientId
      });
      
      next();
    }
  };
}

module.exports = createReputationRateLimiter;