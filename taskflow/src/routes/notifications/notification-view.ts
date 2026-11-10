/**
 * Pure notification view-model: entity keys, time bucketing, filtering and
 * flat entry building. No React and no clock reads — time-dependent helpers take `now`
 * as an argument (React Compiler may memoize render-time clock reads).
 */

import type { NotificationItem } from '../../stores/notifications.store';
import {
  ACTION_STYLE,
  type ActionKey,
  actionKeyForField,
  EVENT_STYLE,
  type EventStyle,
  UPDATE_STYLE,
} from './notification-colours';

export type SourceFilter = 'all' | 'jira' | 'gitlab';
export type TimeBucket = 'today' | 'yesterday' | 'week' | 'older';

export const BUCKET_LABEL: Record<TimeBucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  older: 'Older',
};

export interface HeaderEntry {
  kind: 'header';
  id: string;
  bucket: TimeBucket;
  label: string;
}

export interface EventEntry {
  kind: 'event';
  id: string;
  item: NotificationItem;
  isUnread: boolean;
}

export type NotificationEntry = HeaderEntry | EventEntry;

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
  /** Short verb phrase, e.g. "mentioned you", "pipeline failed", "due tomorrow". Coloured lead label of line 2. */
  verb: string;
  /** First name (or display name when it has no space); absent for system events. */
  actor?: string;
  /** Comment/mention text for line 2 (cleaned, single line). */
  commentText?: string;
  /** Short plain detail after the verb ("#4821 on feature/x"). */
  detail?: string;
  /** Single-line body snippet. */
  snippet: string;
  /** Issue update / GitLab system note: every parsed change, in order. */
  changes?: ChangeLine[];
}

export interface ChangeLine {
  /** Lower-cased field label, e.g. "priority", "sprint", "description"; for label-only events the whole phrase ("merged"). */
  field: string;
  /** Previous value; undefined when "(none)" or not applicable. */
  from?: string;
  /** New value; undefined for description edits / cleared values. */
  to?: string;
  /** Preformatted detail ("+x \u2212y", "removed", "edited") shown instead of from -> to. */
  text?: string;
  /** Dedicated icon/colour key, when the field has one. */
  action?: ActionKey;
}

const SYSTEM_ID_PREFIX = 'gitlab-system-';

/** GitLab system notes (state/label/reviewer changes) are changes, not comments. */
export function isSystemNote(item: NotificationItem): boolean {
  return item.id.startsWith(SYSTEM_ID_PREFIX);
}

const LIST_RE = /^([^:\n]+):\s*(.*)$/;

/** Parse one line produced by the service's parseSystemNote into a change line. */
export function parseGitlabSystemLine(raw: string): ChangeLine | null {
  const line = raw.trim();
  const state = line.match(/^State:\s*\S+\s*\u2192\s*(merged|closed|reopened)$/i);
  if (state) {
    const f = state[1].toLowerCase();
    return { field: f, action: actionKeyForField(f) };
  }
  const draft = line.match(/^Status:\s*\S+\s*\u2192\s*(draft|ready)$/i);
  if (draft) {
    const f = draft[1].toLowerCase();
    return { field: f === 'draft' ? 'marked as draft' : 'ready for review', action: 'draft' };
  }
  const m = line.match(LIST_RE);
  if (!m) return null;
  const key = m[1].trim().toLowerCase();
  const value = m[2].trim();
  switch (key) {
    case 'review requested':
      return { field: 'review', to: value, action: 'review' };
    case 'review removed':
      return { field: 'review', text: `\u2212${value}`, action: 'unreview' };
    case 'labels added':
      return { field: 'labels', text: `+${value}`, action: 'labels' };
    case 'labels removed':
      return { field: 'labels', text: `\u2212${value}`, action: 'labels' };
    case 'assigned':
      return { field: 'assignee', to: value, action: 'assignee' };
    case 'unassigned':
      return { field: 'assignee', text: `\u2212${value}`, action: 'unassigned' };
    case 'assignee':
      return { field: 'assignee', text: 'removed', action: 'unassigned' };
    case 'description':
      return { field: 'description', text: 'edited', action: 'description' };
    case 'milestone':
      return value === 'removed'
        ? { field: 'milestone', text: 'removed', action: 'milestone' }
        : { field: 'milestone', to: value, action: 'milestone' };
    case 'auto-merge':
      return { field: 'auto-merge', text: value, action: 'automerge' };
    case 'title':
    case 'target branch': {
      const c = line.match(CHANGE_RE);
      if (c) {
        return {
          field: key,
          from: c[2].trim() || undefined,
          to: c[3].trim() || undefined,
          action: actionKeyForField(key),
        };
      }
      return null;
    }
    default:
      return null;
  }
}

