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
const SlidingWindowCounterRateLimiter = require('./SlidingWindowCounter');
const PriorityTokenBucketRateLimiter = require('./PriorityTokenBucket');
const ReputationBasedRateLimiter = require('./ReputationBasedRateLimiter');
const HybridAdaptiveRateLimiter = require('./HybridAdaptiveRateLimiter');
const CpuAdaptiveRateLimiter = require('./CpuAdaptiveRateLimiter');

module.exports = {
  FixedWindow: FixedWindowRateLimiter,
  TokenBucket: TokenBucketRateLimiter,
  LeakyBucket: LeakyBucketRateLimiter,
  SlidingWindowLog: SlidingWindowLogRateLimiter,
  SlidingWindowCounter: SlidingWindowCounterRateLimiter,
  PriorityTokenBucket: PriorityTokenBucketRateLimiter,
  ReputationBased: ReputationBasedRateLimiter,
  HybridAdaptive: HybridAdaptiveRateLimiter,
  CpuAdaptive: CpuAdaptiveRateLimiter,
  // Future algorithms will be added here:
};
