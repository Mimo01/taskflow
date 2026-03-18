// NOTF-04: TopBar renders badge with unread count
// PALETTE-01: Search icon calls onPaletteOpen
// RECENT-01: Clock icon (RecentItemsPopover) rendered
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TopBar from './TopBar';
import { useNotificationsStore } from '../../stores/notifications.store';
import type { NotificationItem } from '../../stores/notifications.store';

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
      useNotificationsStore.setState({ items, readIds: [] });
    });

    renderTopBar();

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders badge with "99+" when unreadCount is 100', () => {
    const items = Array.from({ length: 100 }, (_, i) => makeItem(`item-${i}`));
    act(() => {
      useNotificationsStore.setState({ items, readIds: [] });
    });

    renderTopBar();

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('does not render badge when unreadCount is 0', () => {
    act(() => {
      useNotificationsStore.setState({ items: [], readIds: [] });
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
});
