// /**
//  * Client ID Utilities
//  * 
//  * Consistent client identification across the application
//  */

// /**
//  * Extract client ID from request
//  * This MUST match the logic used in all middlewares
//  * 
//  * @param {Object} req - Express request object
//  * @returns {string} Client identifier
//  */
// function getClientId(req) {
//   // Check X-Forwarded-For header (for proxies and testing)
//   let ip = req.headers['x-forwarded-for'];
  
//   if (!ip) {
//     ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
//   }
  
//   // Extract first IP if comma-separated list
//   if (ip.includes(',')) {
//     ip = ip.split(',')[0].trim();
//   }
  
//   // Clean up IPv6 localhost variations
//   if (ip === '::1' || ip === '::ffff:127.0.0.1') {
//     ip = '127.0.0.1';
//   }
  
//   return ip;
// }

// module.exports = {
//   getClientId
// };


function getClientId(req) {
  // ✅ 1. PRIORITY: Custom header (for tests + control)
  if (req.headers['x-client-id']) {
    return req.headers['x-client-id'];
  }

  // ✅ 2. Fallback: X-Forwarded-For
  let ip = req.headers['x-forwarded-for'];

  if (!ip) {
    ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  }

  // Handle multiple IPs (proxy chain)
  if (typeof ip === 'string' && ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }

  // Normalize localhost variations
  if (
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost'
  ) {
    ip = '127.0.0.1';
  }

  return ip;
}

module.exports = {
  getClientId
};