export function parseSystemLines(body: string): ChangeLine[] {
  const out: ChangeLine[] = [];
  for (const l of body.split('\n')) {
    const c = parseGitlabSystemLine(l);
    if (c) out.push(c);
  }
  return out;
}

/** Light cleanup of Jira wiki / GitLab markdown so a comment reads as plain text. */
export function cleanCommentText(text: string): string {
  return text
    .replace(/\[~([^\]]+)\]/g, '@$1')
    .replace(/\[([^|\]]+)\|[^\]]*\]/g, '$1')
    .replace(/\{(?:code|noformat|quote|panel)[^}]*\}/g, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`+/g, '')
    .replace(/^>\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const CHANGE_RE = /^([^:\n]+):\s*(.*?)\s*\u2192\s*(.*)$/;
const NONE = '(none)';

/** "+x \u2212y" from space-separated label lists; undefined when nothing changed. */
function labelDiff(from?: string, to?: string): string | undefined {
  const a = new Set((from ?? '').split(/\s+/).filter(Boolean));
  const b = new Set((to ?? '').split(/\s+/).filter(Boolean));
  const parts = [
    ...[...b].filter((x) => !a.has(x)).map((x) => `+${x}`),
    ...[...a].filter((x) => !b.has(x)).map((x) => `\u2212${x}`),
  ];
  return parts.length > 0 ? parts.join(' ') : undefined;
}

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
      const field = m[1].trim().toLowerCase();
      const toV = to && to !== NONE ? to : undefined;
      let act = actionKeyForField(field);
      if (field === 'assignee' && !toV) act = 'unassigned';
      const fromV = from && from !== NONE ? from : undefined;
      if (field === 'labels') {
        const diff = labelDiff(fromV, toV);
        if (diff) {
          out.push({ field, text: diff, action: act });
          continue;
        }
      }
      out.push({ field, from: fromV, to: toV, action: act });
      continue;
    }
    if (/^Description:\s*(updated|set)$/i.test(line))
      out.push({ field: 'description', text: 'edited', action: 'description' });
  }
  return out;
}

function isStateAction(c: ChangeLine): boolean {
  return c.action === 'merged' || c.action === 'closed' || c.action === 'reopened';
}

/** "Pipeline #4821 failed on feature/x" -> "#4821 on feature/x"; otherwise the cleaned body. */
function pipelineDetail(snippet: string): string | undefined {
  const m = snippet.match(/#(\d+)\s+failed\s+on\s+(.+)$/i);
  if (m) return `#${m[1]} on ${m[2]}`;
  return snippet || undefined;
}

function actorName(author: string): string | undefined {
  const a = author.trim();
  if (!a) return undefined;
  const first = a.split(/\s+/)[0];
  return first || undefined;
}

