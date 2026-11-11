/**
 * useNotificationActions — open / quick-action / open-in-browser wiring shared by the notification
 * panel and the in-app banners (261111-m0g). Every external URL passes the isSafeHttpUrl gate and
 * in-app MR routes use numeric project / iid only.
 */

import { openExternal } from '../../lib/openExternal';
import { useComposerFocus } from '../../stores/composer-focus.store';
import type { NotificationItem } from '../../stores/notifications.store';
import { useNotificationsStore } from '../../stores/notifications.store';
import {
  describeEntryParts,
  type EventEntry,
  entryIds,
  getJiraKey,
  isSafeHttpUrl,
  type QuickAction,
  quickActionFor,
  type StackEntry,
  stackIds,
} from './notification-view';

interface Options {
  onIssueClick?: (issueKey: string) => void;
  onMRClick?: (projectIdAndIid: string) => void;
  /** Called after navigation so the host can close itself (panel) or dismiss (banner). */
  onClose?: () => void;
}

export interface NotificationActions {
  /** Mark the card read and navigate to its issue / MR. */
  openEvent: (entry: EventEntry) => void;
  getOpenInBrowser: (entry: EventEntry) => (() => void) | undefined;
  /** The card's single quick action, wired to what the app can already do. */
  getQuick: (entry: EventEntry) => { label: string; onClick: () => void } | undefined;
}

export function useNotificationActions({
  onIssueClick,
  onMRClick,
  onClose,
}: Options): NotificationActions {
  const requestComposerFocus = useComposerFocus((s) => s.requestComposerFocus);
  const markItemsRead = useNotificationsStore((s) => s.markItemsRead);

  function navigateTo(item: NotificationItem) {
    const key = getJiraKey(item);
    if (key && onIssueClick) {
      onIssueClick(key);
      onClose?.();
      return;
    }
    if (item.source === 'gitlab' && item.mrProjectId && item.mrIid && onMRClick) {
      onMRClick(`${item.mrProjectId}/${item.mrIid}`);
      onClose?.();
    }
    // No navigable target: stays open, already marked read.
  }

  const idsOf = (entry: EventEntry | StackEntry) =>
    entry.kind === 'stack' ? stackIds(entry) : entryIds(entry);

  function openEvent(entry: EventEntry) {
    markItemsRead(idsOf(entry));
    navigateTo(entry.item);
  }

  function getOpenInBrowser(entry: EventEntry): (() => void) | undefined {
    const url = entry.item.url;
    if (!url || !isSafeHttpUrl(url)) return undefined;
    return () => {
      openExternal(url);
      markItemsRead(entryIds(entry));
    };
  }

  function getQuick(entry: EventEntry): { label: string; onClick: () => void } | undefined {
    const item = entry.item;
    const action: QuickAction | null = quickActionFor(item, describeEntryParts(entry.items));
    if (!action) return undefined;
    const run = () => {
      markItemsRead(entryIds(entry));
      switch (action.kind) {
        case 'reply-jira': {
          const key = getJiraKey(item);
          if (!key) return;
          if (onIssueClick) {
            requestComposerFocus(key);
            onIssueClick(key);
            onClose?.();
          }
          return;
        }
        case 'reply-gitlab':
        case 'pipeline':
          if (item.url && isSafeHttpUrl(item.url)) openExternal(item.url);
          return;
        case 'review':
        case 'open-mr':
          if (item.mrProjectId != null && item.mrIid != null) {
            onMRClick?.(`${item.mrProjectId}/${item.mrIid}`);
            onClose?.();
          }
          return;
      }
    };
    return { label: action.label, onClick: run };
  }

  return { openEvent, getOpenInBrowser, getQuick };
}
