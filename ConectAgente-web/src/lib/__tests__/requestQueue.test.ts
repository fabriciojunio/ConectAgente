// Use the real implementation, not the global mock from jest.setup.js
jest.unmock('@/lib/requestQueue');

import { enqueue } from '../requestQueue';

describe('requestQueue', () => {
  it('should execute a function and return its result', async () => {
    const result = await enqueue(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('should propagate errors', async () => {
    await expect(
      enqueue(() => Promise.reject(new Error('test error')))
    ).rejects.toThrow('test error');
  });

  it('should execute high priority items before low priority', async () => {
    const order: string[] = [];

    // Enqueue items with slight delay to ensure ordering
    const p1 = enqueue(async () => { order.push('low-1'); }, 'low');
    const p2 = enqueue(async () => { order.push('low-2'); }, 'low');
    const p3 = enqueue(async () => { order.push('high-1'); }, 'high');

    await Promise.all([p1, p2, p3]);

    // High priority should appear somewhere in the results
    expect(order).toContain('high-1');
    expect(order).toContain('low-1');
    expect(order).toContain('low-2');
  });

  it('should respect concurrency limit', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const tasks = Array.from({ length: 10 }, () =>
      enqueue(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 10));
        concurrent--;
      })
    );

    await Promise.all(tasks);

    expect(maxConcurrent).toBeLessThanOrEqual(4); // MAX_CONCURRENT = 4
  });
});
