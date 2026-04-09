/**
 * ML-Assisted Rate Limiting Middleware
 * 
 * Intelligent rate limiting using machine learning
 */

const { getClientId } = require('../utils/clientId');

/**
 * Create ML-assisted rate limiter middleware
 */
function createMLRateLimiter(limiter) {
  return async (req, res, next) => {
    const clientId = getClientId(req);
    const startTime = Date.now();
    
    try {
      // Prepare request info for feature extraction
      const requestInfo = {
        endpoint: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'] || 'unknown',
        timestamp: startTime
      };
      
      // Check rate limit
      const result = await limiter.check(clientId, requestInfo);
      
      // Set response headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Algorithm', result.algorithm);
      res.setHeader('X-RateLimit-ML-Score', result.ml.anomalyScore);
      res.setHeader('X-RateLimit-ML-Classification', result.ml.classification);
      res.setHeader('X-RateLimit-ML-Trained', result.ml.modelTrained);
      res.setHeader('X-RateLimit-Multiplier', result.limits.multiplier);
      
      if (!result.allowed) {
        // Rate limit exceeded
        res.setHeader('Retry-After', result.retryAfter);
        
        // Record the blocked request
        limiter.recordRequest(clientId, requestInfo, {
          statusCode: 429,
          responseTime: Date.now() - startTime,
          payloadSize: 0
        });
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Classification: ${result.ml.classification}`,
          ml: result.ml,
          limits: result.limits,
          retryAfter: result.retryAfter + 's',
          explanation: result.ml.classification === 'THREAT'
            ? 'Your traffic pattern appears highly suspicious (anomaly score: ' + result.ml.anomalyScore + '). If you believe this is an error, please contact support.'
            : result.ml.classification === 'SUSPICIOUS'
            ? 'Your traffic pattern is unusual. Rate limits have been reduced as a precaution.'
            : 'Please slow down your requests and try again.'
        });
      }
      
      // Store info for recording after response
      req.rateLimit = result;
      req.rateLimitClientId = clientId;
      req.rateLimitRequestInfo = requestInfo;
      req.rateLimitStartTime = startTime;
      
      // Intercept response to record outcome
      const originalSend = res.send;
      const originalJson = res.json;
      
      let outcomeRecorded = false;
      
      const recordOutcome = () => {
        if (outcomeRecorded) return;
        outcomeRecorded = true;
        
        const responseTime = Date.now() - startTime;
        const statusCode = res.statusCode;
        const payloadSize = res.getHeader('Content-Length') || 0;
        
        limiter.recordRequest(clientId, requestInfo, {
          statusCode,
          responseTime,
          payloadSize
        });
      };
      
      res.send = function(data) {
        recordOutcome();
        return originalSend.call(this, data);
      };
      
      res.json = function(data) {
        recordOutcome();
        return originalJson.call(this, data);
      };
      
      res.on('finish', () => {
        recordOutcome();
      });
      
      next();
      
    } catch (error) {
      console.error('ML rate limiter error:', error.message);
      
      // Fail open - allow request but log error
      next();
    }
  };
}

module.exports = createMLRateLimiter;