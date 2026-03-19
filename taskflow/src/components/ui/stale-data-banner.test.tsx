import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StaleDataBanner } from './stale-data-banner';

describe('StaleDataBanner', () => {
  it('renders "Couldn\'t refresh" text', () => {
    render(<StaleDataBanner onRetry={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/Couldn't refresh/)).toBeTruthy();
  });

  it('renders Retry button that calls onRetry on click', () => {
    const onRetry = vi.fn();
    render(<StaleDataBanner onRetry={onRetry} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders dismiss button that calls onDismiss on click', () => {
    const onDismiss = vi.fn();
    const { container } = render(<StaleDataBanner onRetry={vi.fn()} onDismiss={onDismiss} />);
    // Dismiss button has the X icon — find the second button (after Retry)
    const buttons = container.querySelectorAll('[data-slot="button"]');
    const dismissBtn = buttons[buttons.length - 1];
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
