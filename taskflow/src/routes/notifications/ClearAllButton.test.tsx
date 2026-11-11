import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ClearAllButton, { CLEAR_ALL_REVERT_MS } from './ClearAllButton';

const idle = () => screen.getByRole('button', { name: 'Clear all notifications' });
const armed = () => screen.getByRole('button', { name: 'Confirm: clear all notifications' });

describe('ClearAllButton (macOS-style inline confirmation)', () => {
  afterEach(() => vi.useRealTimers());

  it('first click arms without confirming; the pill shows "Clear all"', () => {
    const onConfirm = vi.fn();
    render(<ClearAllButton onConfirm={onConfirm} />);
    fireEvent.click(idle());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(armed()).toHaveAttribute('data-armed', 'true');
    expect(armed()).toHaveTextContent('Clear all');
  });

  it('second click confirms once and disarms', () => {
    const onConfirm = vi.fn();
    render(<ClearAllButton onConfirm={onConfirm} />);
    fireEvent.click(idle());
    fireEvent.click(armed());
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(idle()).not.toHaveAttribute('data-armed');
  });

  it('Escape disarms without confirming and does not bubble (panel stays open)', () => {
    const onConfirm = vi.fn();
    const outer = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test harness listener
      <div onKeyDown={outer}>
        <ClearAllButton onConfirm={onConfirm} />
      </div>,
    );
    fireEvent.click(idle());
    fireEvent.keyDown(armed(), { key: 'Escape' });
    expect(idle()).toBeInTheDocument();
    expect(outer).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a pointer down elsewhere disarms', () => {
    render(
      <>
        <ClearAllButton onConfirm={vi.fn()} />
        <p>elsewhere</p>
      </>,
    );
    fireEvent.click(idle());
    fireEvent.pointerDown(screen.getByText('elsewhere'));
    expect(idle()).toBeInTheDocument();
  });

  it('reverts on its own after CLEAR_ALL_REVERT_MS', () => {
    vi.useFakeTimers();
    render(<ClearAllButton onConfirm={vi.fn()} />);
    fireEvent.click(idle());
    act(() => {
      vi.advanceTimersByTime(CLEAR_ALL_REVERT_MS + 10);
    });
    expect(idle()).toBeInTheDocument();
  });

  it('is disabled when there is nothing to clear', () => {
    render(<ClearAllButton onConfirm={vi.fn()} disabled />);
    expect(idle()).toBeDisabled();
  });
});
