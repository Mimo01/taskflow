import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdateStore } from '@/stores/update.store';
import { UpdateDialog } from './UpdateDialog';

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn().mockResolvedValue(null),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

// Mock updaterService
vi.mock('@/services/updater', () => ({
  updaterService: {
    check: vi.fn().mockResolvedValue(null),
    downloadAndInstall: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock react-markdown to render children as plain text
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));

vi.mock('remark-gfm', () => ({ default: vi.fn() }));

import { updaterService } from '@/services/updater';

describe('UpdateDialog', () => {
  beforeEach(() => {
    // Reset store to idle
    useUpdateStore.setState({
      status: 'idle',
      availableVersion: null,
      changelog: null,
      releaseDate: null,
      downloadProgress: null,
      errorMessage: null,
    });
    vi.clearAllMocks();
  });

  it('does not render when status is idle', () => {
    render(<UpdateDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders available view with version and changelog', () => {
    useUpdateStore.setState({
      status: 'available',
      availableVersion: '2.0.0',
      changelog: '## Changes\n- Fix bug',
      releaseDate: null,
      downloadProgress: null,
      errorMessage: null,
    });
    render(<UpdateDialog />);
    expect(screen.getByText('Update Available')).toBeInTheDocument();
    expect(screen.getByText(/2\.0\.0/)).toBeInTheDocument();
    expect(screen.getByText(/Fix bug/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update Now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Later' })).toBeInTheDocument();
  });

  it("'Later' button calls resetToIdle", () => {
    useUpdateStore.setState({
      status: 'available',
      availableVersion: '2.0.0',
      changelog: null,
      releaseDate: null,
      downloadProgress: null,
      errorMessage: null,
    });
    const resetToIdle = vi.fn();
    useUpdateStore.setState({ resetToIdle });
    render(<UpdateDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(resetToIdle).toHaveBeenCalled();
  });

  it("'Update Now' calls setDownloading and downloadAndInstall", async () => {
    useUpdateStore.setState({
      status: 'available',
      availableVersion: '2.0.0',
      changelog: null,
      releaseDate: null,
      downloadProgress: null,
      errorMessage: null,
    });
    const setDownloading = vi.fn();
    useUpdateStore.setState({ setDownloading });
    render(<UpdateDialog />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Update Now' }));
    });
    expect(setDownloading).toHaveBeenCalled();
    expect(updaterService.downloadAndInstall).toHaveBeenCalled();
  });

  it('renders downloading view with progress bar', () => {
    useUpdateStore.setState({
      status: 'downloading',
      availableVersion: '2.0.0',
      changelog: null,
      releaseDate: null,
      downloadProgress: 42,
      errorMessage: null,
    });
    render(<UpdateDialog />);
    expect(screen.getByText('Downloading Update')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('renders error view with retry and dismiss', () => {
    useUpdateStore.setState({
      status: 'error',
      availableVersion: '2.0.0',
      changelog: null,
      releaseDate: null,
      downloadProgress: null,
      errorMessage: 'Network timeout',
    });
    render(<UpdateDialog />);
    expect(screen.getByText('Download Failed')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('renders ready view with countdown', () => {
    useUpdateStore.setState({
      status: 'ready',
      availableVersion: '2.0.0',
      changelog: null,
      releaseDate: null,
      downloadProgress: null,
      errorMessage: null,
    });
    render(<UpdateDialog />);
    expect(screen.getByText('Ready to Restart')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart Later' })).toBeInTheDocument();
  });
});
