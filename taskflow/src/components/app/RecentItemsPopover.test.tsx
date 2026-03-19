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
    fireEvent.click(row.closest('button')!);

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
    fireEvent.click(row.closest('button')!);

    expect(onMRClick).toHaveBeenCalledWith('77');
  });

  it('RECENT-01: shows header "Recent Items"', async () => {
    renderWithQueryClient(<RecentItemsPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'Recent Items' }));
    expect(await screen.findByText('Recent Items')).toBeInTheDocument();
  });
});
