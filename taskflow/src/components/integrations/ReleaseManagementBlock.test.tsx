import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listJiraProjects } from '@/services/jira';
import { useSettingsStore } from '@/stores/settings.store';
import ReleaseManagementBlock from './ReleaseManagementBlock';

vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('tok'),
}));
vi.mock('@/services/jira', () => ({ listJiraProjects: vi.fn() }));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ jiraBaseUrl: 'https://jira.example.com' }),
}));

function renderBlock() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReleaseManagementBlock />
    </QueryClientProvider>,
  );
}

describe('ReleaseManagementBlock', () => {
  beforeEach(() => {
    useSettingsStore.setState({ releaseManagementProjectKey: null });
    vi.mocked(listJiraProjects).mockReset();
  });

  it('shows the heading and the disabled-when-unset helper text', async () => {
    vi.mocked(listJiraProjects).mockResolvedValue([]);
    renderBlock();
    expect(screen.getByRole('heading', { name: /release management/i })).toBeInTheDocument();
    expect(screen.getByText(/disabled\s+while nothing is selected/i)).toBeInTheDocument();
  });

  it('renders the selected project name in the trigger', async () => {
    useSettingsStore.setState({ releaseManagementProjectKey: 'RM' });
    vi.mocked(listJiraProjects).mockResolvedValue([{ id: '1', key: 'RM', name: 'Release Mgmt' }]);
    renderBlock();
    await waitFor(() => expect(screen.getByText('Release Mgmt')).toBeInTheDocument());
  });

  it('warns about a stale persisted key', async () => {
    useSettingsStore.setState({ releaseManagementProjectKey: 'GONE' });
    vi.mocked(listJiraProjects).mockResolvedValue([{ id: '1', key: 'RM', name: 'Release Mgmt' }]);
    renderBlock();
    await waitFor(() => expect(screen.getByText(/no longer available/i)).toBeInTheDocument());
  });
});
