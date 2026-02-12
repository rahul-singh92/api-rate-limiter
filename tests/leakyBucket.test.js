/**
 * Leaky Bucket Algorithm Tests
 */

const LeakyBucketRateLimiter = require('../src/algorithms/LeakyBucket');

describe('LeakyBucket Rate Limiter', () => {
    let limiter;

    beforeEach(() => {
        limiter = new LeakyBucketRateLimiter({
            capacity: 10,
            leakRate: 5, // 5 requests per second
            queueRequests: false
        });
    });

    afterEach(() => {
        limiter.stop();
    });

    test('should allow requests when bucket has space', async () => {
        const result = await limiter.check('client-1');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBeLessThan(10);
    });

    test('should block when bucket is full', async () => {
        const clientId = 'client-2';

        // Fill the bucket
        for (let i = 0; i < 10; i++) {
            await limiter.check(clientId);
        }

        // Should be blocked now
        const result = await limiter.check(clientId);
        expect(result.allowed).toBe(false);
    });

    test('should leak requests over time', async () => {
        const clientId = 'client-3';

        // Fill bucket completely
        for (let i = 0; i < 10; i++) {
            await limiter.check(clientId);
        }

        // Wait 1 second (should leak 5 requests)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Should allow 5 more requests
        for (let i = 0; i < 5; i++) {
            const result = await limiter.check(clientId);
            expect(result.allowed).toBe(true);
        }
    });

    test('should maintain constant leak rate', async () => {
        const clientId = 'client-4';

        // Fill bucket
        for (let i = 0; i < 10; i++) {
            await limiter.check(clientId);
        }

        const state1 = limiter.getBucketState(clientId);
        expect(state1.size).toBe(10);

        // Wait 2 seconds (should leak all 10 at 5/sec)
        await new Promise(resolve => setTimeout(resolve, 2000));

        const state2 = limiter.getBucketState(clientId);
        expect(state2.size).toBeLessThanOrEqual(0.1); // Account for timing variations
    });

    test('should reject bursts even with empty bucket', async () => {
        const clientId = 'client-5';

        // Try to burst 15 requests
        const results = [];
        for (let i = 0; i < 15; i++) {
            const result = await limiter.check(clientId);
            results.push(result.allowed);
        }

        const allowedCount = results.filter(r => r === true).length;
        expect(allowedCount).toBe(10); // Only capacity allowed
    });

    test('should handle multiple clients independently', async () => {
        const result1 = await limiter.check('client-A');
        const result2 = await limiter.check('client-B');

        expect(result1.allowed).toBe(true);
        expect(result2.allowed).toBe(true);

        const state1 = limiter.getBucketState('client-A');
        const state2 = limiter.getBucketState('client-B');

        expect(state1.size).toBeGreaterThan(0);
        expect(state2.size).toBeGreaterThan(0);
    });

    test('should calculate correct wait time', async () => {
        const clientId = 'client-6';

        // Fill bucket
        for (let i = 0; i < 10; i++) {
            await limiter.check(clientId);
        }

        const result = await limiter.check(clientId);
        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBeGreaterThan(0);

        // Wait time should be approximately size/leakRate
        const expectedWait = 1 / 5; // 1 request at 5 req/sec = 0.2s
        expect(result.retryAfter).toBeCloseTo(expectedWait, 0);
    });
});
