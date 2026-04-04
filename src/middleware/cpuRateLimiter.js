/**
 * CPU-Based Adaptive Rate Limiting Middleware
 * 
 * Automatically adjusts rate limits based on system CPU usage
 */

const logger = require('../utils/logger');
const { getClientId } = require('../utils/clientId');

/**
 * Create CPU adaptive rate limiter middleware
 */
function createCpuRateLimiter(limiter) {
  return async (req, res, next) => {
    const clientId = getClientId(req);
    
    try {
      // Check rate limit
      const result = await limiter.check(clientId, 1);
      
      // Set response headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Algorithm', result.algorithm);
      res.setHeader('X-RateLimit-CPU-Level', result.cpuStatus.level);
      res.setHeader('X-RateLimit-CPU-Usage', result.cpuStatus.cpuUsage);
      res.setHeader('X-RateLimit-CPU-Multiplier', result.cpuStatus.multiplier);
      res.setHeader('X-RateLimit-Actual-Capacity', result.limits.actualCapacity);
      res.setHeader('X-RateLimit-Base-Capacity', result.limits.baseCapacity);
      
      if (!result.allowed) {
        // Rate limit exceeded
        res.setHeader('Retry-After', result.retryAfter);
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. System CPU: ${result.cpuStatus.cpuUsage} (${result.cpuStatus.level})`,
          cpuStatus: result.cpuStatus,
          limits: result.limits,
          retryAfter: result.retryAfter + 's',
          explanation: result.cpuStatus.level === 'CRITICAL' || result.cpuStatus.level === 'EMERGENCY'
            ? 'System is under heavy load. Rate limits have been automatically reduced to protect the service.'
            : result.cpuStatus.level === 'HIGH'
            ? 'System CPU usage is high. Rate limits have been temporarily reduced.'
            : 'Rate limit exceeded. Please wait and try again.'
        });
      }
      
      // Store rate limit info
      req.rateLimit = result;
      req.rateLimitClientId = clientId;
      
      next();
      
    } catch (error) {
      logger.error('CPU rate limiter error', {
        error: error.message,
        clientId
      });
      
      // Fail open
      next();
    }
  };
}

module.exports = createCpuRateLimiter;