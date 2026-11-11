import { beforeEach, describe, expect, it } from 'vitest';
import { selectBannerItems, useNotificationBanners } from './notification-banners.store';
import type { NotificationItem } from './notifications.store';
import { useSettingsStore } from './settings.store';

function item(id: string, over: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id,
    source: 'jira',
    entityTitle: `PROJ-1: ${id}`,
    author: 'Example Author',
    bodyPreview: 'body',
    fullBody: 'body',
    createdAt: '2026-11-11T10:00:00.000Z',
    ...over,
  };
}

const gate = {
  existingIds: new Set<string>(),
  priorCursors: { jira: '2026-11-11T09:00:00.000Z', gitlab: '2026-11-11T09:00:00.000Z' },
  isFirstPoll: false,
  hydrated: true,
  sourceEnabled: { jira: true, gitlab: true },
};

describe('selectBannerItems', () => {
  it('returns nothing on the first poll or before hydration', () => {
    expect(selectBannerItems([item('a')], { ...gate, isFirstPoll: true })).toEqual([]);
    expect(selectBannerItems([item('a')], { ...gate, hydrated: false })).toEqual([]);
  });

  it('drops items already known to the store', () => {
    const out = selectBannerItems([item('a'), item('b')], { ...gate, existingIds: new Set(['a']) });
    expect(out.map((i) => i.id)).toEqual(['b']);
  });

  it('drops items from a source whose prior cursor was null (24h backfill)', () => {
    const out = selectBannerItems([item('j'), item('g', { source: 'gitlab' })], {
      ...gate,
      priorCursors: { jira: '2026-11-11T09:00:00.000Z', gitlab: null },
    });
    expect(out.map((i) => i.id)).toEqual(['j']);
  });

  it('returns newest first, capped at 3', () => {
    const items = [1, 2, 3, 4, 5].map((n) =>
      item(`i${n}`, { createdAt: `2026-11-11T10:0${n}:00.000Z` }),
    );
    expect(selectBannerItems(items, gate).map((i) => i.id)).toEqual(['i5', 'i4', 'i3']);
  });
});

describe('selectBannerItems source switches', () => {
  it('drops banners for a source whose desktop switch is off', () => {
    const items = [item('j'), item('g', { source: 'gitlab' })];
    const ids = (sourceEnabled: { jira: boolean; gitlab: boolean }) =>
      selectBannerItems(items, { ...gate, sourceEnabled }).map((i) => i.id);
    expect(ids({ jira: false, gitlab: true })).toEqual(['g']);
    expect(ids({ jira: true, gitlab: false })).toEqual(['j']);
    expect(ids({ jira: false, gitlab: false })).toEqual([]);
  });
});

describe('useNotificationBanners', () => {
  beforeEach(() => {
    useNotificationBanners.setState({ ids: [], suppressed: false });
    useSettingsStore.setState({ notifBannerDurationSecs: 5 });
  });

  it('push prepends newest first, dedupes, and keeps at most 3', () => {
    const { push } = useNotificationBanners.getState();
    push(['a']);
    push(['b', 'a']);
    expect(useNotificationBanners.getState().ids).toEqual(['b', 'a']);
    push(['c', 'd']);
    expect(useNotificationBanners.getState().ids).toEqual(['c', 'd', 'b']);
  });

  it('push is a no-op while suppressed or when banners are Off', () => {
    useNotificationBanners.getState().setSuppressed(true);
    useNotificationBanners.getState().push(['a']);
    expect(useNotificationBanners.getState().ids).toEqual([]);
    useNotificationBanners.getState().setSuppressed(false);
    useSettingsStore.setState({ notifBannerDurationSecs: 0 });
    useNotificationBanners.getState().push(['a']);
    expect(useNotificationBanners.getState().ids).toEqual([]);
  });

  it('dismiss removes one, clear empties', () => {
    useNotificationBanners.getState().push(['a', 'b']);
    useNotificationBanners.getState().dismiss('a');
    expect(useNotificationBanners.getState().ids).toEqual(['b']);
    useNotificationBanners.getState().clear();
    expect(useNotificationBanners.getState().ids).toEqual([]);
  });
});
