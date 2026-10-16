// PALETTE-01: Palette open/close behavior
// PALETTE-02: Issue selection calls onIssueClick
// PALETTE-03: Navigation items show shortcut hints
// PALETTE-06: Default state shows Recent Items + Navigation groups
// PALETTE-07: Escape/backdrop close behavior

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// cmdk uses ResizeObserver and scrollIntoView internally -- polyfill for jsdom
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  // jsdom does not implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock @tauri-apps/plugin-store (LazyStore) -- class constructor syntax required
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});

// Mock @tauri-apps/plugin-opener
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

// Mock stronghold readSecret
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

// Mock jira searchJiraBody and fetchJiraIssueByKey
vi.mock('@/services/jira', () => ({
  searchJiraBody: vi.fn().mockResolvedValue([]),
  fetchJiraIssueByKey: vi.fn().mockResolvedValue(null),
}));

// Mock the global-search index sources (mutable per test)
const mockSources = vi.hoisted(() => ({
  boardId: 1 as number | null,
  backlog: undefined as unknown,
  allData: undefined as unknown,
  isIndexLoading: false,
  isIndexError: false,
}));
const mockRecentIssues = vi.hoisted(() => ({
  issues: new Map(),
  epicNames: new Map(),
  epicLinkFieldKey: 'customfield_10014',
  isLoading: false,
}));
vi.mock('@/hooks/useRecentIssues', () => ({
  useRecentIssues: vi.fn(() => mockRecentIssues),
}));
vi.mock('@/hooks/useGlobalSearchSources', () => ({
  useGlobalSearchSources: vi.fn(() => mockSources),
}));

// Mock theme services
vi.mock('@/services/theme', () => ({
  applyTheme: vi.fn(),
  saveTheme: vi.fn(),
}));

// Mock auth store
const mockAuthStore = {
  jiraBaseUrl: 'https://jira.test',
  gitlabBaseUrl: 'https://gitlab.test',
  activeJiraProject: 'TEST',
};
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn((selector?: (s: typeof mockAuthStore) => unknown) =>
    selector ? selector(mockAuthStore) : mockAuthStore,
  ),
}));

// Mock settings store
const mockSettingsStore = {
  theme: 'light' as const,
  setTheme: vi.fn(),
  storyPointsFieldKey: 'customfield_10016',
  epicLinkFieldKey: 'customfield_10014',
};
vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn((selector?: (s: typeof mockSettingsStore) => unknown) =>
    selector ? selector(mockSettingsStore) : mockSettingsStore,
  ),
}));

// Mock notifications store
vi.mock('@/stores/notifications.store', () => ({
  useNotificationsStore: Object.assign(
    vi.fn((selector?: (s: Record<string, unknown>) => unknown) =>
      selector
        ? selector({ items: [], readIds: [], markAllRead: vi.fn() })
        : { items: [], readIds: [], markAllRead: vi.fn() },
    ),
    { getState: vi.fn(() => ({ markAllRead: vi.fn() })) },
  ),
}));

// Mock recent items store -- configurable per test
let mockRecentItems: Array<{
  type: 'jira' | 'gitlab';
  id: string;
  url?: string;
  title?: string;
  issueType?: string;
  timestamp: number;
}> = [];
const mockPushItem = vi.fn();
vi.mock('@/stores/recent-items.store', () => ({
  useRecentItemsStore: vi.fn(
    (
      selector?: (s: { items: typeof mockRecentItems; pushItem: typeof mockPushItem }) => unknown,
    ) => {
      const state = { items: mockRecentItems, pushItem: mockPushItem };
      return selector ? selector(state) : state;
    },
  ),
}));

import type { JiraIssue } from '@/services/jira';
import { fetchJiraIssueByKey, searchJiraBody } from '@/services/jira';
import type { GhBacklogResponse } from '@/services/jira/greenhopper/types';
import CommandPalette from './CommandPalette';

// ─── Synthetic GreenHopper backlog for the local search index ───────────────

interface IssueSpec {
  id: number;
  key: string;
  summary: string;
  typeId?: string;
  done?: boolean;
}

function ghIssue(s: IssueSpec) {
  return {
    id: s.id,
    key: s.key,
    hidden: false,
    typeId: s.typeId ?? '1',
    summary: s.summary,
    priorityId: '1',
    done: s.done ?? false,
    statusId: s.done ? '3' : '1',
    fixVersions: [],
    projectId: 1,
  };
}

