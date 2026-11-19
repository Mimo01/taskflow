import { describe, expect, it } from 'vitest';
import { meaningfulQueuedAt, queueSplit, runWithQueuedAt, takeQueuedAt } from './queue-handoff';

describe('meaningfulQueuedAt', () => {
  it('drops scheduling noise when a slot was free (no real wait)', () => {
    expect(meaningfulQueuedAt(1000, 1000.4)).toBeUndefined();
    expect(meaningfulQueuedAt(1000, 1001.9)).toBeUndefined();
  });
  it('keeps a real wait', () => {
    expect(meaningfulQueuedAt(1000, 1002)).toBe(1000);
    expect(meaningfulQueuedAt(1000, 1120)).toBe(1000);
  });
  it('passes through undefined', () => {
    expect(meaningfulQueuedAt(undefined, 1000)).toBeUndefined();
  });
});

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
