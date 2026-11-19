import { afterEach, describe, expect, it, vi } from 'vitest';

// We import from the module under test AFTER vi.mock calls
// concurrency.ts is a singleton module -- reset state between tests
// by re-importing after each test clears module cache

describe('concurrency limiter', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('getJiraLimit returns a callable function (p-limit instance)', async () => {
    const { getJiraLimit } = await import('./concurrency');
    const limit = getJiraLimit();
    expect(typeof limit).toBe('function');
  });

  it('wrapping async functions limits concurrent executions to 6 by default', async () => {
    const { getJiraLimit } = await import('./concurrency');
    const limit = getJiraLimit();

    const running: number[] = [];
    let maxConcurrent = 0;

    const tasks = Array.from({ length: 10 }, (_, i) =>
      limit(async () => {
        running.push(i);
        maxConcurrent = Math.max(maxConcurrent, running.length);
        // Simulate async work
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        running.splice(running.indexOf(i), 1);
        return i;
      }),
    );

    await Promise.all(tasks);
    expect(maxConcurrent).toBeLessThanOrEqual(6);
  });
});