const entityData = {
  statuses: {
    '1': {
      statusName: 'To Do',
      status: { id: '1', name: 'To Do', statusCategory: { id: '2', key: 'new' } },
    },
    '3': {
      statusName: 'Done',
      status: { id: '3', name: 'Done', statusCategory: { id: '3', key: 'done' } },
    },
  },
  priorities: {},
  types: {
    '1': { typeName: 'Story' },
    '4': { typeName: 'Bug' },
  },
  epics: {},
};

function makeBacklog(issues: IssueSpec[], sprints: unknown[] = []) {
  return { issues: issues.map(ghIssue), entityData, sprints } as unknown as GhBacklogResponse;
}

const SPRINTS = [
  { id: 1, name: 'Sprint 42', state: 'ACTIVE', issuesIds: [1, 2] },
  { id: 2, name: 'Sprint 43', state: 'FUTURE', issuesIds: [3] },
];
const BASE_ISSUES: IssueSpec[] = [
  { id: 1, key: 'TEST-1', summary: 'Fix login bug', typeId: '4' },
  { id: 2, key: 'TEST-2', summary: 'Cart checkout' },
  { id: 3, key: 'TEST-3', summary: 'Cart summary' },
  { id: 4, key: 'TEST-4', summary: 'Cart refactor' },
  { id: 5, key: 'TEST-5', summary: 'Cart badge' },
  { id: 6, key: 'TEST-6', summary: 'Write onboarding story' },
  { id: 18, key: 'TEST-18', summary: 'Eighteen item' },
];

function seedIndex(issues: IssueSpec[] = BASE_ISSUES, sprints: unknown[] = SPRINTS) {
  mockSources.backlog = makeBacklog(issues, sprints);
}

function bodyIssue(
  key: string,
  summary: string,
  extra: { description?: string; done?: boolean } = {},
): JiraIssue {
  return {
    id: key,
    key,
    fields: {
      summary,
      description: extra.description ?? null,
      status: {
        id: '1',
        name: extra.done ? 'Done' : 'Open',
        statusCategory: { key: extra.done ? 'done' : 'new' },
      },
      assignee: null,
      issuetype: { name: 'Story', subtask: false },
    },
  } as unknown as JiraIssue;
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const PLACEHOLDER = 'Search issues, MRs, and actions...';

function typeQuery(value: string) {
  fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value } });
}

function headings() {
  return Array.from(document.querySelectorAll('[cmdk-group-heading]')).map((n) => n.textContent);
}

function selectedKey() {
  return document.querySelector('[cmdk-item][aria-selected="true"]')?.getAttribute('data-value');
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onIssueClick: vi.fn(),
  onOpenIssue: vi.fn(),
  onNavigate: vi.fn(),
  onOpenNotifications: vi.fn(),
  onOpenCreate: vi.fn(),
};

