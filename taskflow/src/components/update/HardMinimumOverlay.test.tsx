import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HardMinimumOverlay } from './HardMinimumOverlay';
import type { VersionPolicy } from '@/services/versionPolicy';

// Mock Tauri updater so tests don't fail on missing Tauri IPC
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn().mockResolvedValue(null),
}));

// Mock updaterService
vi.mock('@/services/updater', () => ({
  updaterService: {
    check: vi.fn().mockResolvedValue(null),
  },
}));

// Mock update store
vi.mock('@/stores/update.store', () => ({
  useUpdateStore: vi.fn(() => ({
    setChecking: vi.fn(),
    setAvailable: vi.fn(),
  })),
}));

const basePolicy: VersionPolicy = {
  softMinimum: '1.0.0',
  hardMinimum: '1.0.0',
};

describe('HardMinimumOverlay', () => {
  it('renders update required heading', () => {
    render(<HardMinimumOverlay policy={basePolicy} />);
    expect(screen.getByText('Update Required')).toBeInTheDocument();
  });

  it('renders default body when no policy message', () => {
    render(<HardMinimumOverlay policy={basePolicy} />);
    expect(screen.getByText(/no longer supported/i)).toBeInTheDocument();
  });

  it('renders policy.message when present', () => {
    const policy: VersionPolicy = { ...basePolicy, message: 'Must upgrade now' };
    render(<HardMinimumOverlay policy={policy} />);
    expect(screen.getByText('Must upgrade now')).toBeInTheDocument();
  });

  it('has no dismiss button or X', () => {
    render(<HardMinimumOverlay policy={basePolicy} />);
    expect(screen.queryByText(/dismiss/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/dismiss/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });

  it('Update Now button is present', () => {
    render(<HardMinimumOverlay policy={basePolicy} />);
    expect(screen.getByRole('button', { name: /Update Now/i })).toBeInTheDocument();
  });

  it('has z-[200] fixed positioning on container', () => {
    const { container } = render(<HardMinimumOverlay policy={basePolicy} />);
    const overlay = container.firstChild as HTMLElement;
    expect(overlay.className).toContain('fixed');
    expect(overlay.className).toContain('z-[200]');
  });
});
