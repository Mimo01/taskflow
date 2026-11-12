import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificationBanners } from '../../stores/notification-banners.store';
import { useNotificationsStore } from '../../stores/notifications.store';
import { usePeekStore } from '../../stores/peek.store';
import { useSettingsStore } from '../../stores/settings.store';
import NotificationBanners from './NotificationBanners';

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));
vi.mock('./usePersonAvatar', () => ({
  usePersonAvatar: (_n: string, _s: string, _k: string | null, captured?: string) =>
    captured ?? null,
}));
vi.mock('@/lib/useDetectedBrowsers', () => ({ useDetectedBrowsers: () => [] }));

const mk = (id: string, key = 'PROJ-1', extra = {}) => ({
  id,
  source: 'jira' as const,
  entityTitle: `${key}: Title ${key}`,
  author: 'Cara Doe',
  bodyPreview: 'body',
  fullBody: 'body',
  createdAt: new Date().toISOString(),
  notificationType: 'jira-comment' as const,
  ...extra,
});

function setup(props: Partial<React.ComponentProps<typeof NotificationBanners>> = {}) {
  const onIssueClick = vi.fn();
  const qc = new QueryClient();
  const utils = render(
    <QueryClientProvider client={qc}>
      <NotificationBanners open={false} onIssueClick={onIssueClick} {...props} />
    </QueryClientProvider>,
  );
  return { ...utils, onIssueClick };
}

