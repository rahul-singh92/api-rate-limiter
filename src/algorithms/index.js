/**
 * Rate Limiting Algorithms Export
 * 
 * This module exports all available rate limiting algorithms.
 * As we add more algorithms, they'll be exported from here.
 */

const FixedWindowRateLimiter = require('./FixedWindow');
const TokenBucketRateLimiter = require('./TokenBucket');

module.exports = {
  FixedWindow: FixedWindowRateLimiter,
  TokenBucket: TokenBucketRateLimiter,
  // Future algorithms will be added here:
  // LeakyBucket: require('./LeakyBucket'),
  // SlidingWindow: require('./SlidingWindow'),
};