/** Structured, plain-text description of an event. Never returns HTML. */
export function describeEventParts(item: NotificationItem): EventParts {
  const snippet = cleanCommentText(item.bodyPreview);
  const actor = actorName(item.author);
  if (item.notificationType === 'mr-note' && isSystemNote(item)) {
    const lines = parseSystemLines(item.bodyPreview);
    if (lines.length > 0) {
      const first = lines[0];
      return {
        verb: isStateAction(first) ? first.field : `changed ${first.field}`,
        actor,
        snippet: '',
        changes: lines,
      };
    }
    return { verb: 'updated', actor, snippet: '' };
  }
  switch (item.notificationType) {
    case 'mr-note':
    case 'jira-comment':
      return { verb: 'commented', actor, snippet, commentText: snippet };
    case 'comment-mention':
    case 'gitlab-mention':
      return {
        verb: 'mentioned you',
        actor,
        snippet,
        commentText: snippet,
      };
    case 'issue-assignment':
      return { verb: 'assigned you', actor, snippet: '' };
    case 'mr-approval':
      return { verb: 'approved', actor, snippet: '' };
    case 'pipeline-failure':
      return { verb: 'pipeline failed', detail: pipelineDetail(snippet), snippet };
    case 'due-date-reminder': {
      const m = snippet.match(/^due\s+(.+)$/i);
      return { verb: m ? `due ${m[1].toLowerCase()}` : 'due', snippet: '' };
    }
    case 'issue-update': {
      const lines = parseChangeLines(item.bodyPreview);
      if (lines.length > 0) {
        return {
          verb: `changed ${lines[0].field}`,
          actor,
          snippet: '',
          changes: lines,
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
  const act = parts.changes?.[0]?.action;
  if (act) return ACTION_STYLE[act];
  return (item.notificationType && EVENT_STYLE[item.notificationType]) || UPDATE_STYLE;
}

/** Best-effort Jira status category from a status name (for pill colour). */
export function statusCategoryGuess(name: string): 'new' | 'indeterminate' | 'done' {
  const n = name.toLowerCase();
  if (/(done|closed|resolved|complete|released|fixed)/.test(n)) return 'done';
  if (/(to do|todo|open|backlog|new|reopened|selected)/.test(n)) return 'new';
  return 'indeterminate';
}

function changePhrase(c: ChangeLine): string {
  if (c.from || c.to)
    return `${c.field}${c.from ? ` from ${c.from}` : ''}${c.to ? ` to ${c.to}` : ''}`;
  return c.text ? `${c.field} ${c.text}` : c.field;
}

const ARIA_TEXT_MAX = 120;

/** Comment / detail text appended to the aria label after the entity, truncated sensibly. */
export function describeEventAriaText(parts: EventParts): string {
  const extra = parts.commentText || parts.detail || '';
  return extra.length > ARIA_TEXT_MAX ? `${extra.slice(0, ARIA_TEXT_MAX)}\u2026` : extra;
}

/** Aria phrase with actor: "Ana mentioned you: text" / "Cara changed status from X to Y, priority from A to B". */
export function describeEventAria(parts: EventParts): string {
  let core: string;
  if (parts.changes && parts.changes.length > 0) {
    const labelOnly = parts.changes.every((c) => !c.from && !c.to && !c.text);
    core = labelOnly
      ? parts.changes.map((c) => c.field).join(', ')
      : `changed ${parts.changes.map(changePhrase).join(', ')}`;
  } else {
    core = parts.verb;
  }
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
  now: number;
}): NotificationEntry[] {
  const { readSet, now } = input;
  // Flat list, newest first, split by time-bucket headers.
  const filtered = filterItems(input.items, readSet, input.source, input.unreadOnly);
  const entries: NotificationEntry[] = [];
  let current: TimeBucket | null = null;
  for (const item of filtered) {
    const bucket = bucketOf(item.createdAt, now);
    if (bucket !== current) {
      current = bucket;
      entries.push({ kind: 'header', id: `header:${bucket}`, bucket, label: BUCKET_LABEL[bucket] });
    }
    entries.push({
      kind: 'event',
      id: `event:${item.id}`,
      item,
      isUnread: !readSet.has(item.id),
    });
  }
  return entries;
}

export function isFocusableEntry(entry: NotificationEntry): entry is EventEntry {
  return entry.kind === 'event';
}
