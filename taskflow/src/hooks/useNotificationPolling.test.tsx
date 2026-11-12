import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/auth.store';
import { useNotificationBanners } from '../stores/notification-banners.store';
import { useNotificationDispatchLogStore } from '../stores/notification-dispatch-log.store';
import { useNotificationsStore } from '../stores/notifications.store';
import { useSettingsStore } from '../stores/settings.store';
import { useNotificationPolling } from './useNotificationPolling';

const fetchNew = vi.fn();
const dispatch = vi.fn().mockResolvedValue('sent');
vi.mock('../services/notifications', () => ({
  fetchNewNotifications: (...a: unknown[]) => fetchNew(...a),
  tryDispatchOsNotification: (...a: unknown[]) => dispatch(...a),
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    dispatch.mockResolvedValue('sent');
    fetchNew.mockReset();
    dispatch.mockClear();
    act(() => {
      useAuthStore.setState({
        jiraBaseUrl: 'https://jira.example.test',
        gitlabBaseUrl: null,
      } as never);
      useSettingsStore.setState({ notifBannerDurationSecs: 5, devToolsEnabled: true });
      useNotificationDispatchLogStore.getState().clear();
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

  const pollOnce = async (desktop: boolean) => {
    act(() => {
      useSettingsStore.setState({ desktopNotificationsEnabled: desktop });
      useNotificationsStore.setState({ lastSeenJiraCursor: '2026-11-11T09:00:00.000Z' } as never);
    });
    // First successful poll is the initial load, so run two: the second one produces banners.
    fetchNew.mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => {
        useNotificationPolling();
        return useNotificationsStore((s) => s.retryFetch);
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current).toBeTypeOf('function'));
    await waitFor(() => expect(fetchNew).toHaveBeenCalledTimes(1));
    fetchNew.mockResolvedValueOnce([item('new-1')]);
    await act(async () => {
      result.current?.();
    });
    await waitFor(() => expect(useNotificationsStore.getState().items.length).toBe(1));
  };

  it('switch on: new items are pushed as OS notifications', async () => {
    await pollOnce(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('switch off: no OS notification, but the panel list and the banner still get the item', async () => {
    await pollOnce(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(useNotificationsStore.getState().items.map((i) => i.id)).toEqual(['new-1']);
    expect(useNotificationBanners.getState().ids).toEqual(['new-1']);
  });

  const logged = () => useNotificationDispatchLogStore.getState().entries;

  it('dev tools + switch on: records the exact title/body and result', async () => {
    await pollOnce(true);
    await waitFor(() => expect(logged()).toHaveLength(1));
    expect(logged()[0]).toEqual(
      expect.objectContaining({
        outcome: 'sent',
        title: 'PROJ-1 · Title',
        body: 'Cara: body',
        item: expect.objectContaining({ id: 'new-1' }),
      }),
    );
    expect(dispatch).toHaveBeenCalledWith('PROJ-1 · Title', 'Cara: body');
  });

  it('switch off: nothing is recorded', async () => {
    await pollOnce(false);
    expect(logged()).toEqual([]);
  });

  it('dev tools off: nothing is recorded but the OS dispatch still runs', async () => {
    act(() => {
      useSettingsStore.setState({ devToolsEnabled: false });
    });
    await pollOnce(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(logged()).toEqual([]);
  });

  it('already-known items are recorded as skipped', async () => {
    act(() => {
      useSettingsStore.setState({ desktopNotificationsEnabled: true });
      useNotificationsStore.setState({ items: [item('known-1')] } as never);
    });
    fetchNew.mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => {
        useNotificationPolling();
        return useNotificationsStore((s) => s.retryFetch);
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current).toBeTypeOf('function'));
    await waitFor(() => expect(fetchNew).toHaveBeenCalledTimes(1));
    fetchNew.mockResolvedValueOnce([item('known-1'), item('new-2')]);
    await act(async () => {
      result.current?.();
    });
    await waitFor(() => expect(logged()).toHaveLength(2));
    expect(logged().map((e) => [(e as { item: { id: string } }).item.id, e.outcome])).toEqual([
      ['new-2', 'sent'],
      ['known-1', 'skipped'],
    ]);
  });

  it('a burst of more than 3 fresh items sends one summary banner and logs grouped rows', async () => {
    act(() => {
      useSettingsStore.setState({ desktopNotificationsEnabled: true });
    });
    fetchNew.mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => {
        useNotificationPolling();
        return useNotificationsStore((s) => s.retryFetch);
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current).toBeTypeOf('function'));
    await waitFor(() => expect(fetchNew).toHaveBeenCalledTimes(1));
    fetchNew.mockResolvedValueOnce([item('b1'), item('b2'), item('b3'), item('b4')]);
    await act(async () => {
      result.current?.();
    });
    await waitFor(() => expect(logged()).toHaveLength(5));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('4 new notifications', '4 Jira');
    // Newest first: the summary entry was appended first, so it is last.
    expect(logged().map((e) => e.outcome)).toEqual([
      'grouped',
      'grouped',
      'grouped',
      'grouped',
      'sent',
    ]);
    const summary = logged()[4];
    expect(summary.kind).toBe('summary');
    expect(summary.title).toBe('4 new notifications');
  });

  it('a denied summary send still raises the permission flag', async () => {
    dispatch.mockResolvedValue('denied');
    act(() => {
      useSettingsStore.setState({ desktopNotificationsEnabled: true });
    });
    fetchNew.mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => {
        useNotificationPolling();
        return useNotificationsStore((s) => s.retryFetch);
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current).toBeTypeOf('function'));
    await waitFor(() => expect(fetchNew).toHaveBeenCalledTimes(1));
    fetchNew.mockResolvedValueOnce([item('d1'), item('d2'), item('d3'), item('d4')]);
    await act(async () => {
      result.current?.();
    });
    await waitFor(() => expect(logged().some((e) => e.outcome === 'denied')).toBe(true));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('never moves the Jira cursor backwards (edited comment keeps its older created)', async () => {
    act(() => {
      useNotificationsStore.setState({ lastSeenJiraCursor: '2026-11-11T09:00:00.000Z' } as never);
    });
    fetchNew.mockResolvedValueOnce([
      { ...item('edited-1'), createdAt: '2026-11-10T08:00:00.000Z' },
    ]);
    renderHook(() => useNotificationPolling(), { wrapper });
    await waitFor(() => expect(useNotificationsStore.getState().items.length).toBe(1));
    expect(useNotificationsStore.getState().lastSeenJiraCursor).toBe('2026-11-11T09:00:00.000Z');
  });
});
