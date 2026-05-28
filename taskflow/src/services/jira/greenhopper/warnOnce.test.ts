/**
 * Tests for the shared GreenHopper warn-once helper.
 *
 * Behavior (Phase 72 Plan 01 Task 1):
 *   1. warnOnce('kind','id') called twice with same key → exactly ONE warn
 *   2. Two distinct keys → TWO warns
 *   3. __resetWarnOnce() clears the Set so subsequent calls warn again
 *   4. Warn message format is verbatim
 *      `[greenhopper] missing ${kind} id="${id}" — using Unknown fallback`
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetWarnOnce, warnOnce } from './warnOnce';

describe('warnOnce', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __resetWarnOnce();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('emits exactly ONE warn for two calls with same (kind, id)', () => {
    warnOnce('status', '42');
    warnOnce('status', '42');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('emits TWO warns for two distinct keys', () => {
    warnOnce('status', '42');
    warnOnce('status', '43');
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('emits TWO warns for same id but different kinds', () => {
    warnOnce('status', '42');
    warnOnce('priority', '42');
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('uses the verbatim message format', () => {
    warnOnce('status', '42');
    expect(warnSpy).toHaveBeenCalledWith(
      '[greenhopper] missing status id="42" — using Unknown fallback',
    );
  });

  it('__resetWarnOnce() clears the Set so subsequent calls warn again', () => {
    warnOnce('status', '42');
    warnOnce('status', '42');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    __resetWarnOnce();
    warnOnce('status', '42');
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