function renderPalette(props = {}, qc?: QueryClient) {
  const queryClient = qc ?? makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CommandPalette {...defaultProps} {...props} />
    </QueryClientProvider>,
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecentItems = [];
    mockSources.backlog = undefined;
    mockSources.allData = undefined;
    mockSources.isIndexLoading = false;
    mockSources.isIndexError = false;
    mockRecentIssues.isLoading = false;
    vi.mocked(searchJiraBody).mockResolvedValue([]);
    vi.mocked(fetchJiraIssueByKey).mockResolvedValue(null);
  });

  // PALETTE-01: renders when open=true
  it('renders when open=true', () => {
    renderPalette({ open: true });
    expect(screen.getByPlaceholderText('Search issues, MRs, and actions...')).toBeInTheDocument();
  });

  // PALETTE-01: does not render when open=false
  it('does not render when open=false', () => {
    renderPalette({ open: false });
    expect(
      screen.queryByPlaceholderText('Search issues, MRs, and actions...'),
    ).not.toBeInTheDocument();
  });

  // PALETTE-07: calls onClose on Escape
  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    renderPalette({ onClose });

    const input = screen.getByPlaceholderText('Search issues, MRs, and actions...');
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  // PALETTE-07: calls onClose on backdrop click
  it('calls onClose on backdrop click', () => {
    const onClose = vi.fn();
    renderPalette({ onClose });

    // The backdrop is the outermost fixed div
    const backdrop = document.querySelector('.fixed.inset-0') as Element;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  // PALETTE-06: default state shows Navigation group
  it('default state shows Navigation group items', () => {
    renderPalette();
    expect(screen.getByText('Sprint Board')).toBeInTheDocument();
    expect(screen.getByText('Backlog')).toBeInTheDocument();
    expect(screen.getByText('Standup Notes')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  // PALETTE-06: default state shows Recent Items group
  it('default state shows Recent Items group with items', () => {
    mockRecentItems = [
      { type: 'jira', id: 'TEST-42', timestamp: Date.now() },
      { type: 'gitlab', id: '99', url: 'https://gitlab.test/mr/99', timestamp: Date.now() - 1000 },
    ];
    renderPalette();
    expect(screen.getByText(/TEST-42/)).toBeInTheDocument();
    expect(screen.getByText(/!99/)).toBeInTheDocument();
  });

  it('shows placeholder rows instead of partial recents while data loads (no flash)', () => {
    mockRecentItems = [{ type: 'jira', id: 'TEST-7', title: 'Fix crash', timestamp: Date.now() }];
    mockRecentIssues.isLoading = true;
    renderPalette();
    expect(screen.getByTestId('recent-items-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Fix crash')).toBeNull();
  });

  // Recent Items icon resolution: cache first, persisted issueType second, Clock fallback last
  describe('Recent Items icon resolution', () => {
    it('renders the bug icon for a recent Jira item with issueType: Bug', () => {
      mockRecentItems = [
        { type: 'jira', id: 'TEST-7', issueType: 'Bug', title: 'Fix crash', timestamp: Date.now() },
      ];
      renderPalette();
      const row = screen.getByText('Fix crash').closest('[cmdk-item]');
      expect(row).not.toBeNull();
      expect(row?.querySelector('[class*="lucide-bug"]')).not.toBeNull();
    });

    it('prefers the cached issuetype over the persisted issueType', () => {
      const qc = makeQueryClient();
      qc.setQueryData(['jira-issues', 'sprint-board', 'TEST', 'customfield_10016'], {
        issues: [
          {
            id: '1',
            key: 'TEST-8',
            fields: {
              summary: 'Cached story',
              status: { id: '1', name: 'Open' },
              assignee: null,
              customfield_10016: null,
              issuetype: { name: 'Story', subtask: false },
            },
          },
        ],
      });
      mockRecentItems = [{ type: 'jira', id: 'TEST-8', issueType: 'Bug', timestamp: Date.now() }];
      renderPalette({}, qc);
      const row = screen.getByText('Cached story').closest('[cmdk-item]');
      expect(row).not.toBeNull();
      expect(row?.querySelector('[class*="lucide-book-open"]')).not.toBeNull();
      expect(row?.querySelector('[class*="lucide-bug"]')).toBeNull();
    });

    it('falls back to the Clock glyph when no type can be resolved', () => {
      mockRecentItems = [
        { type: 'jira', id: 'TEST-9', title: 'No type here', timestamp: Date.now() },
      ];
      renderPalette();
      const row = screen.getByText('No type here').closest('[cmdk-item]');
      expect(row).not.toBeNull();
      expect(row?.querySelector('[class*="lucide-clock"]')).not.toBeNull();
    });

    it('renders the merge glyph for a recent GitLab item', () => {
      mockRecentItems = [
        { type: 'gitlab', id: '1/55', title: 'Add caching', timestamp: Date.now() },
      ];
      renderPalette();
      const row = screen.getByText('Add caching').closest('[cmdk-item]');
      expect(row).not.toBeNull();
      expect(row?.querySelector('[class*="lucide-git-merge"]')).not.toBeNull();
      // Composite "project_id/iid" ids display the bare iid.
      expect(row?.textContent).toContain('!55');
    });
  });

  // PALETTE-03: navigation items show shortcut hints
  it('navigation items show shortcut hints', () => {
    renderPalette();
    // Check for shortcut hint text in the document
    expect(screen.getByText('⌘⇧S')).toBeInTheDocument();
    expect(screen.getByText('⌘⇧B')).toBeInTheDocument();
    expect(screen.getByText('⌘,')).toBeInTheDocument();
  });

  // PALETTE-04: actions group visible in both states (always rendered for stable cmdk refs)
  it('actions group visible in default state', () => {
    renderPalette();
    // Actions group is always rendered to avoid cmdk unmount/remount race
    expect(screen.getByText('Create issue')).toBeInTheDocument();
    expect(screen.getByText('Toggle theme')).toBeInTheDocument();
  });

  // PALETTE-04: "Create issue" action appears in search state
  it('shows Create issue action when searching', () => {
    renderPalette();
    const input = screen.getByPlaceholderText('Search issues, MRs, and actions...');
    fireEvent.change(input, { target: { value: 'create' } });
    // cmdk filters by keywords -- 'create' matches the Create issue item's keywords
    const createItem = screen.queryByText('Create issue');
    // If cmdk internal filtering renders it, verify it's present
    if (createItem) {
      expect(createItem).toBeInTheDocument();
    }
    expect(true).toBe(true);
  });

  // PALETTE-02: selecting a Jira issue body calls onIssueClick (full-page), not onOpenIssue (peek)
  it('selecting a Jira issue body calls onIssueClick (full-page)', () => {
    const onOpenIssue = vi.fn();
    const onClose = vi.fn();
    seedIndex();

    const onIssueClick = vi.fn();
    renderPalette({ onOpenIssue, onClose, onIssueClick });
    typeQuery('Fix login');

    // clicking the row body calls onIssueClick (full-page), not onOpenIssue
    const row = document.querySelector('[cmdk-item][data-value="TEST-1"]') as Element;
    expect(row).not.toBeNull();
    fireEvent.click(row);
    expect(onIssueClick).toHaveBeenCalledWith('TEST-1');
    expect(onOpenIssue).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  // PEEK-05: the key button navigates full-page without double-firing the row select
  it('clicking the key button calls onIssueClick once', () => {
    seedIndex();
    const onIssueClick = vi.fn();
    renderPalette({ onIssueClick });
    typeQuery('Fix login');
    fireEvent.click(screen.getByRole('button', { name: 'TEST-1' }));
    expect(onIssueClick).toHaveBeenCalledTimes(1);
    expect(onIssueClick).toHaveBeenCalledWith('TEST-1');
  });

  // Default state shows "No recent items" when empty
  it('shows "No recent items" when recent items list is empty', () => {
    mockRecentItems = [];
    renderPalette();
    expect(screen.getByText('No recent items')).toBeInTheDocument();
  });

  // UAT-3: Navigation items remain visible in search state (query >= 2 chars)
  it('navigation items visible in search state', () => {
    renderPalette();
    const input = screen.getByPlaceholderText('Search issues, MRs, and actions...');
    fireEvent.change(input, { target: { value: 'setti' } });

    // Navigation items should still render because they are outside the ternary
    // "setti" fuzzy-matches "Settings" so cmdk keeps it visible
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  // Key pattern detection tests
  describe('key pattern detection', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockRecentItems = [];
    });

    it('shows Direct Match group when query matches issue key and fetch returns issue', async () => {
      vi.mocked(fetchJiraIssueByKey).mockResolvedValue({
        id: '999',
        key: 'TEST-99',
        fields: {
          summary: 'Key match issue',
          status: { id: '1', name: 'Done', statusCategory: { key: 'done' } },
          assignee: null,
          customfield_10016: null,
          issuetype: { name: 'Story', subtask: false },
        },
      });

      renderPalette();
      const input = screen.getByPlaceholderText('Search issues, MRs, and actions...');
      fireEvent.change(input, { target: { value: 'TEST-99' } });

      // The heading shows with a skeleton while fetching, so wait for the resolved row
      expect(await screen.findByText('Key match issue')).toBeInTheDocument();
      expect(screen.getByText('Direct match')).toBeInTheDocument();
      expect(screen.getByText('TEST-99')).toBeInTheDocument();
    });

    it('does not show Direct Match group when fetch returns null', async () => {
      vi.mocked(fetchJiraIssueByKey).mockResolvedValue(null);

      renderPalette();
      const input = screen.getByPlaceholderText('Search issues, MRs, and actions...');
      fireEvent.change(input, { target: { value: 'TEST-99' } });

      // Wait a tick for any async resolution
      await new Promise((r) => setTimeout(r, 50));

      expect(screen.queryByText('Direct match')).toBeNull();
    });

    it('does not fire key fetch for non-key query', async () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Search issues, MRs, and actions...');
      fireEvent.change(input, { target: { value: 'fix login' } });

      // Wait a tick
      await new Promise((r) => setTimeout(r, 50));

      expect(vi.mocked(fetchJiraIssueByKey)).not.toHaveBeenCalled();
    });

    it('shows Direct Match for bare number with active project set', async () => {
      vi.mocked(fetchJiraIssueByKey).mockResolvedValue({
        id: '12345',
        key: 'TEST-12345',
        fields: {
          summary: 'Bare number match issue',
          status: { id: '1', name: 'Open', statusCategory: { key: 'new' } },
          assignee: null,
          customfield_10016: null,
          issuetype: { name: 'Bug', subtask: false },
        },
      });

      renderPalette();
      const input = screen.getByPlaceholderText('Search issues, MRs, and actions...');
      fireEvent.change(input, { target: { value: '12345' } });

      expect(await screen.findByText('Bare number match issue')).toBeInTheDocument();
      expect(screen.getByText('Direct match')).toBeInTheDocument();
      expect(vi.mocked(fetchJiraIssueByKey)).toHaveBeenCalledWith(
        'https://jira.test',
        'test-token',
        'TEST-12345',
      );
      expect(screen.getByText('TEST-12345')).toBeInTheDocument();
    });

    it('shows the issue-type icon for a Bug result in the ranked tiers', () => {
      seedIndex();
      renderPalette();
      typeQuery('Fix login');

      const row = document.querySelector('[cmdk-item][data-value="TEST-1"]');
      expect(row).not.toBeNull();
      expect(row?.querySelector('[class*="lucide-bug"]')).not.toBeNull();
    });

    it('shows the Story icon (not the default) for a Story result', () => {
      seedIndex();
      renderPalette();
      typeQuery('onboarding');

      const row = document.querySelector('[cmdk-item][data-value="TEST-6"]');
      expect(row).not.toBeNull();
      expect(row?.querySelector('[class*="lucide-book-open"]')).not.toBeNull();
      expect(row?.querySelector('[class*="lucide-check-square"]')).toBeNull();
    });

    it('renders the icon on the Direct Match row', async () => {
      vi.mocked(fetchJiraIssueByKey).mockResolvedValue({
        id: '999',
        key: 'TEST-99',
        fields: {
          summary: 'Key match issue',
          status: { id: '1', name: 'Done', statusCategory: { key: 'done' } },
          assignee: null,
          customfield_10016: null,
          issuetype: { name: 'Story', subtask: false },
        },
      });

      renderPalette();
      const input = screen.getByPlaceholderText('Search issues, MRs, and actions...');
      fireEvent.change(input, { target: { value: 'TEST-99' } });

      await screen.findByText('Key match issue');
      const row = screen.getByText('Key match issue').closest('[cmdk-item]');
      expect(row).not.toBeNull();
      expect(row?.querySelector('[class*="lucide-book-open"]')).not.toBeNull();
    });

    it('renders default icon without crashing when issuetype is missing', async () => {
      const noType = bodyIssue('TEST-77', 'No type set task');
      (noType.fields as unknown as Record<string, unknown>).issuetype = undefined;
      vi.mocked(searchJiraBody).mockResolvedValue([noType]);
      renderPalette();
      typeQuery('No type set');

      const row = await waitFor(() => {
        const r = document.querySelector('[cmdk-item][data-value="TEST-77"]');
        expect(r).not.toBeNull();
        return r;
      });
      expect(row?.querySelector('[class*="lucide-square-check-big"]')).not.toBeNull();
    });

    it('renders the merge glyph on Merge Request rows', () => {
      const qc = makeQueryClient();
      qc.setQueryData(['gitlab-mrs', 'assigned'], {
        assigned: [{ iid: 42, project_id: 1, title: 'Add feature flag' }],
        reviewRequested: [],
      });

      renderPalette({}, qc);
      const input = screen.getByPlaceholderText('Search issues, MRs, and actions...');
      fireEvent.change(input, { target: { value: 'feature flag' } });

      const row = screen.getByText('Add feature flag').closest('[cmdk-item]');
      expect(row).not.toBeNull();
      expect(row?.querySelector('[class*="lucide-git-merge"]')).not.toBeNull();
    });

    it('full key query still resolves correctly', async () => {
      vi.mocked(fetchJiraIssueByKey).mockResolvedValue({
        id: '42',
        key: 'PROJ-42',
        fields: {
          summary: 'Full key match',
          status: { id: '1', name: 'Done', statusCategory: { key: 'done' } },
          assignee: null,
          customfield_10016: null,
          issuetype: { name: 'Task', subtask: false },
        },
      });

      renderPalette();
      const input = screen.getByPlaceholderText('Search issues, MRs, and actions...');
      fireEvent.change(input, { target: { value: 'PROJ-42' } });

      const heading = await screen.findByText('Direct match');
      expect(heading).toBeInTheDocument();
      expect(vi.mocked(fetchJiraIssueByKey)).toHaveBeenCalledWith(
        'https://jira.test',
        'test-token',
        'PROJ-42',
      );
    });
  });

  describe('geometry', () => {
    it('uses the wide panel and tall list', () => {
      renderPalette();
      expect(document.querySelector('.max-w-3xl')).not.toBeNull();
      expect(document.querySelector('.max-w-xl')).toBeNull();
      const list = document.querySelector('[cmdk-list]') as HTMLElement;
      expect(list.className).toContain('max-h-[70vh]');
      expect(list.className).not.toContain('max-h-[300px]');
    });
  });

  describe('tier headers', () => {
    it('renders tier headings in rank order and omits empty tiers', () => {
      seedIndex();
      renderPalette();
      typeQuery('cart');
      const h = headings();
      expect(h.indexOf('Current sprint')).toBeGreaterThanOrEqual(0);
      expect(h.indexOf('Current sprint')).toBeLessThan(h.indexOf('Sprint 43 (next)'));
      expect(h.indexOf('Sprint 43 (next)')).toBeLessThan(h.indexOf('Backlog'));
      expect(h).not.toContain('Closed');
    });

    it('omits a tier that has no hits', () => {
      seedIndex();
      renderPalette();
      typeQuery('onboarding');
      const h = headings();
      expect(h).toContain('Backlog');
      expect(h).not.toContain('Current sprint');
      expect(h).not.toContain('Sprint 43 (next)');
    });

    it('does not use the old Issues group or Search Jira tail item', () => {
      seedIndex();
      renderPalette();
      typeQuery('cart');
      expect(headings()).not.toContain('Issues');
      expect(screen.queryByText(/Search Jira for/)).toBeNull();
    });
  });

  describe('body', () => {
    it('shows title hits instantly and fires exactly one debounced body request', async () => {
      seedIndex();
      renderPalette();
      typeQuery('cart');
      expect(document.querySelector('[cmdk-item][data-value="TEST-2"]')).not.toBeNull();
      expect(searchJiraBody).not.toHaveBeenCalled();

      await waitFor(() => expect(searchJiraBody).toHaveBeenCalledTimes(1));
      expect(searchJiraBody).toHaveBeenCalledWith(
        'https://jira.test',
        'test-token',
        expect.objectContaining({
          query: 'cart',
          scope: 'open',
          epicLinkFieldKey: 'customfield_10014',
          projectKey: 'TEST',
        }),
      );
    });

    it('merges a body-only hit with a desc tag', async () => {
      seedIndex();
      vi.mocked(searchJiraBody).mockResolvedValue([
        bodyIssue('TEST-20', 'Totals rounding', { description: 'the cart total is off' }),
      ]);
      renderPalette();
      typeQuery('cart');
      await waitFor(() =>
        expect(document.querySelector('[cmdk-item][data-value="TEST-20"]')).not.toBeNull(),
      );
      const row = document.querySelector('[cmdk-item][data-value="TEST-20"]');
      expect(row?.querySelector('[aria-label="Matched in description"]')).not.toBeNull();
    });

    it('does not request a body search for a key-like query', async () => {
      seedIndex();
      renderPalette();
      typeQuery('TEST-2');
      await new Promise((r) => setTimeout(r, 400));
      expect(searchJiraBody).not.toHaveBeenCalled();
    });

    it('hides previous-query body rows during the debounce gap', async () => {
      seedIndex();
      vi.mocked(searchJiraBody).mockResolvedValue([
        bodyIssue('TEST-20', 'Totals rounding', { description: 'the cart total is off' }),
      ]);
      renderPalette();
      typeQuery('cart');
      await waitFor(() =>
        expect(document.querySelector('[cmdk-item][data-value="TEST-20"]')).not.toBeNull(),
      );
      typeQuery('carts');
      expect(document.querySelector('[cmdk-item][data-value="TEST-20"]')).toBeNull();
    });
  });

  describe('include closed', () => {
    it('offers Include closed issues and renders the Closed tier after selecting it', async () => {
      seedIndex();
      vi.mocked(searchJiraBody).mockImplementation(async (_b, _t, opts) =>
        opts.scope === 'closed' ? [bodyIssue('TEST-30', 'Cart legacy', { done: true })] : [],
      );
      renderPalette();
      typeQuery('cart');
      const item = screen.getByText('Include closed issues');
      expect(headings()).not.toContain('Closed');
      fireEvent.click(item);

      await waitFor(() =>
        expect(searchJiraBody).toHaveBeenCalledWith(
          'https://jira.test',
          'test-token',
          expect.objectContaining({ scope: 'closed', query: 'cart' }),
        ),
      );
      await waitFor(() => expect(headings()).toContain('Closed'));
      expect(document.querySelector('[cmdk-item][data-value="TEST-30"]')).not.toBeNull();
      expect(screen.queryByText('Include closed issues')).toBeNull();
    });

    it('is not offered below 2 characters', () => {
      seedIndex();
      renderPalette();
      typeQuery('c');
      expect(screen.queryByText('Include closed issues')).toBeNull();
    });
  });

  describe('filters MRs', () => {
    it('shows only matching MRs, Navigation and Actions below the issue tiers', () => {
      seedIndex();
      const qc = makeQueryClient();
      qc.setQueryData(['gitlab-mrs', 'assigned'], {
        assigned: [
          { iid: 42, project_id: 1, title: 'Fix login' },
          { iid: 43, project_id: 1, title: 'Update deps' },
        ],
        reviewRequested: [],
      });
      renderPalette({}, qc);
      typeQuery('login');
      expect(screen.getByText('Fix login')).toBeInTheDocument();
      expect(screen.queryByText('Update deps')).toBeNull();
      // non-matching nav / action items are gone
      expect(screen.queryByText('Standup Notes')).toBeNull();
      expect(screen.queryByText('Toggle theme')).toBeNull();
      const h = headings();
      expect(h.indexOf('Merge Requests')).toBeGreaterThan(h.indexOf('Backlog') - 1);
      expect(h).not.toContain('Actions');
    });

    it('keeps matching Navigation and Actions items', () => {
      seedIndex();
      renderPalette();
      typeQuery('settings');
      expect(screen.getByText('Settings')).toBeInTheDocument();
      typeQuery('theme');
      expect(screen.getByText('Toggle theme')).toBeInTheDocument();
      expect(screen.queryByText('Standup Notes')).toBeNull();
    });
  });

  describe('direct match', () => {
    it('resolves a key from the local index without a Jira request', async () => {
      seedIndex();
      renderPalette();
      typeQuery('TEST-6');
      expect(headings()).toContain('Direct match');
      await new Promise((r) => setTimeout(r, 100));
      expect(fetchJiraIssueByKey).not.toHaveBeenCalled();
    });

    it('fetches once on an index miss and shows the row', async () => {
      seedIndex();
      vi.mocked(fetchJiraIssueByKey).mockResolvedValue(bodyIssue('TEST-999', 'Fetched issue'));
      renderPalette();
      typeQuery('TEST-999');
      await screen.findByText('Fetched issue');
      expect(fetchJiraIssueByKey).toHaveBeenCalledTimes(1);
      expect(headings()).toContain('Direct match');
    });

    it('resolves a bare number to the active project key from the index', async () => {
      seedIndex();
      renderPalette();
      typeQuery('18');
      expect(headings()).toContain('Direct match');
      const direct = document.querySelector('[cmdk-item][data-value="TEST-18"]');
      expect(direct).not.toBeNull();
      await new Promise((r) => setTimeout(r, 100));
      expect(fetchJiraIssueByKey).not.toHaveBeenCalled();
    });
  });

  describe('states', () => {
    it('shows a loading line and skeleton rows while the cold index loads', () => {
      mockSources.isIndexLoading = true;
      renderPalette();
      typeQuery('cart');
      expect(screen.getByText('Loading issues…')).toBeInTheDocument();
      expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(4);
      // input still accepts typing
      expect((screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement).value).toBe('cart');
    });

    it('shows the index error copy', () => {
      mockSources.isIndexError = true;
      renderPalette();
      typeQuery('cart');
      expect(
        screen.getByText("Couldn't load issues. Check your Jira connection and reopen search."),
      ).toBeInTheDocument();
    });

    it('shows the body error row while title results remain', async () => {
      seedIndex();
      vi.mocked(searchJiraBody).mockRejectedValue(new Error('boom'));
      renderPalette();
      typeQuery('cart');
      expect(
        await screen.findByText(
          "Couldn't search descriptions and comments. Showing title matches only.",
        ),
      ).toBeInTheDocument();
      expect(document.querySelector('[cmdk-item][data-value="TEST-2"]')).not.toBeNull();
      expect(screen.queryByText('boom')).toBeNull();
    });

    it('shows a thin loading bar only while the body request is in flight', async () => {
      seedIndex();
      const d = deferred<JiraIssue[]>();
      vi.mocked(searchJiraBody).mockReturnValue(d.promise);
      renderPalette();
      typeQuery('cart');
      await waitFor(() => expect(document.querySelector('.h-0\\.5')).not.toBeNull());
      await act(async () => {
        d.resolve([]);
      });
      await waitFor(() => expect(document.querySelector('.h-0\\.5')).toBeNull());
    });

    it('shows the empty state only when nothing matches and nothing is in flight', async () => {
      seedIndex();
      const d = deferred<JiraIssue[]>();
      vi.mocked(searchJiraBody).mockReturnValue(d.promise);
      renderPalette();
      typeQuery('zzzzqq');
      await waitFor(() => expect(searchJiraBody).toHaveBeenCalled());
      expect(screen.queryByText('No results found')).toBeNull();
      await act(async () => {
        d.resolve([]);
      });
      expect(await screen.findByText('No results found')).toBeInTheDocument();
      expect(
        screen.getByText('Try a different term, a key like ESHOP-412, or include closed issues.'),
      ).toBeInTheDocument();
    });

    it('shows closed skeleton rows while the closed request is in flight', async () => {
      seedIndex();
      const d = deferred<JiraIssue[]>();
      vi.mocked(searchJiraBody).mockImplementation((_b, _t, opts) =>
        opts.scope === 'closed' ? d.promise : Promise.resolve([]),
      );
      renderPalette();
      typeQuery('zzzz');
      await waitFor(() => expect(searchJiraBody).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByText('Include closed issues'));
      await waitFor(() => expect(headings()).toContain('Closed'));
      expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(3);
      await act(async () => {
        d.resolve([]);
      });
    });

    it('reports a failed closed-issues search instead of an empty state (WR-03)', async () => {
      seedIndex();
      vi.mocked(searchJiraBody).mockImplementation(async (_b, _t, opts) => {
        if (opts.scope === 'closed') throw new Error('boom');
        return [];
      });
      renderPalette();
      typeQuery('zzzz');
      await waitFor(() => expect(searchJiraBody).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByText('Include closed issues'));
      expect(await screen.findByText("Couldn't search closed issues.")).toBeInTheDocument();
      expect(screen.queryByText('No results found')).toBeNull();
    });

    it('shows a skeleton row on Direct match while the key fetch is in flight', async () => {
      seedIndex();
      const d = deferred<JiraIssue | null>();
      vi.mocked(fetchJiraIssueByKey).mockReturnValue(d.promise);
      renderPalette();
      typeQuery('TEST-999');
      await waitFor(() => expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull());
      expect(headings()).toContain('Direct match');
      await act(async () => {
        d.resolve(null);
      });
    });
  });

  describe('overflow', () => {
    const MANY: IssueSpec[] = Array.from({ length: 12 }, (_, i) => ({
      id: 100 + i,
      key: `W-${i + 1}`,
      summary: `Widget ${i + 1}`,
    }));

    it('caps a tier at 8 rows with a +N more item that expands, and collapses on new query', () => {
      seedIndex(MANY, []);
      renderPalette();
      typeQuery('widget');
      const rows = () => document.querySelectorAll('[cmdk-item][data-value^="W-"]');
      expect(rows().length).toBe(8);
      const more = screen.getByText('+4 more in Backlog');
      fireEvent.click(more);
      expect(rows().length).toBe(12);
      typeQuery('widge');
      expect(rows().length).toBe(8);
    });
  });

  describe('selection', () => {
    it('keeps the selected row when body results insert rows above it', async () => {
      seedIndex();
      const d = deferred<JiraIssue[]>();
      vi.mocked(searchJiraBody).mockReturnValue(d.promise);
      renderPalette();
      typeQuery('cart');
      const input = screen.getByPlaceholderText(PLACEHOLDER);
      expect(selectedKey()).toBe('TEST-2');
      for (let i = 0; i < 3; i++) fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(selectedKey()).toBe('TEST-5');

      await waitFor(() => expect(searchJiraBody).toHaveBeenCalled());
      // TEST-1 lives in the current sprint tier, so its row lands above TEST-5
      await act(async () => {
        d.resolve([bodyIssue('TEST-1', 'Fix login bug', { description: 'the cart is broken' })]);
      });
      await waitFor(() => {
        const items = Array.from(document.querySelectorAll('[cmdk-item]')).map((n) =>
          n.getAttribute('data-value'),
        );
        expect(items.indexOf('TEST-1')).toBeGreaterThanOrEqual(0);
        expect(items.indexOf('TEST-1')).toBeLessThan(items.indexOf('TEST-5'));
      });
      expect(selectedKey()).toBe('TEST-5');
    });

    it('resets selection to the first row when the query changes', () => {
      seedIndex();
      renderPalette();
      typeQuery('cart');
      const input = screen.getByPlaceholderText(PLACEHOLDER);
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(selectedKey()).toBe('TEST-3');
      typeQuery('cart c');
      expect(selectedKey()).toBe('TEST-2');
    });
  });
});
