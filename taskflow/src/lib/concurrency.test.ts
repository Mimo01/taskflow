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

  it('setJiraConcurrencyLimit(3) causes subsequent calls to use concurrency 3', async () => {
    const { getJiraLimit, setJiraConcurrencyLimit } = await import('./concurrency');
    setJiraConcurrencyLimit(3);
    const limit = getJiraLimit();

    const running: number[] = [];
    let maxConcurrent = 0;

    const tasks = Array.from({ length: 8 }, (_, i) =>
      limit(async () => {
        running.push(i);
        maxConcurrent = Math.max(maxConcurrent, running.length);
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
        running.splice(running.indexOf(i), 1);
        return i;
      }),
    );

    await Promise.all(tasks);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it('setJiraConcurrencyLimit(6) when already 6 does NOT create a new instance (no-op)', async () => {
    const { getJiraLimit, setJiraConcurrencyLimit } = await import('./concurrency');
    const limitBefore = getJiraLimit();
    setJiraConcurrencyLimit(6); // already 6 -- should be a no-op
    const limitAfter = getJiraLimit();
    expect(limitBefore).toBe(limitAfter); // same reference
  });
});