const seed = (ids: string[], readIds: string[] = []) => {
  act(() => {
    useNotificationsStore.setState({
      items: ids.map((id, i) => mk(id, `PROJ-${i + 1}`)) as never,
      readIds,
      dismissedIds: [],
    });
    useNotificationBanners.setState({ ids, suppressed: false });
  });
};

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('NotificationBanners', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    act(() => {
      useSettingsStore.setState({ notifBannerDurationSecs: 5 });
      useNotificationBanners.setState({ ids: [], suppressed: false });
      useNotificationsStore.setState({ items: [], readIds: [], dismissedIds: [] });
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing for an empty queue', () => {
    const { container } = setup();
    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('region', { name: 'New notifications' })).toBeNull();
  });

  it('portals to document.body with banner variant rows, newest first', () => {
    seed(['c', 'b', 'a']);
    const { container } = setup();
    const region = screen.getByRole('region', { name: 'New notifications' });
    expect(container.contains(region)).toBe(false);
    expect(region.parentElement).toBe(document.body);
    expect(region.className).toContain('fixed');
    expect(region.className).toContain('top-[60px]');
    const cards = region.querySelectorAll('[data-notif-banner]');
    expect(cards).toHaveLength(3);
    expect(
      [...region.querySelectorAll('[data-card]')]
        .map((c) => c.className)
        .every((c) => c.includes('shadow-(--notif-sh-pop)')),
    ).toBe(true);
    expect(region.querySelector('[data-tray]')?.className).toContain('hidden');
  });

  it('shows at most 3 banners', () => {
    seed(['d', 'c', 'b', 'a']);
    setup();
    expect(document.querySelectorAll('[data-notif-banner]')).toHaveLength(4);
    // the store caps pushes; seeding bypasses the cap on purpose, push enforces it
    act(() => {
      useNotificationBanners.setState({ ids: [] });
      useNotificationBanners.getState().push(['d', 'c', 'b', 'a']);
    });
    expect(document.querySelectorAll('[data-notif-banner]')).toHaveLength(3);
  });

  it('auto-dismisses after the configured duration (leave animation first)', () => {
    seed(['a']);
    setup();
    advance(4900);
    expect(document.querySelector('[data-leaving]')).toBeNull();
    advance(200);
    expect(document.querySelector('[data-notif-banner]')?.getAttribute('data-leaving')).toBe(
      'true',
    );
    advance(400);
    expect(useNotificationBanners.getState().ids).toEqual([]);
    expect(document.querySelector('[data-notif-banner]')).toBeNull();
  });

  it('hover pauses the timer; leaving resumes with at least 800ms', () => {
    seed(['a']);
    setup();
    const banner = document.querySelector('[data-notif-banner]') as HTMLElement;
    advance(3000);
    fireEvent.mouseEnter(banner);
    advance(20_000);
    expect(banner.hasAttribute('data-leaving')).toBe(false);
    fireEvent.mouseLeave(banner);
    // 2000ms were left on the clock
    advance(1900);
    expect(banner.hasAttribute('data-leaving')).toBe(false);
    advance(200);
    expect(banner.getAttribute('data-leaving')).toBe('true');
  });

  it('WR-01: pointer leaving while focus is inside does not resume the timer', () => {
    seed(['a']);
    setup();
    const banner = document.querySelector('[data-notif-banner]') as HTMLElement;
    advance(1000);
    fireEvent.focus(banner);
    fireEvent.mouseEnter(banner);
    fireEvent.mouseLeave(banner);
    advance(20_000);
    expect(banner.hasAttribute('data-leaving')).toBe(false);
    fireEvent.blur(banner);
    advance(4100);
    expect(banner.getAttribute('data-leaving')).toBe('true');
  });

  it('WR-01: blur while the pointer still hovers does not resume the timer', () => {
    seed(['a']);
    setup();
    const banner = document.querySelector('[data-notif-banner]') as HTMLElement;
    fireEvent.mouseEnter(banner);
    fireEvent.focus(banner);
    fireEvent.blur(banner);
    advance(20_000);
    expect(banner.hasAttribute('data-leaving')).toBe(false);
  });

  it('WR-01: changing the duration setting while paused does not restart the clock', () => {
    seed(['a']);
    setup();
    const banner = document.querySelector('[data-notif-banner]') as HTMLElement;
    fireEvent.mouseEnter(banner);
    act(() => {
      useSettingsStore.setState({ notifBannerDurationSecs: 3 });
    });
    advance(20_000);
    expect(banner.hasAttribute('data-leaving')).toBe(false);
  });

  it('WR-03: unmounting while the panel is open lifts the suppression', () => {
    const { unmount } = setup({ open: true });
    expect(useNotificationBanners.getState().suppressed).toBe(true);
    unmount();
    expect(useNotificationBanners.getState().suppressed).toBe(false);
  });

  it('resume never leaves less than 800ms', () => {
    seed(['a']);
    setup();
    const banner = document.querySelector('[data-notif-banner]') as HTMLElement;
    advance(4900);
    fireEvent.mouseEnter(banner);
    fireEvent.mouseLeave(banner);
    advance(700);
    expect(banner.hasAttribute('data-leaving')).toBe(false);
    advance(200);
    expect(banner.getAttribute('data-leaving')).toBe('true');
  });

  it('the X dismisses without removing the notification', () => {
    seed(['a']);
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    advance(400);
    expect(useNotificationBanners.getState().ids).toEqual([]);
    expect(useNotificationsStore.getState().items).toHaveLength(1);
  });

  it('clicking a banner marks it read, opens the issue and dismisses', () => {
    seed(['a']);
    const { onIssueClick } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Unread\./ }));
    expect(useNotificationsStore.getState().readIds).toContain('a');
    expect(onIssueClick).toHaveBeenCalledWith('PROJ-1');
    advance(400);
    expect(useNotificationBanners.getState().ids).toEqual([]);
  });

  it('the quick action pill runs the same action and dismisses', () => {
    seed(['a']);
    const { onIssueClick } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    expect(onIssueClick).toHaveBeenCalledWith('PROJ-1');
    expect(useNotificationsStore.getState().readIds).toContain('a');
    advance(400);
    expect(useNotificationBanners.getState().ids).toEqual([]);
  });

  it('renders nothing and clears + suppresses the queue while the panel is open', () => {
    seed(['a', 'b']);
    setup({ open: true });
    expect(screen.queryByRole('region', { name: 'New notifications' })).toBeNull();
    expect(useNotificationBanners.getState().ids).toEqual([]);
    expect(useNotificationBanners.getState().suppressed).toBe(true);
  });

  it('lifts the suppression when the panel closes', () => {
    const qc = new QueryClient();
    const ui = (open: boolean) => (
      <QueryClientProvider client={qc}>
        <NotificationBanners open={open} />
      </QueryClientProvider>
    );
    const { rerender } = render(ui(true));
    expect(useNotificationBanners.getState().suppressed).toBe(true);
    rerender(ui(false));
    expect(useNotificationBanners.getState().suppressed).toBe(false);
  });

  it('drops a banner whose notification no longer exists in the store', () => {
    seed(['a', 'b']);
    setup();
    act(() => {
      useNotificationsStore.setState({ items: [mk('b', 'PROJ-2')] as never });
    });
    expect(useNotificationBanners.getState().ids).toEqual(['b']);
    expect(document.querySelectorAll('[data-notif-banner]')).toHaveLength(1);
  });

  // Floating over page content: the card must stay opaque even when its issue is open in the
  // peek sidebar (PEEKED_ROW_CLASS tint) or the item is already read (82% list fill).
  it.each([
    ['peeked', [] as string[]],
    ['read', ['a']],
  ])('keeps an opaque card background when %s', (_label, readIds) => {
    act(() => usePeekStore.setState({ peekIssueKey: 'PROJ-1' }));
    seed(['a'], readIds);
    setup();
    const card = document.querySelector('[data-notif-banner] [data-card]') as HTMLElement;
    const bgs = card.className.split(/\s+/).filter((c) => /^bg-/.test(c));
    expect(bgs).toEqual(['bg-card']);
    act(() => usePeekStore.setState({ peekIssueKey: null }));
  });
});
