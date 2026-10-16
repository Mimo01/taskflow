import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecentItem } from '../../stores/recent-items.store';
import { useRecentItemsStore } from '../../stores/recent-items.store';
import RecentItemsPopover from './RecentItemsPopover';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));

vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  },
}));

const mockSources = vi.hoisted(() => ({
  boardId: 1 as number | null,
  backlog: undefined as unknown,
  allData: undefined as unknown,
  isIndexLoading: false,
  isIndexError: false,
}));
vi.mock('@/hooks/useGlobalSearchSources', () => ({
  useGlobalSearchSources: vi.fn(() => mockSources),
}));

/** Minimal GreenHopper backlog envelope with one in-progress story. */
const BACKLOG = {
  issues: [
    {
      id: 1,
      key: 'PROJ-5',
      hidden: false,
      typeId: '1',
      summary: 'Indexed story',
      priorityId: '1',
      done: false,
      statusId: '2',
      fixVersions: [],
      projectId: 1,
    },
  ],
  entityData: {
    statuses: {
      '2': {
        statusName: 'In Progress',
        status: { id: '2', name: 'In Progress', statusCategory: { id: '4', key: 'indeterminate' } },
      },
    },
    priorities: {},
    types: { '1': { typeName: 'Story' } },
    epics: {},
  },
  sprints: [],
};

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function setStoreItems(items: RecentItem[]) {
  useRecentItemsStore.setState({ items });
}

describe('RecentItemsPopover', () => {
  beforeEach(() => {
    useRecentItemsStore.setState({ items: [] });
    mockSources.backlog = undefined;
  });

  it('RECENT-01: renders clock icon trigger with aria-label', () => {
    renderWithQueryClient(<RecentItemsPopover />);
    expect(screen.getByRole('button', { name: 'Recent Items' })).toBeInTheDocument();
  });

  it('RECENT-01: shows empty state when no items', async () => {
    renderWithQueryClient(<RecentItemsPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'Recent Items' }));
    expect(await screen.findByText('No recent items yet')).toBeInTheDocument();
  });

  it('RECENT-01: shows recent items when store has data', async () => {
    setStoreItems([
      { type: 'jira', id: 'PROJ-42', timestamp: Date.now() },
      { type: 'gitlab', id: '99', url: 'https://gitlab.com/mr/99', timestamp: Date.now() - 1000 },
    ]);

    renderWithQueryClient(<RecentItemsPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'Recent Items' }));

    expect(await screen.findByText('PROJ-42')).toBeInTheDocument();
    expect(screen.getByText('!99')).toBeInTheDocument();
  });

  it('RECENT-02: clicking Jira item calls onIssueClick', async () => {
    const onIssueClick = vi.fn();
    setStoreItems([{ type: 'jira', id: 'PROJ-10', timestamp: Date.now() }]);

    renderWithQueryClient(<RecentItemsPopover onIssueClick={onIssueClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recent Items' }));

    const row = await screen.findByText('PROJ-10');
    fireEvent.click(row.closest('button') as HTMLButtonElement);

    expect(onIssueClick).toHaveBeenCalledWith('PROJ-10');
  });

  it('RECENT-02: clicking GitLab item calls onMRClick', async () => {
    const onMRClick = vi.fn();
    setStoreItems([
      { type: 'gitlab', id: '77', url: 'https://gitlab.com/mr/77', timestamp: Date.now() },
    ]);

    renderWithQueryClient(<RecentItemsPopover onMRClick={onMRClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recent Items' }));

    const row = await screen.findByText('!77');
    fireEvent.click(row.closest('button') as HTMLButtonElement);

    expect(onMRClick).toHaveBeenCalledWith('77');
  });

  it('RECENT-01: shows header "Recent Items"', async () => {
    renderWithQueryClient(<RecentItemsPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'Recent Items' }));
    expect(await screen.findByText('Recent Items')).toBeInTheDocument();
  });

  it('renders the shared row with status pill for an issue found in the search index', async () => {
    mockSources.backlog = BACKLOG;
    setStoreItems([{ type: 'jira', id: 'PROJ-5', title: 'Stale title', timestamp: Date.now() }]);

    renderWithQueryClient(<RecentItemsPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'Recent Items' }));

    const title = await screen.findByText('Indexed story');
    const row = title.closest('button') as HTMLButtonElement;
    expect(row.textContent).toContain('PROJ-5');
    expect(row.textContent).toContain('In Progress');
    expect(screen.queryByText('Stale title')).toBeNull();
  });

  it('displays the bare iid for composite GitLab ids', async () => {
    setStoreItems([{ type: 'gitlab', id: '12/67', title: 'Fix login', timestamp: Date.now() }]);

    renderWithQueryClient(<RecentItemsPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'Recent Items' }));

    expect(await screen.findByText('!67')).toBeInTheDocument();
    expect(screen.getByText('Fix login')).toBeInTheDocument();
  });
});
