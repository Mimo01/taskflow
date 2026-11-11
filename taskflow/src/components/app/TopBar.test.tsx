// NOTF-04: TopBar renders badge with unread count
// PALETTE-01: Search icon calls onPaletteOpen
// RECENT-01: Clock icon (RecentItemsPopover) rendered

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('TopBar bell pulse (WR-04)', () => {
  const ring = (c: HTMLElement) => c.querySelector('.animate-bell-ring');
  const reset = () => {
    act(() => {
      useNotificationsStore.setState({
        items: [],
        readIds: [],
        _unreadCount: 0,
        _jiraUnreadCount: 0,
        _gitlabUnreadCount: 0,
      });
    });
  };

  beforeEach(reset);
  afterEach(() => {
    vi.useRealTimers();
    reset();
  });

  it('rings on a new arrival and stops after 2s', () => {
    vi.useFakeTimers();
    const { container } = renderTopBar();
    act(() => {
      useNotificationsStore.getState().prependItems([makeItem('n1')]);
    });
    expect(ring(container)).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(ring(container)).toBeNull();
  });

  it('rings the bell and pops the badge on an arrival while the panel is open', () => {
    vi.useFakeTimers();
    const { container } = renderTopBar({ notifPopoverOpen: true });
    act(() => {
      useNotificationsStore.getState().prependItems([makeItem('n1')]);
    });
    expect(ring(container)).not.toBeNull();
    expect(container.querySelector('[class*="notif-badge-pop"]')).not.toBeNull();
    // a second arrival while still open rings again (the open-effect must not swallow it)
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(ring(container)).toBeNull();
    act(() => {
      useNotificationsStore.getState().prependItems([makeItem('n2')]);
    });
    expect(ring(container)).not.toBeNull();
  });

  it('does not stick on when the count drops within the 2s window', () => {
    vi.useFakeTimers();
    const { container } = renderTopBar();
    act(() => {
      useNotificationsStore.getState().prependItems([makeItem('n1'), makeItem('n2')]);
    });
    expect(ring(container)).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(500);
      useNotificationsStore.getState().markItemsRead(['n1', 'n2']);
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(ring(container)).toBeNull();
  });

  it('does not ring when persisted notifications rehydrate on launch', async () => {
    const storage = useNotificationsStore.persist.getOptions().storage;
    await storage?.setItem('notifications-store', {
      state: { items: [makeItem('p1'), makeItem('p2')], readIds: [] },
      version: 0,
    } as never);
    const { container } = renderTopBar();
    expect(ring(container)).toBeNull();
    await act(async () => {
      await useNotificationsStore.persist.rehydrate();
    });
    expect(useNotificationsStore.getState()._unreadCount).toBe(2);
    expect(ring(container)).toBeNull();
    await storage?.removeItem('notifications-store');
  });
});

describe('TopBar swipe-right to close (261111-m0g UAT)', () => {
  const popup = () => document.querySelector('[data-notif-motion]') as HTMLElement;

  it('a two-finger swipe right over the open panel closes it with a slide-out', () => {
    const onNotifPopoverChange = vi.fn();
    renderTopBar({ notifPopoverOpen: true, onNotifPopoverChange });
    fireEvent.wheel(popup(), { deltaX: -20, deltaY: 0 });
    expect(onNotifPopoverChange).not.toHaveBeenCalled();
    fireEvent.wheel(popup(), { deltaX: -25, deltaY: 0 });
    expect(onNotifPopoverChange).toHaveBeenCalledWith(false);
    expect(popup().getAttribute('data-swipe-closing')).toBe('true');
  });

  it('the swipe works with the pointer anywhere in the window, not only over the panel', () => {
    const onNotifPopoverChange = vi.fn();
    renderTopBar({ notifPopoverOpen: true, onNotifPopoverChange });
    fireEvent.wheel(document.body, { deltaX: -50, deltaY: 0 });
    expect(onNotifPopoverChange).toHaveBeenCalledWith(false);
  });

  it('no window swipe listener while the panel is closed', () => {
    const onNotifPopoverChange = vi.fn();
    renderTopBar({ notifPopoverOpen: false, onNotifPopoverChange });
    fireEvent.wheel(document.body, { deltaX: -80, deltaY: 0 });
    expect(onNotifPopoverChange).not.toHaveBeenCalled();
  });

  it('vertical scrolling and leftward swipes do not close the panel', () => {
    const onNotifPopoverChange = vi.fn();
    renderTopBar({ notifPopoverOpen: true, onNotifPopoverChange });
    fireEvent.wheel(popup(), { deltaX: -5, deltaY: 120 });
    fireEvent.wheel(popup(), { deltaX: 90, deltaY: 0 });
    expect(onNotifPopoverChange).not.toHaveBeenCalled();
  });
});
