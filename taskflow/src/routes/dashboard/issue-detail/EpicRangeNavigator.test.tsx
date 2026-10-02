import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { addCalendarDays, type ChartRange, dateKeyMs, spanDays } from '@/lib/epic-progress';
import { EpicRangeNavigator, type OverviewPoint, sparklinePath } from './EpicRangeNavigator';

const domain: ChartRange = { from: '2026-01-02', to: '2027-01-02' };
const range: ChartRange = { from: '2026-08-14', to: '2026-11-27' };

const pt = (key: string, remaining: number | null, forecast: number | null = null) => ({
  t: dateKeyMs(key),
  remaining,
  forecast,
});

describe('sparklinePath', () => {
  it('places x linearly in time, not by index', () => {
    // 10-day domain; samples at day 0, 1 and 10 (uneven spacing)
    const d = { from: '2026-01-01', to: '2026-01-11' };
    const pts = [pt('2026-01-01', 10), pt('2026-01-02', 10), pt('2026-01-11', 0)];
    const path = sparklinePath(pts, d, 'remaining');
    expect(path.startsWith('M0 0')).toBe(true);
    expect(path).toContain('L100 0'); // day 1 of 10 -> x = 100
    expect(path).toContain('L1000 0'); // step to the last x, y stays at the previous value
    expect(path.endsWith('L1000 100')).toBe(true);
  });

  it('skips null values and restarts the path after a gap', () => {
    const d = { from: '2026-01-01', to: '2026-01-11' };
    const pts: OverviewPoint[] = [
      pt('2026-01-01', 5, null),
      pt('2026-01-05', null, 4),
      pt('2026-01-11', null, 2),
    ];
    expect(sparklinePath(pts, d, 'remaining')).toBe('M0 0');
    const f = sparklinePath(pts, d, 'forecast');
    expect(f.startsWith('M400')).toBe(true);
    expect(f.match(/M/g)).toHaveLength(1);
    expect(f).toContain('L1000');
  });

  it('is empty without values', () => {
    expect(sparklinePath([], domain, 'remaining')).toBe('');
  });
});

describe('EpicRangeNavigator', () => {
  const setup = (r: ChartRange = range) => {
    const calls: string[] = [];
    const onLive = vi.fn((x: ChartRange) => calls.push(`live:${x.from}..${x.to}`));
    const onCommit = vi.fn((x: ChartRange) => calls.push(`commit:${x.from}..${x.to}`));
    const onReset = vi.fn();
    render(
      <EpicRangeNavigator
        domain={domain}
        range={r}
        today="2026-10-02"
        overview={[pt('2026-01-02', 5), pt('2026-10-02', 1, 1), pt('2027-01-02', null, 0)]}
        onLive={onLive}
        onCommit={onCommit}
        onReset={onReset}
      />,
    );
    return { calls, onLive, onCommit, onReset };
  };
  const start = () => screen.getByRole('slider', { name: 'Range start' });
  const end = () => screen.getByRole('slider', { name: 'Range end' });
  const committed = (onCommit: ReturnType<typeof vi.fn>) =>
    onCommit.mock.calls.map((c) => c[0] as ChartRange);

  it('renders two named sliders with date value text and the caption', () => {
    setup();
    expect(screen.getAllByRole('slider')).toHaveLength(2);
    expect(start()).toHaveAttribute('aria-valuetext', 'Aug 14, 2026');
    expect(end()).toHaveAttribute('aria-valuetext', 'Nov 27, 2026');
    expect(screen.getByTestId('epic-range-caption')).toHaveTextContent('Aug 14 – Nov 27 (105 d)');
    expect(screen.getByText('Jan 2026')).toBeInTheDocument();
    expect(screen.getByText('Jan 2027')).toBeInTheDocument();
  });

  it('ArrowLeft / Shift+ArrowLeft / PageDown on the start thumb move 1, 7 and 7 days', () => {
    const { onCommit } = setup();
    fireEvent.keyDown(start(), { key: 'ArrowLeft' });
    expect(committed(onCommit).pop()?.from).toBe('2026-08-13');
    fireEvent.keyDown(start(), { key: 'ArrowLeft', shiftKey: true });
    expect(committed(onCommit).pop()?.from).toBe('2026-08-07');
    fireEvent.keyDown(start(), { key: 'PageDown' });
    expect(committed(onCommit).pop()?.from).toBe('2026-08-07');
  });

  it('a keyboard move reports onLive and then onCommit, in that order', () => {
    const { calls } = setup();
    fireEvent.keyDown(start(), { key: 'ArrowLeft' });
    expect(calls).toEqual(['live:2026-08-13..2026-11-27', 'commit:2026-08-13..2026-11-27']);
  });

  it('never commits a range shorter than 7 days', () => {
    const tight: ChartRange = { from: '2026-08-14', to: '2026-08-21' };
    const { onCommit } = setup(tight);
    for (let i = 0; i < 4; i++) {
      fireEvent.keyDown(end(), { key: 'ArrowLeft' });
      fireEvent.keyDown(start(), { key: 'ArrowRight' });
    }
    for (const r of committed(onCommit)) {
      expect(spanDays(r)).toBeGreaterThanOrEqual(7);
      expect(r.from >= domain.from && r.to <= domain.to).toBe(true);
    }
    // sanity: the end thumb can still move outwards from the minimum span
    fireEvent.keyDown(end(), { key: 'ArrowRight' });
    const last = committed(onCommit).pop();
    expect(last && addCalendarDays(last.from, 8)).toBe(last?.to);
  });

  it('a click on the selection without movement does not commit (keeps the active preset)', () => {
    const { onCommit } = setup();
    const handle = screen
      .getByTestId('epic-range-navigator')
      .querySelector<HTMLElement>('.cursor-grab') as HTMLElement;
    // jsdom has zero geometry, so the pointer delta is 0 days — a pure click.
    fireEvent.pointerDown(handle, { clientX: 50, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 50, pointerId: 1 });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('double-clicking the selection resets', () => {
    const { onReset } = setup();
    // the Indicator is the only element with the grab cursor class
    const handle = screen
      .getByTestId('epic-range-navigator')
      .querySelector<HTMLElement>('.cursor-grab');
    expect(handle).not.toBeNull();
    fireEvent.doubleClick(handle as HTMLElement);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
