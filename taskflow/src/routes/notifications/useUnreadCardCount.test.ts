import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '../../stores/notifications.store';
import { useNotificationsStore } from '../../stores/notifications.store';
import { useUnreadCardCount } from './useUnreadCardCount';

const comment = (id: string, createdAt: Date): NotificationItem => ({
  id,
  source: 'jira',
  entityTitle: 'PROJ-9: Same issue',
  author: 'Ben Carter',
  bodyPreview: id,
  fullBody: id,
  createdAt: createdAt.toISOString(),
  notificationType: 'jira-comment',
});

describe('useUnreadCardCount', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(2026, 10, 10, 0, 30) });
  });
  afterEach(() => {
    vi.useRealTimers();
    act(() => {
      useNotificationsStore.setState({ items: [], readIds: [] });
    });
  });

  it('WR-02: re-buckets on the clock, not only when items change', () => {
    // 23:30 yesterday + 00:20 today: split by the day boundary -> 2 cards.
    act(() => {
      useNotificationsStore.setState({
        items: [
          comment('b', new Date(2026, 10, 10, 0, 20)),
          comment('a', new Date(2026, 10, 9, 23, 30)),
        ],
        readIds: [],
      });
    });
    const { result } = renderHook(() => useUnreadCardCount());
    expect(result.current).toBe(2);

    // Two days later both sit in "This week" and merge into one card (as the popover shows).
    act(() => {
      vi.advanceTimersByTime(2 * 86_400_000);
    });
    expect(result.current).toBe(1);
  });

  it('counts cards, not stacks: three cards on one issue are 3 unread', () => {
    const by = (id: string, author: string, min: number): NotificationItem => ({
      ...comment(id, new Date(2026, 10, 10, 0, min)),
      author,
    });
    act(() => {
      useNotificationsStore.setState({
        items: [by('a', 'Ana Lee', 5), by('b', 'Ben Ito', 10), by('c', 'Cara Doe', 15)],
        readIds: [],
      });
    });
    const { result } = renderHook(() => useUnreadCardCount());
    expect(result.current).toBe(3);
  });
});
