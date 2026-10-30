// 94-REVIEW WR-01: the burnup must measure its plot when the plot mounts, not
// only on the component's first render. On a first visit the slot mounts in
// the loading state (no plot), so a once-only effect kept the 640px fallback
// and chose tick density for the wrong width. No useElementWidth mock here.

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { timeTicks } from '@/lib/epic-progress';
import type { BurnupAxis, BurnupPoint } from '../releaseBurnup';
import { ReleaseBurnup } from './ReleaseBurnup';

vi.mock('@/lib/epic-progress', async (orig) => {
  const real = await orig<typeof import('@/lib/epic-progress')>();
  return { ...real, timeTicks: vi.fn(real.timeTicks) };
});

const PLOT_WIDTH = 300;

const axis: BurnupAxis = {
  start: '2026-10-01',
  end: '2026-10-20',
  seriesEnd: '2026-10-10',
  previousName: 'v1.2',
  releaseDate: '2026-10-20',
  showToday: true,
  showRelease: true,
};
const points: BurnupPoint[] = [
  { day: '2026-10-01', t: 1, scope: 3, done: 0, doneSp: 0 },
  { day: '2026-10-10', t: 2, scope: 5, done: 2, doneSp: 4 },
];
const summary = {
  done: 2,
  total: 5,
  today: '2026-10-10',
  releaseDate: '2026-10-20',
  released: false,
};

describe('ReleaseBurnup plot width (WR-01)', () => {
  const RealRO = globalThis.ResizeObserver;
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      constructor(private cb: ResizeObserverCallback) {}
      observe(target: Element) {
        this.cb(
          [{ target, contentRect: { width: PLOT_WIDTH, height: 196 } } as ResizeObserverEntry],
          this as never,
        );
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    vi.mocked(timeTicks).mockClear();
  });
  afterEach(() => {
    globalThis.ResizeObserver = RealRO;
  });

  it('measures the plot that mounts after a loading first render', () => {
    const { rerender } = render(
      <ReleaseBurnup
        axis={axis}
        points={[]}
        state="loading"
        showStoryPoints={false}
        summary={summary}
      />,
    );
    rerender(
      <ReleaseBurnup
        axis={axis}
        points={points}
        state="ready"
        showStoryPoints={false}
        summary={summary}
      />,
    );
    const calls = vi.mocked(timeTicks).mock.calls;
    expect(calls[calls.length - 1]?.[2]).toBe(PLOT_WIDTH);
  });
});
