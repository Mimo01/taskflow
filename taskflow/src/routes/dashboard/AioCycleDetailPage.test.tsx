import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, it, vi } from 'vitest';

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    storyPointsFieldKey: 'customfield_10016',
  }),
}));
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    jiraBaseUrl: 'https://jira.example.com',
  }),
}));
vi.mock('@/services/aio', () => ({
  fetchAioCycles: vi.fn(),
  fetchAioTestRunsForCycle: vi.fn(),
  fetchAioCycleDetail: vi.fn(),
}));
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('fake-token'),
}));
vi.mock('@/stores/pinned-tabs.store', () => ({
  usePinnedTabsStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      isPinned: vi.fn().mockReturnValue(false),
      togglePin: vi.fn(),
      setPinnedCycleMeta: vi.fn(),
      removePin: vi.fn(),
      clearCycleMeta: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

function _makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

// Live import — will fail with "Cannot find module" until Wave 1 creates the component.
// This is the expected RED state for Wave 0.
import AioCycleDetailPage from './AioCycleDetailPage';

describe('AioCycleDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.todo('renders AioCycleDetailPage without crashing');

  describe('progress bar', () => {
    it.todo('shows pass/fail/blocked/not-run counts from test runs');
    it.todo('shows "No runs recorded" when runs array is empty');
    it.todo('percentages sum to 100 when all runs accounted for');
  });

  describe('filter chips', () => {
    it.todo('all four chips are active by default');
    it.todo('toggling Fail chip off hides Fail-status rows from the run list');
    it.todo('shows "No runs match the selected filters" when all chips toggled off');
  });

  describe('defects section', () => {
    it.todo('renders deduplicated Jira issue keys as NavLinks when runs have defects');
    it.todo('hides defects section when no runs have non-empty defects array');
  });

  describe('pin button', () => {
    it.todo('reads "Pin cycle" when cycle is not pinned');
    it.todo('reads "Unpin cycle" when cycle is pinned');
    it.todo('clicking Pin button calls togglePin and setPinnedCycleMeta');
  });
});

// Suppress unused import warning — the import is intentional (RED state trigger)
void AioCycleDetailPage;
void QueryClientProvider;
void MemoryRouter;
void Route;
void Routes;
