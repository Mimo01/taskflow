import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AboutDialog } from './AboutDialog';

// Mock build-info with known values
vi.mock('@/lib/build-info', () => ({
  buildInfo: { version: '1.6.0', commitSha: 'abc1234', buildDate: '2026-03-24' },
}));

// Mock update store — default to idle status
const mockUpdateStore = { status: 'idle' as 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error', availableVersion: null as string | null };
vi.mock('@/stores/update.store', () => ({
  useUpdateStore: (selector?: (s: typeof mockUpdateStore) => unknown) =>
    selector ? selector(mockUpdateStore) : mockUpdateStore,
}));

describe('AboutDialog', () => {
  beforeEach(() => {
    mockUpdateStore.status = 'idle';
    mockUpdateStore.availableVersion = null;
  });

  it('renders version from buildInfo', () => {
    render(<AboutDialog open={true} onClose={() => {}} />);
    expect(screen.getByText('1.6.0')).toBeInTheDocument();
  });

  it('renders commit SHA from buildInfo', () => {
    render(<AboutDialog open={true} onClose={() => {}} />);
    expect(screen.getByText('abc1234')).toBeInTheDocument();
  });

  it('renders build date from buildInfo', () => {
    render(<AboutDialog open={true} onClose={() => {}} />);
    expect(screen.getByText('2026-03-24')).toBeInTheDocument();
  });

  it('renders platform info', () => {
    render(<AboutDialog open={true} onClose={() => {}} />);
    // derivePlatform() returns macOS/Windows/Linux based on navigator.platform
    // jsdom sets navigator.platform to empty string, so derivePlatform returns 'Linux'
    expect(screen.getByText(/macOS|Windows|Linux/i)).toBeInTheDocument();
  });

  it('renders Taskflow title', () => {
    render(<AboutDialog open={true} onClose={() => {}} />);
    expect(screen.getByText('Taskflow')).toBeInTheDocument();
  });

  it('renders app icon', () => {
    render(<AboutDialog open={true} onClose={() => {}} />);
    expect(screen.getByAltText('Taskflow')).toBeInTheDocument();
  });

  it('shows "Up to date" when status is idle', () => {
    render(<AboutDialog open={true} onClose={() => {}} />);
    expect(screen.getByText(/up to date/i)).toBeInTheDocument();
  });

  it('shows "Update available" when status is available', () => {
    mockUpdateStore.status = 'available';
    mockUpdateStore.availableVersion = '1.7.0';
    render(<AboutDialog open={true} onClose={() => {}} />);
    expect(screen.getByText(/update available.*1\.7\.0/i)).toBeInTheDocument();
  });

  it('renders Close button', () => {
    render(<AboutDialog open={true} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<AboutDialog open={false} onClose={() => {}} />);
    // When open=false, dialog content should not be in the document
    expect(screen.queryByText('Taskflow')).not.toBeInTheDocument();
  });
});
