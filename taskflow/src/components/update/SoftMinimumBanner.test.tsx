import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { buildInfo } from '@/lib/build-info';
import type { VersionPolicy } from '@/services/versionPolicy';
import { SoftMinimumBanner } from './SoftMinimumBanner';

const basePolicy: VersionPolicy = {
  softMinimum: '1.0.0',
  hardMinimum: '0.5.0',
};

describe('SoftMinimumBanner', () => {
  it('renders message and buttons with default message', () => {
    render(<SoftMinimumBanner policy={basePolicy} onDismiss={vi.fn()} onUpdate={vi.fn()} />);

    // Default message includes current version
    expect(screen.getByText(new RegExp(`v${buildInfo.version}`))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update Now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dismiss update reminder/i })).toBeInTheDocument();
  });

  it('uses policy.message when present', () => {
    const policy: VersionPolicy = { ...basePolicy, message: 'Custom msg' };
    render(<SoftMinimumBanner policy={policy} onDismiss={vi.fn()} onUpdate={vi.fn()} />);
    expect(screen.getByText('Custom msg')).toBeInTheDocument();
  });

  it('dismiss button calls onDismiss', async () => {
    const onDismiss = vi.fn();
    render(<SoftMinimumBanner policy={basePolicy} onDismiss={onDismiss} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Dismiss update reminder/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('update button calls onUpdate', async () => {
    const onUpdate = vi.fn();
    render(<SoftMinimumBanner policy={basePolicy} onDismiss={vi.fn()} onUpdate={onUpdate} />);
    await userEvent.click(screen.getByRole('button', { name: 'Update Now' }));
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it('dismiss button has sr-only label', () => {
    render(<SoftMinimumBanner policy={basePolicy} onDismiss={vi.fn()} onUpdate={vi.fn()} />);
    const srOnlySpan = screen.getByText('Dismiss update reminder');
    expect(srOnlySpan).toHaveClass('sr-only');
  });
});
