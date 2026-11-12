import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/stores/settings.store';
import { WhatsNewDialog } from './WhatsNewDialog';

vi.mock('@/lib/build-info', () => ({
  buildInfo: { version: '1.5.0', commitSha: 'dev', buildDate: 'unknown' },
}));

vi.mock('@/hooks/useReleaseHistory', () => ({
  useReleaseHistory: vi.fn(),
}));

import { useReleaseHistory } from '@/hooks/useReleaseHistory';

type SettingsState = Partial<ReturnType<typeof useSettingsStore.getState>>;

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{`${loc.pathname}${loc.search}`}</div>;
}

function renderDialog() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <WhatsNewDialog />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const rel = (version: string, body: string) => ({
  version,
  tag: `v${version}`,
  publishedAt: '2026-01-01T00:00:00Z',
  body,
  prerelease: false,
});

describe('WhatsNewDialog', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      lastSeenVersion: null,
      lastSeenChangelog: null,
    } as SettingsState);
    vi.clearAllMocks();
    vi.mocked(useReleaseHistory).mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useReleaseHistory>);
  });

  it('does not render when lastSeenVersion equals buildInfo.version', () => {
    useSettingsStore.setState({
      lastSeenVersion: '1.5.0',
      lastSeenChangelog: '## v2.0\n- New feature',
    } as SettingsState);
    renderDialog();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not render when lastSeenChangelog is null', () => {
    useSettingsStore.setState({ lastSeenVersion: 'old', lastSeenChangelog: null } as SettingsState);
    renderDialog();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders when lastSeenVersion differs and changelog exists', () => {
    useSettingsStore.setState({
      lastSeenVersion: 'old',
      lastSeenChangelog: '## v2.0\n- New feature',
    } as SettingsState);
    renderDialog();
    expect(screen.getByText('Updated to 1.5.0')).toBeInTheDocument();
    expect(screen.getByText('New feature')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
    // 'old' is not a valid version: no "from" line
    expect(screen.queryByText(/^from /)).not.toBeInTheDocument();
  });

  it('shows "from <version>" and the roll-up of skipped releases', () => {
    vi.mocked(useReleaseHistory).mockReturnValue({
      data: [
        rel('1.5.0', 'Current.'),
        rel('1.4.0', 'Middle summary.\n\n### New\n- **Thing**'),
        rel('1.2.0', 'Old.'),
      ],
    } as unknown as ReturnType<typeof useReleaseHistory>);
    useSettingsStore.setState({
      lastSeenVersion: '1.2.0',
      lastSeenChangelog: 'Current.\n\n### New\n- **Big thing**',
    } as SettingsState);
    renderDialog();
    expect(screen.getByText('from 1.2.0')).toBeInTheDocument();
    expect(screen.getByText('Skipped releases')).toBeInTheDocument();
    expect(screen.getByText('1.4.0')).toBeInTheDocument();
    expect(screen.queryByText('1.2.0')).not.toBeInTheDocument();
    expect(vi.mocked(useReleaseHistory)).toHaveBeenCalledWith({ enabled: true });
  });

  it("'Got it' updates lastSeenVersion to current version", () => {
    const setLastSeenVersion = vi.fn();
    useSettingsStore.setState({
      lastSeenVersion: 'old',
      lastSeenChangelog: '## v2.0\n- New feature',
      setLastSeenVersion,
    } as SettingsState);
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(setLastSeenVersion).toHaveBeenCalledWith('1.5.0');
    expect(screen.getByTestId('loc')).toHaveTextContent('/');
  });

  it("'See all updates' sets lastSeenVersion and opens Settings → Updates", () => {
    const setLastSeenVersion = vi.fn();
    useSettingsStore.setState({
      lastSeenVersion: 'old',
      lastSeenChangelog: '## v2.0\n- New feature',
      setLastSeenVersion,
    } as SettingsState);
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'See all updates' }));
    expect(setLastSeenVersion).toHaveBeenCalledWith('1.5.0');
    expect(screen.getByTestId('loc')).toHaveTextContent('/settings?section=updates');
  });
});
