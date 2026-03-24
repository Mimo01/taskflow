import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsNewDialog } from './WhatsNewDialog';
import { useSettingsStore } from '@/stores/settings.store';
import { buildInfo } from '@/lib/build-info';

// Mock react-markdown to render children as plain text
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));

vi.mock('remark-gfm', () => ({ default: vi.fn() }));

describe('WhatsNewDialog', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      lastSeenVersion: null,
      lastSeenChangelog: null,
    } as Partial<ReturnType<typeof useSettingsStore.getState>>);
    vi.clearAllMocks();
  });

  it('does not render when lastSeenVersion equals buildInfo.version', () => {
    useSettingsStore.setState({
      lastSeenVersion: buildInfo.version,
      lastSeenChangelog: '## v2.0\n- New feature',
    } as Partial<ReturnType<typeof useSettingsStore.getState>>);
    render(<WhatsNewDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not render when lastSeenChangelog is null', () => {
    useSettingsStore.setState({
      lastSeenVersion: 'old',
      lastSeenChangelog: null,
    } as Partial<ReturnType<typeof useSettingsStore.getState>>);
    render(<WhatsNewDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders when lastSeenVersion differs and changelog exists', () => {
    useSettingsStore.setState({
      lastSeenVersion: 'old',
      lastSeenChangelog: '## v2.0\n- New feature',
    } as Partial<ReturnType<typeof useSettingsStore.getState>>);
    render(<WhatsNewDialog />);
    expect(screen.getByText(/What's New in v/)).toBeInTheDocument();
    expect(screen.getByText(/New feature/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
  });

  it("'Got it' updates lastSeenVersion to current version", () => {
    const setLastSeenVersion = vi.fn();
    useSettingsStore.setState({
      lastSeenVersion: 'old',
      lastSeenChangelog: '## v2.0\n- New feature',
      setLastSeenVersion,
    } as Partial<ReturnType<typeof useSettingsStore.getState>>);
    render(<WhatsNewDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(setLastSeenVersion).toHaveBeenCalledWith(buildInfo.version);
  });
});
