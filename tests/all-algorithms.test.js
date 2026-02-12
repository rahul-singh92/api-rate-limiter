/**
 * Test Suite for All Algorithms
 */

const FixedWindow = require('../src/algorithms/FixedWindow');
const TokenBucket = require('../src/algorithms/TokenBucket');
const LeakyBucket = require('../src/algorithms/LeakyBucket');

describe('All Rate Limiting Algorithms', () => {
  describe('Algorithm Initialization', () => {
    test('Fixed Window initializes correctly', () => {
      const limiter = new FixedWindow({ windowMs: 60000, maxRequests: 100 });
      expect(limiter.windowMs).toBe(60000);
      expect(limiter.maxRequests).toBe(100);
      limiter.stop();
    });

    test('Token Bucket initializes correctly', () => {
      const limiter = new TokenBucket({ capacity: 100, refillRate: 10 });
      expect(limiter.capacity).toBe(100);
      expect(limiter.refillRate).toBe(10);
      limiter.stop();
    });

    test('Leaky Bucket initializes correctly', () => {
      const limiter = new LeakyBucket({ capacity: 100, leakRate: 10 });
      expect(limiter.capacity).toBe(100);
      expect(limiter.leakRate).toBe(10);
      limiter.stop();
    });
  });

  describe('Basic Functionality', () => {
    test('All algorithms allow initial requests', async () => {
      const fixed = new FixedWindow({ windowMs: 60000, maxRequests: 100 });
      const token = new TokenBucket({ capacity: 100, refillRate: 10 });
      const leaky = new LeakyBucket({ capacity: 100, leakRate: 10 });

      const fixedResult = await fixed.check('test-client');
      const tokenResult = await token.check('test-client');
      const leakyResult = await leaky.check('test-client');

      expect(fixedResult.allowed).toBe(true);
      expect(tokenResult.allowed).toBe(true);
      expect(leakyResult.allowed).toBe(true);

      fixed.stop();
      token.stop();
      leaky.stop();
    });

    test('All algorithms block when limit exceeded', async () => {
      const fixed = new FixedWindow({ windowMs: 60000, maxRequests: 5 });
      const token = new TokenBucket({ capacity: 5, refillRate: 1 });
      const leaky = new LeakyBucket({ capacity: 5, leakRate: 1 });

      const clientId = 'test-client';

      // Exhaust all limits
      for (let i = 0; i < 5; i++) {
        await fixed.check(clientId);
        await token.check(clientId);
        await leaky.check(clientId);
      }

      // Should all block now
      const fixedResult = await fixed.check(clientId);
      const tokenResult = await token.check(clientId);
      const leakyResult = await leaky.check(clientId);

      expect(fixedResult.allowed).toBe(false);
      expect(tokenResult.allowed).toBe(false);
      expect(leakyResult.allowed).toBe(false);

      fixed.stop();
      token.stop();
      leaky.stop();
    });
  });

  describe('Algorithm Stats', () => {
    test('All algorithms provide stats', () => {
      const fixed = new FixedWindow({ windowMs: 60000, maxRequests: 100 });
      const token = new TokenBucket({ capacity: 100, refillRate: 10 });
      const leaky = new LeakyBucket({ capacity: 100, leakRate: 10 });

      const fixedStats = fixed.getStats();
      const tokenStats = token.getStats();
      const leakyStats = leaky.getStats();

      expect(fixedStats.algorithm).toBe('FixedWindow');
      expect(tokenStats.algorithm).toBe('TokenBucket');
      expect(leakyStats.algorithm).toBe('LeakyBucket');

      expect(fixedStats.activeClients).toBeDefined();
      expect(tokenStats.activeBuckets).toBeDefined();
      expect(leakyStats.activeBuckets).toBeDefined();

      fixed.stop();
      token.stop();
      leaky.stop();
    });
  });

  describe('Reset Functionality', () => {
    test('All algorithms can reset', async () => {
      const fixed = new FixedWindow({ windowMs: 60000, maxRequests: 100 });
      const token = new TokenBucket({ capacity: 100, refillRate: 10 });
      const leaky = new LeakyBucket({ capacity: 100, leakRate: 10 });

      // Make some requests
      await fixed.check('client');
      await token.check('client');
      await leaky.check('client');

      // Reset
      fixed.reset();
      token.reset();
      leaky.reset();

      // Check stats
      const fixedStats = fixed.getStats();
      const tokenStats = token.getStats();
      const leakyStats = leaky.getStats();

      expect(fixedStats.activeClients).toBe(0);
      expect(tokenStats.activeBuckets).toBe(0);
      expect(leakyStats.activeBuckets).toBe(0);

      fixed.stop();
      token.stop();
      leaky.stop();
    });
  });
});
