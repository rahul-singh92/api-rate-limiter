/**
 * Sliding Window Counter Algorithm Tests
 */

const SlidingWindowCounterRateLimiter = require('../src/algorithms/SlidingWindowCounter');

describe('SlidingWindowCounter Rate Limiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new SlidingWindowCounterRateLimiter({
      windowMs: 1000, // 1 second for faster tests
      maxRequests: 10
    });
  });

  afterEach(() => {
    limiter.stop();
  });

  test('should allow requests within limit', async () => {
    const clientId = 'test-client-1';
    
    for (let i = 0; i < 10; i++) {
      const result = await limiter.check(clientId);
      expect(result.allowed).toBe(true);
    }
  });

  test('should block requests exceeding limit', async () => {
    const clientId = 'test-client-2';
    
    // Use up the limit
    for (let i = 0; i < 10; i++) {
      await limiter.check(clientId);
    }
    
    // Should be blocked
    const result = await limiter.check(clientId);
    expect(result.allowed).toBe(false);
  });

  test('should have no boundary problem', async () => {
    const clientId = 'test-client-3';
    
    // Make 10 requests
    for (let i = 0; i < 10; i++) {
      await limiter.check(clientId);
    }
    
    // Wait 100ms (not a full window)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should still use weighted count, not reset
    const result = await limiter.check(clientId);
    expect(result.allowed).toBe(false);
  });

  test('should use weighted count correctly', async () => {
    const clientId = 'test-client-4';
    
    // Fill previous window
    for (let i = 0; i < 10; i++) {
      await limiter.check(clientId);
    }
    
    // Wait for new window (1.1 seconds)
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Should be in new window, previous count becomes weighted
    const result = await limiter.check(clientId);
    expect(result.allowed).toBe(true);
    expect(result.metadata.previousWindowCount).toBe(10);
    expect(result.metadata.currentWindowCount).toBe(1);
  });

  test('should shift windows correctly', async () => {
    const clientId = 'test-client-5';
    
    // Make 5 requests in first window
    for (let i = 0; i < 5; i++) {
      await limiter.check(clientId);
    }
    
    let state = limiter.getWindowState(clientId);
    expect(state.currentCount).toBe(5);
    expect(state.previousCount).toBe(0);
    
    // Wait for new window
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Make request in new window
    await limiter.check(clientId);
    
    state = limiter.getWindowState(clientId);
    expect(state.currentCount).toBe(1);
    expect(state.previousCount).toBe(5);
  });

  test('should calculate overlap percentage correctly', async () => {
    const clientId = 'test-client-6';
    
    // Make requests
    await limiter.check(clientId);
    
    // Wait 500ms (halfway through window)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const state = limiter.getWindowState(clientId);
    const overlapPct = parseFloat(state.overlapPercentage);
    
    // Should be around 50%
    expect(overlapPct).toBeGreaterThan(40);
    expect(overlapPct).toBeLessThan(60);
  });

  test('should handle multiple clients independently', async () => {
    const result1 = await limiter.check('client-A');
    const result2 = await limiter.check('client-B');
    
    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
    
    const state1 = limiter.getWindowState('client-A');
    const state2 = limiter.getWindowState('client-B');
    
    expect(state1.currentCount).toBe(1);
    expect(state2.currentCount).toBe(1);
  });

  test('should provide accurate metadata', async () => {
    const clientId = 'test-client-7';
    
    await limiter.check(clientId);
    const result = await limiter.check(clientId);
    
    expect(result.metadata.currentWindowCount).toBeDefined();
    expect(result.metadata.previousWindowCount).toBeDefined();
    expect(result.metadata.weightedCount).toBeDefined();
    expect(result.metadata.overlapPercentage).toBeDefined();
  });

  test('weighted count should be accurate approximation', async () => {
    const clientId = 'test-client-8';
    
    // Fill previous window
    for (let i = 0; i < 10; i++) {
      await limiter.check(clientId);
    }
    
    // Wait 500ms (50% into new window)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const state = limiter.getWindowState(clientId);
    // Weighted count should be around 5 (10 × 50%)
    expect(state.weightedCount).toBeGreaterThan(4);
    expect(state.weightedCount).toBeLessThan(6);
  });
});
