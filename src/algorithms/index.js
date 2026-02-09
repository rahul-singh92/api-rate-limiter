/**
 * Rate Limiting Algorithms Export
 * 
 * This module exports all available rate limiting algorithms.
 * As we add more algorithms, they'll be exported from here.
 */

const FixedWindowRateLimiter = require('./FixedWindow');

module.exports = {
  FixedWindow: FixedWindowRateLimiter,
  // Future algorithms will be added here:
  // TokenBucket: require('./TokenBucket'),
  // LeakyBucket: require('./LeakyBucket'),
  // SlidingWindow: require('./SlidingWindow'),
};
