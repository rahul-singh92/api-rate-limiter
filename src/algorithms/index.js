/**
 * Rate Limiting Algorithms Export
 * 
 * This module exports all available rate limiting algorithms.
 * As we add more algorithms, they'll be exported from here.
 */

const FixedWindowRateLimiter = require('./FixedWindow');
const TokenBucketRateLimiter = require('./TokenBucket');
const LeakyBucketRateLimiter = require('./LeakyBucket');
const SlidingWindowLogRateLimiter = require('./SlidingWindowLog');

module.exports = {
  FixedWindow: FixedWindowRateLimiter,
  TokenBucket: TokenBucketRateLimiter,
  LeakyBucket: LeakyBucketRateLimiter,
  SlidingWindowLog: SlidingWindowLogRateLimiter,
  // Future algorithms will be added here:
  // SlidingWindow: require('./SlidingWindow'),
};
