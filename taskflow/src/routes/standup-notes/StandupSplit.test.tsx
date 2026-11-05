import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/stores/settings.store';
import StandupSplit from './StandupSplit';

function setup() {
  return render(<StandupSplit left={<div>Left</div>} right={<div>Right</div>} />);
}

describe('StandupSplit', () => {
  beforeEach(() => {
    act(() => {
      useSettingsStore.setState({ standupYesterdayRatio: null });
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders both panes', () => {
    setup();
    expect(screen.getByText('Left')).toBeTruthy();
    expect(screen.getByText('Right')).toBeTruthy();
  });

  it('is 50% wide when unset', () => {
    setup();
    expect(screen.getByText('Left').parentElement?.style.width).toBe('50%');
  });

  it('uses the persisted ratio as a percentage', () => {
    act(() => {
      useSettingsStore.setState({ standupYesterdayRatio: 0.4 });
    });
    setup();
    expect(screen.getByText('Left').parentElement?.style.width).toBe('40%');
  });

  it('exposes an accessible separator', () => {
    act(() => {
      useSettingsStore.setState({ standupYesterdayRatio: 0.4 });
    });
    setup();
    const sep = screen.getByRole('separator');
    expect(sep.getAttribute('aria-orientation')).toBe('vertical');
    expect(sep.getAttribute('aria-label')).toBe('Resize Yesterday and Today columns');
    expect(sep.getAttribute('tabindex')).toBe('0');
    expect(sep.getAttribute('aria-valuenow')).toBe('40');
    expect(sep.getAttribute('aria-valuemin')).toBe('20');
    expect(sep.getAttribute('aria-valuemax')).toBe('80');
  });

  it('ArrowRight commits a ratio to the store', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
    setup();
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });
    const r = useSettingsStore.getState().standupYesterdayRatio;
    expect(typeof r).toBe('number');
    expect(r as number).toBeGreaterThan(0.5);
    expect(r as number).toBeLessThan(1);
  });

  it('double-click resets to null (50/50)', () => {
    act(() => {
      useSettingsStore.setState({ standupYesterdayRatio: 0.4 });
    });
    setup();
    fireEvent.doubleClick(screen.getByRole('separator'));
    expect(useSettingsStore.getState().standupYesterdayRatio).toBeNull();
  });
});
