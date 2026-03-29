/**
 * Client ID Utilities
 * 
 * Consistent client identification across the application
 */

/**
 * Extract client ID from request
 * This MUST match the logic used in all middlewares
 * 
 * @param {Object} req - Express request object
 * @returns {string} Client identifier
 */
function getClientId(req) {
  // Check X-Forwarded-For header (for proxies and testing)
  let ip = req.headers['x-forwarded-for'];
  
  if (!ip) {
    ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  }
  
  // Extract first IP if comma-separated list
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  
  // Clean up IPv6 localhost variations
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }
  
  return ip;
}

module.exports = {
  getClientId
};
