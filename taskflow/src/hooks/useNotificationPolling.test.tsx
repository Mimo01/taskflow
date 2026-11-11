import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/auth.store';
import { useNotificationBanners } from '../stores/notification-banners.store';
import { useNotificationsStore } from '../stores/notifications.store';
import { useSettingsStore } from '../stores/settings.store';
import { useNotificationPolling } from './useNotificationPolling';

const fetchNew = vi.fn();
vi.mock('../services/notifications', () => ({
  fetchNewNotifications: (...a: unknown[]) => fetchNew(...a),
  tryDispatchOsNotification: () => Promise.resolve('sent'),
}));
vi.mock('../services/stronghold', () => ({ readSecret: () => Promise.resolve('pat') }));
vi.mock('../services/jira', () => ({ validateJira: () => Promise.resolve(null) }));
vi.mock('../services/gitlab', () => ({
  fetchAssignedMRs: vi.fn(),
  fetchAuthoredMRs: vi.fn(),
  fetchReviewerMRs: vi.fn(),
}));

const item = (id: string) => ({
  id,
  source: 'jira' as const,
  entityTitle: 'PROJ-1: Title',
  author: 'Cara Doe',
  bodyPreview: 'body',
  fullBody: 'body',
  createdAt: '2026-11-11T10:00:00.000Z',
  notificationType: 'jira-comment' as const,
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useNotificationPolling banners', () => {
  beforeEach(() => {
    fetchNew.mockReset();
    act(() => {
      useAuthStore.setState({
        jiraBaseUrl: 'https://jira.example.test',
        gitlabBaseUrl: null,
      } as never);
      useSettingsStore.setState({ notifBannerDurationSecs: 5 });
      useNotificationBanners.setState({ ids: [], suppressed: false });
      useNotificationsStore.setState({
        items: [],
        readIds: [],
        dismissedIds: [],
        lastSeenJiraCursor: '2026-11-11T09:00:00.000Z',
        lastSeenGitlabCursor: null,
      } as never);
    });
  });

  it('WR-02: a failed first fetch does not turn the next poll into a banner-producing one', async () => {
    fetchNew.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(
      () => {
        useNotificationPolling();
        return useNotificationsStore((s) => s.retryFetch);
      },
      { wrapper },
    );
    await waitFor(() => expect(fetchNew).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current).toBeTypeOf('function'));
    fetchNew.mockResolvedValueOnce([item('backlog-1')]);
    await act(async () => {
      result.current?.();
    });
    await waitFor(() => expect(fetchNew).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(useNotificationsStore.getState().items.length).toBe(1));
    // Still the first *successful* poll: the backlog must not pop up.
    expect(useNotificationBanners.getState().ids).toEqual([]);
  });
});
