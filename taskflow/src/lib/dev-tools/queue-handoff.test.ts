import { describe, expect, it } from 'vitest';
import { queueSplit, runWithQueuedAt, takeQueuedAt } from './queue-handoff';

describe('queue-handoff', () => {
  it('hands the value to the first take only', () => {
    expect(runWithQueuedAt(100, () => takeQueuedAt())).toBe(100);
    expect(
      runWithQueuedAt(100, () => {
        takeQueuedAt();
        return takeQueuedAt();
      }),
    ).toBeUndefined();
  });

  it('clears after fn returns, including when it throws', () => {
    runWithQueuedAt(5, () => 1);
    expect(takeQueuedAt()).toBeUndefined();
    expect(() =>
      runWithQueuedAt(5, () => {
        throw new Error('x');
      }),
    ).toThrow('x');
    expect(takeQueuedAt()).toBeUndefined();
  });

  it('gives undefined after an await (documented best-effort limit)', async () => {
    const v = await runWithQueuedAt(100, async () => {
      await Promise.resolve();
      return takeQueuedAt();
    });
    expect(v).toBeUndefined();
  });

  it('queueSplit separates queue and network time', () => {
    expect(queueSplit({ queuedAt: 1000, startedAt: 1120.4, durationMs: 192 })).toEqual({
      queuedMs: 120,
      networkMs: 192,
    });
    expect(queueSplit({ startedAt: 1, durationMs: 3 }).queuedMs).toBeNull();
  });
});
