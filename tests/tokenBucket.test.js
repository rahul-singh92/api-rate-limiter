/**
 * Token Bucket Algorithm Tests
 */

const TokenBucketRateLimiter = require('../src/algorithms/TokenBucket');

describe('TokenBucket Rate Limiter', () => {
    let limiter;

    beforeEach(() => {
        limiter = new TokenBucketRateLimiter({
            capacity: 10,
            refillRate: 5, // 5 tokens per second
            tokensPerRequest: 1
        });
    });

    afterEach(() => {
        limiter.stop();
    });

    test('should allow requests when tokens available', async () => {
        const result = await limiter.check('client-1');
        expect(result.allowed).toBe(true);
        expect(result.metadata.tokensRemaining).toBeLessThan(10);
    });

    test('should block when bucket is empty', async () => {
        const clientId = 'client-2';

        // Drain the bucket
        for (let i = 0; i < 10; i++) {
            await limiter.check(clientId);
        }

        // Should be blocked now
        const result = await limiter.check(clientId);
        expect(result.allowed).toBe(false);
    });

    test('should refill tokens over time', async () => {
        const clientId = 'client-3';

        // Use 5 tokens
        for (let i = 0; i < 5; i++) {
            await limiter.check(clientId);
        }

        // Wait 1 second (should get 5 tokens back)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Should allow 5 more requests
        for (let i = 0; i < 5; i++) {
            const result = await limiter.check(clientId);
            expect(result.allowed).toBe(true);
        }
    });

    test('should not exceed capacity', async () => {
        const clientId = 'client-4';

        // Wait 5 seconds (would give 25 tokens, but cap is 10)
        await new Promise(resolve => setTimeout(resolve, 5000));

        const state = limiter.getBucketState(clientId);
        expect(state).toBeNull(); // Bucket doesn't exist yet

        await limiter.check(clientId);
        const newState = limiter.getBucketState(clientId);
        expect(newState.tokens).toBeLessThanOrEqual(10);
    });

    test('should handle burst traffic', async () => {
        const clientId = 'client-5';

        // Should handle burst of 10 (full capacity)
        const results = [];
        for (let i = 0; i < 10; i++) {
            const result = await limiter.check(clientId);
            results.push(result.allowed);
        }

        const allAllowed = results.every(r => r === true);
        expect(allAllowed).toBe(true);
    });

    test('should track multiple clients independently', async () => {
        const result1 = await limiter.check('client-A');
        const result2 = await limiter.check('client-B');

        expect(result1.allowed).toBe(true);
        expect(result2.allowed).toBe(true);

        const state1 = limiter.getBucketState('client-A');
        const state2 = limiter.getBucketState('client-B');

        expect(state1.tokens).toBeLessThan(10);
        expect(state2.tokens).toBeLessThan(10);
    });
});
