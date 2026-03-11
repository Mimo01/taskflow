// NOTF-04: TopBar renders badge with unread count
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
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

describe('TopBar', () => {
  beforeEach(() => {
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

    render(<TopBar />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders badge with "99+" when unreadCount is 100', () => {
    const items = Array.from({ length: 100 }, (_, i) => makeItem(`item-${i}`));
    act(() => {
      useNotificationsStore.setState({ items, readIds: [] });
    });

    render(<TopBar />);

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('does not render badge when unreadCount is 0', () => {
    act(() => {
      useNotificationsStore.setState({ items: [], readIds: [] });
    });

    render(<TopBar />);

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
