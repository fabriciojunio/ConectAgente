import { rateLimit } from '../rateLimit';

describe('rateLimit', () => {
  it('should allow requests within limit', async () => {
    const result = await rateLimit('test-allow', 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });

  it('should block requests exceeding limit', async () => {
    const key = 'test-block-' + Date.now();

    // Make 3 requests (limit is 3)
    await rateLimit(key, 3, 60000);
    await rateLimit(key, 3, 60000);
    await rateLimit(key, 3, 60000);

    // 4th should be blocked
    const result = await rateLimit(key, 3, 60000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('should reset after window expires', async () => {
    const key = 'test-reset-' + Date.now();

    // Make 2 requests with 50ms window
    await rateLimit(key, 2, 50);
    await rateLimit(key, 2, 50);

    // Should be blocked
    const blocked = await rateLimit(key, 2, 50);
    expect(blocked.allowed).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 60));

    // Should be allowed again
    const allowed = await rateLimit(key, 2, 50);
    expect(allowed.allowed).toBe(true);
  });

  it('should track different identifiers independently', async () => {
    const key1 = 'user-a-' + Date.now();
    const key2 = 'user-b-' + Date.now();

    // Exhaust key1
    await rateLimit(key1, 1, 60000);
    const blocked = await rateLimit(key1, 1, 60000);
    expect(blocked.allowed).toBe(false);

    // key2 should still work
    const allowed = await rateLimit(key2, 1, 60000);
    expect(allowed.allowed).toBe(true);
  });
});
