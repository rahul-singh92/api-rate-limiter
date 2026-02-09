/**
 * Fixed Window Algorithm Tests
 */

const FixedWindowRateLimiter = require('../src/algorithms/FixedWindow');

describe('FixedWindow Rate Limiter', () => {
    let limiter;

    beforeEach(() => {
        limiter = new FixedWindowRateLimiter({
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

    test('should reset counter in new window', async () => {
        const clientId = 'test-client-3';

        // Use up the limit
        for (let i = 0; i < 5; i++) {
            await limiter.check(clientId);
        }

        // Wait for new window
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Should be allowed again
        const result = await limiter.check(clientId);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4);
    });

    test('should handle multiple clients independently', async () => {
        const result1 = await limiter.check('client-1');
        const result2 = await limiter.check('client-2');

        expect(result1.allowed).toBe(true);
        expect(result2.allowed).toBe(true);
        expect(result1.remaining).toBe(4);
        expect(result2.remaining).toBe(4);
    });
});
