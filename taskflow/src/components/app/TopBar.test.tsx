// NOTF-04: TopBar renders badge with unread count
// PALETTE-01: Search icon calls onPaletteOpen
// RECENT-01: Clock icon (RecentItemsPopover) rendered

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '../../stores/notifications.store';
import { useNotificationsStore } from '../../stores/notifications.store';
import TopBar from './TopBar';

vi.mock('@/hooks/useGlobalSearchSources', () => ({
  useGlobalSearchSources: vi.fn(() => ({
    boardId: null,
    backlog: undefined,
    allData: undefined,
    isIndexLoading: false,
    isIndexError: false,
  })),
}));

function makeItem(id: string): NotificationItem {
  return {
    id,
    source: 'jira',
    entityTitle: `Entity ${id}`,
    author: 'A.Author',
    bodyPreview: 'Preview',
    fullBody: 'Full body',
    createdAt: '2026-03-11T10:00:00.000Z',
  };
}

const defaultProps = {
  paletteOpen: false,
  onPaletteOpen: vi.fn(),
  notifPopoverOpen: false,
  onNotifPopoverChange: vi.fn(),
};

function renderTopBar(overrides: Partial<typeof defaultProps> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TopBar {...defaultProps} {...overrides} />
    </QueryClientProvider>,
  );
}

describe('TopBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    act(() => {
      useNotificationsStore.setState({
        items: [],
        readIds: [],
        lastSeenCursor: null,
        permissionDenied: false,
      });
    });
  });

  it('renders badge with text "3" when unreadCount is 3', () => {
    const items = [makeItem('item-1'), makeItem('item-2'), makeItem('item-3')];
    act(() => {
      useNotificationsStore.setState({ items, readIds: [], _unreadCount: 3 });
    });

    renderTopBar();

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('badge counts unread CARDS: same-actor consecutive comments on one issue count once', () => {
    const c = (id: string, min: number): NotificationItem => ({
      ...makeItem(id),
      entityTitle: 'PROJ-9: Same issue',
      notificationType: 'jira-comment',
      createdAt: new Date(Date.now() - (60 - min) * 60_000).toISOString(),
    });
    const items = [c('m1', 0), c('m2', 10), c('m3', 20)];
    act(() => {
      useNotificationsStore.setState({ items, readIds: [], _unreadCount: 3 });
    });
    renderTopBar();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders badge with "99+" when unreadCount is 100', () => {
    const items = Array.from({ length: 100 }, (_, i) => makeItem(`item-${i}`));
    act(() => {
      useNotificationsStore.setState({ items, readIds: [], _unreadCount: 100 });
    });

    renderTopBar();

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('does not render badge when unreadCount is 0', () => {
    act(() => {
      useNotificationsStore.setState({ items: [], readIds: [], _unreadCount: 0 });
    });

    renderTopBar();

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('clicking search icon calls onPaletteOpen', () => {
    const onPaletteOpen = vi.fn();
    renderTopBar({ onPaletteOpen });

    fireEvent.click(screen.getByLabelText('Search'));

    expect(onPaletteOpen).toHaveBeenCalledOnce();
  });

  it('renders clock icon for recent items', () => {
    renderTopBar();

    expect(screen.getByLabelText('Recent Items')).toBeInTheDocument();
  });

  it('forwards onOpenSettings to the notification popover overflow menu', async () => {
    const onOpenSettings = vi.fn();
    renderTopBar({ notifPopoverOpen: true, onOpenSettings } as never);

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Notification settings' }));

    expect(onOpenSettings).toHaveBeenCalledOnce();
  });
});
