/**
 * Pure notification view-model: entity keys, time bucketing, filtering and
 * grouping. No React and no clock reads — time-dependent helpers take `now`
 * as an argument (React Compiler may memoize render-time clock reads).
 */

import type { NotificationItem } from '../../stores/notifications.store';
import { EVENT_STYLE, type EventStyle, STATUS_STYLE, UPDATE_STYLE } from './notification-colours';

export type SourceFilter = 'all' | 'jira' | 'gitlab';
export type TimeBucket = 'today' | 'yesterday' | 'week' | 'older';

export const BUCKET_LABEL: Record<TimeBucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  older: 'Older',
};

const BUCKET_ORDER: TimeBucket[] = ['today', 'yesterday', 'week', 'older'];

export interface HeaderEntry {
  kind: 'header';
  id: string;
  bucket: TimeBucket;
  label: string;
}

export interface GroupEntry {
  kind: 'group';
  id: string;
  entityKey: string;
  bucket: TimeBucket;
  /** Newest first. */
  items: NotificationItem[];
  newest: NotificationItem;
  unreadCount: number;
  expanded: boolean;
}

export interface EventEntry {
  kind: 'event';
  id: string;
  item: NotificationItem;
  isUnread: boolean;
  nested: boolean;
  groupId?: string;
}

export type NotificationEntry = HeaderEntry | GroupEntry | EventEntry;
export type FocusableEntry = GroupEntry | EventEntry;

const JIRA_PREFIX_RE = /^([A-Z][A-Z0-9]*-\d+):/;
const JIRA_BROWSE_RE = /\/browse\/([A-Z][A-Z0-9]*-\d+)/;

export function getJiraKey(item: NotificationItem): string | null {
  if (item.source !== 'jira') return null;
  const m = item.entityTitle.trim().match(JIRA_PREFIX_RE);
  if (m) return m[1];
  if (item.url) {
    const u = item.url.match(JIRA_BROWSE_RE);
    if (u) return u[1];
  }
  return null;
}

export function getEntityKey(item: NotificationItem): string {
  const jira = getJiraKey(item);
  if (jira) return `jira:${jira}`;
  if (item.source === 'gitlab' && item.mrProjectId != null && item.mrIid != null) {
    return `gitlab:${item.mrProjectId}/${item.mrIid}`;
  }
  return `item:${item.id}`;
}

export function getEntityRef(item: NotificationItem): string | null {
  const jira = getJiraKey(item);
  if (jira) return jira;
  if (item.source === 'gitlab' && item.mrIid != null) return `!${item.mrIid}`;
  return null;
}

export function getEntityTitle(item: NotificationItem): string {
  const raw = item.entityTitle;
  const m = raw.trim().match(JIRA_PREFIX_RE);
  if (m) return raw.trim().slice(m[0].length).trim();
  return raw;
}

function startOfDay(ms: number): Date {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Local calendar-day bucket relative to `now`. 2-6 days back = rolling 7 calendar days. */
export function bucketOf(iso: string, now: number): TimeBucket {
  const today = startOfDay(now);
  const then = startOfDay(new Date(iso).getTime());
  // Round to absorb DST 23/25h days.
  const diff = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff <= 6) return 'week';
  return 'older';
}

