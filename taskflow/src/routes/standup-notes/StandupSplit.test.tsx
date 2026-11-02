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
      useSettingsStore.setState({ standupYesterdayWidth: null });
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

  it('uses the persisted width in px', () => {
    act(() => {
      useSettingsStore.setState({ standupYesterdayWidth: 500 });
    });
    setup();
    expect(screen.getByText('Left').parentElement?.style.width).toBe('500px');
  });

  it('exposes an accessible separator', () => {
    act(() => {
      useSettingsStore.setState({ standupYesterdayWidth: 500 });
    });
    setup();
    const sep = screen.getByRole('separator');
    expect(sep.getAttribute('aria-orientation')).toBe('vertical');
    expect(sep.getAttribute('aria-label')).toBe('Resize Yesterday and Today columns');
    expect(sep.getAttribute('tabindex')).toBe('0');
    expect(sep.getAttribute('aria-valuenow')).toBe('500');
  });

  it('ArrowRight commits a numeric width to the store', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
    setup();
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });
    const w = useSettingsStore.getState().standupYesterdayWidth;
    expect(typeof w).toBe('number');
    expect(w as number).toBeGreaterThanOrEqual(320);
  });

  it('double-click resets to null (50/50)', () => {
    act(() => {
      useSettingsStore.setState({ standupYesterdayWidth: 500 });
    });
    setup();
    fireEvent.doubleClick(screen.getByRole('separator'));
    expect(useSettingsStore.getState().standupYesterdayWidth).toBeNull();
  });
});
