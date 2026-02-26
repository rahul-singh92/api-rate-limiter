/**
 * Sliding Window Log Algorithm Tests
 */

const SlidingWindowLogRateLimiter = require('../src/algorithms/SlidingWindowLog');

describe('SlidingWindowLog Rate Limiter', () => {
    let limiter;

    beforeEach(() => {
        limiter = new SlidingWindowLogRateLimiter({
            windowMs: 1000, // 1 second for faster tests
            maxRequests: 5
        });
    });

    afterEach(() => {
        limiter.stop();
    });

    test('should allow requests within limit', async () => {
        const clientId = 'test-client-1';

        for (let i = 0; i < 5; i++) {
            const result = await limiter.check(clientId);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(5 - i - 1);
        }
    });

    test('should block requests exceeding limit', async () => {
        const clientId = 'test-client-2';

        // Use up the limit
        for (let i = 0; i < 5; i++) {
            await limiter.check(clientId);
        }

        // This should be blocked
        const result = await limiter.check(clientId);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    test('should have no boundary problem', async () => {
        const clientId = 'test-client-3';

        // Make 5 requests
        for (let i = 0; i < 5; i++) {
            await limiter.check(clientId);
        }

        // Wait 100ms (not a full window)
        await new Promise(resolve => setTimeout(resolve, 100));

        // Should still be blocked (sliding window, not reset)
        const result = await limiter.check(clientId);
        expect(result.allowed).toBe(false);
    });

    test('should allow requests after they slide out of window', async () => {
        const clientId = 'test-client-4';

        // Make 5 requests
        for (let i = 0; i < 5; i++) {
            await limiter.check(clientId);
        }

        // Wait for window to pass
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Should be allowed again (all timestamps slid out)
        const result = await limiter.check(clientId);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4);
    });

    test('should handle gradual expiration', async () => {
        const clientId = 'test-client-5';

        // Make request 1
        await limiter.check(clientId);

        // Wait 600ms
        await new Promise(resolve => setTimeout(resolve, 600));

        // Make 4 more requests
        for (let i = 0; i < 4; i++) {
            await limiter.check(clientId);
        }

        // All 5 in window, should block
        let result = await limiter.check(clientId);
        expect(result.allowed).toBe(false);

        // Wait 500ms more (first request should expire)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Should allow now (first request slid out)
        result = await limiter.check(clientId);
        expect(result.allowed).toBe(true);
    });

    test('should store timestamps accurately', async () => {
        const clientId = 'test-client-6';

        // Make 3 requests
        for (let i = 0; i < 3; i++) {
            await limiter.check(clientId);
        }

        const state = limiter.getLogState(clientId);
        expect(state.totalRequests).toBe(3);
        expect(state.timestamps).toHaveLength(3);
        expect(state.remaining).toBe(2);
    });

    test('should handle multiple clients independently', async () => {
        const result1 = await limiter.check('client-A');
        const result2 = await limiter.check('client-B');

        expect(result1.allowed).toBe(true);
        expect(result2.allowed).toBe(true);

        const state1 = limiter.getLogState('client-A');
        const state2 = limiter.getLogState('client-B');

        expect(state1.totalRequests).toBe(1);
        expect(state2.totalRequests).toBe(1);
    });

    test('should clean old timestamps', async () => {
        const clientId = 'test-client-7';

        // Make 5 requests
        for (let i = 0; i < 5; i++) {
            await limiter.check(clientId);
        }

        let state = limiter.getLogState(clientId);
        expect(state.totalRequests).toBe(5);

        // Wait for all to expire
        await new Promise(resolve => setTimeout(resolve, 1100));

        state = limiter.getLogState(clientId);
        expect(state.totalRequests).toBe(0);
    });

    test('should provide accurate metadata', async () => {
        const clientId = 'test-client-8';

        await limiter.check(clientId);
        const result = await limiter.check(clientId);

        expect(result.metadata.requestsInWindow).toBe(2);
        expect(result.metadata.windowMs).toBe(1000);
        expect(result.metadata.oldestRequest).toBeDefined();
        expect(result.metadata.newestRequest).toBeDefined();
    });
});