export function relTime(iso: string, now: number): string {
  const s = Math.floor((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

export function formatAbsoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function isSafeHttpUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const p = new URL(url).protocol;
    return p === 'http:' || p === 'https:';
  } catch {
    return false;
  }
}

export interface EventParts {
  /** Short verb phrase, e.g. "mentioned you", "changed status", "pipeline failed", "due tomorrow". */
  verb: string;
  /** First name (or display name when it has no space); absent for system events. */
  actor?: string;
  /** Single-line body snippet; shown only in nested rows and the tooltip. */
  snippet: string;
  /** Status change only: old status (may be absent) and new status. */
  from?: string;
  to?: string;
  /** Issue update, non-status field changes (first is shown in the tail). */
  changes?: ChangeLine[];
  /** Extra changes not shown in the tail (including non-status ones behind a status pill). */
  moreChanges?: number;
}

export interface ChangeLine {
  /** Lower-cased field label, e.g. "priority", "sprint", "description". */
  field: string;
  /** Previous value; undefined when "(none)" or not applicable. */
  from?: string;
  /** New value; undefined for description edits / cleared values. */
  to?: string;
}

const CHANGE_RE = /^([^:\n]+):\s*(.*?)\s*\u2192\s*(.*)$/;
const NONE = '(none)';

/** Parse `Field: old → new` / `Description: updated|set` body lines. Unknown lines are skipped. */
export function parseChangeLines(body: string): ChangeLine[] {
  const out: ChangeLine[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(CHANGE_RE);
    if (m) {
      const from = m[2].trim();
      const to = m[3].trim();
      out.push({
        field: m[1].trim().toLowerCase(),
        from: from && from !== NONE ? from : undefined,
        to: to && to !== NONE ? to : undefined,
      });
      continue;
    }
    if (/^Description:\s*(updated|set)$/i.test(line)) out.push({ field: 'description' });
  }
  return out;
}

function actorName(author: string): string | undefined {
  const a = author.trim();
  if (!a) return undefined;
  const first = a.split(/\s+/)[0];
  return first || undefined;
}

/** Structured, plain-text description of an event. Never returns HTML. */
export function describeEventParts(item: NotificationItem): EventParts {
  const snippet = item.bodyPreview.replace(/\s+/g, ' ').trim();
  const actor = actorName(item.author);
  switch (item.notificationType) {
    case 'mr-note':
    case 'jira-comment':
      return { verb: 'commented', actor, snippet };
    case 'comment-mention':
    case 'gitlab-mention':
      return { verb: 'mentioned you', actor, snippet };
    case 'issue-assignment':
      return { verb: 'assigned you', actor, snippet: '' };
    case 'mr-approval':
      return { verb: 'approved', actor, snippet: '' };
    case 'pipeline-failure':
      return { verb: 'pipeline failed', snippet };
    case 'due-date-reminder': {
      const m = snippet.match(/^due\s+(.+)$/i);
      return { verb: m ? `due ${m[1].toLowerCase()}` : 'due', snippet: '' };
    }
    case 'issue-update': {
      const lines = parseChangeLines(item.bodyPreview);
      const status = lines.find((l) => l.field === 'status' && l.to);
      const others = lines.filter((l) => l !== status);
      if (status) {
        return {
          verb: 'changed status',
          actor,
          snippet: '',
          from: status.from,
          to: status.to,
          changes: others,
          moreChanges: others.length || undefined,
        };
      }
      if (others.length > 0) {
        return {
          verb: `changed ${others[0].field}`,
          actor,
          snippet: '',
          changes: others,
          moreChanges: others.length > 1 ? others.length - 1 : undefined,
        };
      }
      return { verb: 'updated', actor, snippet };
    }
    default:
      return { verb: 'updated', actor, snippet };
  }
}

/** Event style (colour + glyph) for an item; status changes get the amber status style. */
export function eventStyleFor(item: NotificationItem, parts: EventParts): EventStyle {
  if (parts.to) return STATUS_STYLE;
  return (item.notificationType && EVENT_STYLE[item.notificationType]) || UPDATE_STYLE;
}

/** Best-effort Jira status category from a status name (for pill colour). */
export function statusCategoryGuess(name: string): 'new' | 'indeterminate' | 'done' {
  const n = name.toLowerCase();
  if (/(done|closed|resolved|complete|released|fixed)/.test(n)) return 'done';
  if (/(to do|todo|open|backlog|new|reopened|selected)/.test(n)) return 'new';
  return 'indeterminate';
}

/** Aria phrase with actor: "Ana mentioned you" / "Pipeline failed" / "Cara changed status from X to Y". */
export function describeEventAria(parts: EventParts): string {
  const c = parts.changes?.[0];
  const core = parts.to
    ? `${parts.verb}${parts.from ? ` from ${parts.from}` : ''} to ${parts.to}`
    : c && (c.from || c.to)
      ? `${parts.verb}${c.from ? ` from ${c.from}` : ''}${c.to ? ` to ${c.to}` : ''}`
      : parts.verb;
  if (parts.actor) return `${parts.actor} ${core}`;
  return core.charAt(0).toUpperCase() + core.slice(1);
}

function ts(item: NotificationItem): number {
  return new Date(item.createdAt).getTime();
}

export function filterItems(
  items: NotificationItem[],
  readSet: ReadonlySet<string>,
  source: SourceFilter,
  unreadOnly: boolean,
): NotificationItem[] {
  return items
    .filter((i) => (source === 'all' || i.source === source) && !(unreadOnly && readSet.has(i.id)))
    .sort((a, b) => ts(b) - ts(a));
}

export function buildEntries(input: {
  items: NotificationItem[];
  readSet: ReadonlySet<string>;
  source: SourceFilter;
  unreadOnly: boolean;
  expandOverrides: Readonly<Record<string, boolean>>;
  now: number;
}): NotificationEntry[] {
  const { readSet, expandOverrides, now } = input;
  const filtered = filterItems(input.items, readSet, input.source, input.unreadOnly);

  // Group by entity across the whole list (first occurrence = newest event).
  const byEntity = new Map<string, NotificationItem[]>();
  for (const item of filtered) {
    const key = getEntityKey(item);
    const list = byEntity.get(key);
    if (list) list.push(item);
    else byEntity.set(key, [item]);
  }

  const buckets: Record<TimeBucket, NotificationEntry[][]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };

  // Map insertion order == newest-event order.
  for (const [entityKey, items] of byEntity) {
    const newest = items[0];
    const bucket = bucketOf(newest.createdAt, now);
    if (items.length === 1) {
      buckets[bucket].push([
        {
          kind: 'event',
          id: `event:${newest.id}`,
          item: newest,
          isUnread: !readSet.has(newest.id),
          nested: false,
        },
      ]);
      continue;
    }
    const unreadCount = items.filter((i) => !readSet.has(i.id)).length;
    const expanded = expandOverrides[entityKey] ?? false;
    const id = `group:${entityKey}`;
    const out: NotificationEntry[] = [
      { kind: 'group', id, entityKey, bucket, items, newest, unreadCount, expanded },
    ];
    if (expanded) {
      // The group row itself shows the newest event; children are the earlier ones.
      for (const item of items.slice(1)) {
        out.push({
          kind: 'event',
          id: `event:${item.id}`,
          item,
          isUnread: !readSet.has(item.id),
          nested: true,
          groupId: id,
        });
      }
    }
    buckets[bucket].push(out);
  }

  const entries: NotificationEntry[] = [];
  for (const bucket of BUCKET_ORDER) {
    if (buckets[bucket].length === 0) continue;
    entries.push({ kind: 'header', id: `header:${bucket}`, bucket, label: BUCKET_LABEL[bucket] });
    for (const chunk of buckets[bucket]) entries.push(...chunk);
  }
  return entries;
}

export function entryItemIds(entry: NotificationEntry): string[] {
  if (entry.kind === 'group') return entry.items.map((i) => i.id);
  if (entry.kind === 'event') return [entry.item.id];
  return [];
}

export function isFocusableEntry(entry: NotificationEntry): entry is FocusableEntry {
  return entry.kind !== 'header';
}
