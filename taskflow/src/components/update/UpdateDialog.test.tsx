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

// Mock tauri-storage so persistChangelogBeforeRestart doesn't hit Tauri IPC.
// Use vi.fn() inline (hoisting-safe); access via vi.mocked() below.
vi.mock('@/lib/tauri-storage', () => ({
  persistChangelogBeforeRestart: vi.fn().mockResolvedValue(undefined),
  settingsLazyStore: {},
  createTauriStorage: vi.fn(),
}));

// Mock react-markdown to render children as plain text
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));

vi.mock('remark-gfm', () => ({ default: vi.fn() }));

import { updaterService } from '@/services/updater';
import { persistChangelogBeforeRestart } from '@/lib/tauri-storage';

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
    vi.mocked(persistChangelogBeforeRestart).mockResolvedValue(undefined);
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

  it("'Update Now' calls invoke relaunch after successful download", async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    useUpdateStore.setState({
      status: 'available',
      availableVersion: '2.0.0',
      changelog: null,
      releaseDate: null,
      downloadProgress: null,
      errorMessage: null,
    });
    render(<UpdateDialog />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Update Now' }));
    });
    expect(invoke).toHaveBeenCalledWith('plugin:process|restart');
  });

  it("'Update Now' calls persistChangelogBeforeRestart with the changelog before restarting", async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    useUpdateStore.setState({
      status: 'available',
      availableVersion: '2.0.0',
      changelog: '## v2.0.0\n- New stuff',
      releaseDate: null,
      downloadProgress: null,
      errorMessage: null,
    });
    render(<UpdateDialog />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Update Now' }));
    });
    // persistChangelogBeforeRestart must be called with the changelog string
    expect(persistChangelogBeforeRestart).toHaveBeenCalledWith('## v2.0.0\n- New stuff');
    // and it must be called BEFORE restart
    const persistFn = vi.mocked(persistChangelogBeforeRestart);
    const invokeFn = vi.mocked(invoke);
    const persistOrder = persistFn.mock.invocationCallOrder[0];
    const restartCallIndex = invokeFn.mock.calls.findIndex(
      (call) => call[0] === 'plugin:process|restart',
    );
    const restartOrder = invokeFn.mock.invocationCallOrder[restartCallIndex];
    expect(persistOrder).toBeLessThan(restartOrder);
  });

  it("'Update Now' calls persistChangelogBeforeRestart with null when changelog is null", async () => {
    useUpdateStore.setState({
      status: 'available',
      availableVersion: '2.0.0',
      changelog: null,
      releaseDate: null,
      downloadProgress: null,
      errorMessage: null,
    });
    render(<UpdateDialog />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Update Now' }));
    });
    expect(persistChangelogBeforeRestart).toHaveBeenCalledWith(null);
  });
});
