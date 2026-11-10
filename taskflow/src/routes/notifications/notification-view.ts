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
  MENTION_STYLE,
  MULTI_UPDATE_STYLE,
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
  /** Latest item; drives the row's entity, time and style. */
  item: NotificationItem;
  /** Every merged item, newest first (always includes `item`; length 1 when nothing merged). */
  items: NotificationItem[];
  /** True when ANY merged item is unread. */
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
  /** Issue update / GitLab system note: every parsed change, in display order. */
  changes?: ChangeLine[];
  /** Merged conversation: number of comments / mentions folded into this entry. */
  count?: number;
  /** Merged conversation: every comment, newest first, for the per-comment list. */
  comments?: CommentLine[];
  /** Muted suffix after the verb, e.g. "5 comments" when a mention is promoted. */
  verbSuffix?: string;
  /** A merged conversation that contains at least one mention: styled as a mention. */
  promoted?: boolean;
}

export interface CommentLine {
  id: string;
  /** Cleaned single-line comment text. */
  text: string;
  createdAt: string;
  mention: boolean;
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

const CHANGE_RANK: Partial<Record<ActionKey, number>> = {
  status: 0,
  assignee: 1,
  unassigned: 1,
  priority: 2,
  sprint: 3,
  version: 4,
  milestone: 4,
  labels: 5,
  description: 7,
};

/** Display order: status, assignee, priority, sprint, version/milestone, labels, others, description. */
export function orderChanges(lines: ChangeLine[]): ChangeLine[] {
  const rank = (c: ChangeLine) => (c.action ? (CHANGE_RANK[c.action] ?? 6) : 6);
  return lines
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map((x) => x.c);
}

/** Parts for an issue update / system note: one change reads inline, several read as "updated N fields". */
function changesParts(actor: string | undefined, changes: ChangeLine[]): EventParts {
  if (changes.length >= 2) {
    return { verb: `updated ${changes.length} fields`, actor, snippet: '', changes };
  }
  if (changes.length === 1) {
    const first = changes[0];
    return {
      verb: isStateAction(first) ? first.field : `changed ${first.field}`,
      actor,
      snippet: '',
      changes,
    };
  }
  return { verb: 'updated', actor, snippet: '' };
}

/** Structured, plain-text description of an event. Never returns HTML. */
export function describeEventParts(item: NotificationItem): EventParts {
  const snippet = cleanCommentText(item.bodyPreview);
  const actor = actorName(item.author);
  if (item.notificationType === 'mr-note' && isSystemNote(item)) {
    const lines = parseSystemLines(item.bodyPreview);
    if (lines.length > 0) return changesParts(actor, orderChanges(lines));
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
      if (lines.length > 0) return changesParts(actor, orderChanges(lines));
      return { verb: 'updated', actor, snippet };
    }
    default:
      return { verb: 'updated', actor, snippet };
  }
}

/** Event style (colour + glyph) for an item; status changes get the amber status style. */
export function eventStyleFor(item: NotificationItem, parts: EventParts): EventStyle {
  if (parts.promoted) return MENTION_STYLE;
  if (parts.changes && parts.changes.length >= 2) return MULTI_UPDATE_STYLE;
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
    core = parts.verbSuffix ? `${parts.verb}, ${parts.verbSuffix}` : parts.verb;
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

/* ── merging ────────────────────────────────────────── */

export const MERGE_GAP_MS = 60 * 60_000;
type MergeCategory = 'conversation' | 'changes';

function changesOf(item: NotificationItem): ChangeLine[] {
  return isSystemNote(item)
    ? parseSystemLines(item.bodyPreview)
    : parseChangeLines(item.bodyPreview);
}

/** Which merge family an item belongs to; null = never merges (assignment, approval, pipeline, due, MR state). */
export function mergeCategory(item: NotificationItem): MergeCategory | null {
  if (item.notificationType === 'mr-note' && isSystemNote(item)) {
    const lines = parseSystemLines(item.bodyPreview);
    if (lines.length === 0 || lines.some(isStateAction)) return null;
    return 'changes';
  }
  switch (item.notificationType) {
    case 'jira-comment':
    case 'comment-mention':
    case 'mr-note':
    case 'gitlab-mention':
      return 'conversation';
    case 'issue-update':
      return parseChangeLines(item.bodyPreview).length > 0 ? 'changes' : null;
    default:
      return null;
  }
}

function entityKey(item: NotificationItem): string | null {
  const jira = getJiraKey(item);
  if (jira) return `jira:${jira}`;
  if (item.source === 'gitlab' && item.mrProjectId != null && item.mrIid != null)
    return `gitlab:${item.mrProjectId}/${item.mrIid}`;
  return null;
}

function isMention(item: NotificationItem): boolean {
  return item.notificationType === 'comment-mention' || item.notificationType === 'gitlab-mention';
}

const actorKey = (item: NotificationItem) => item.author.trim().toLowerCase();

/** Signed label tokens ("+a -b", "+a, b") -> name -> +1 | -1. */
function labelTokens(text: string): [string, 1 | -1][] {
  const out: [string, 1 | -1][] = [];
  let sign: 1 | -1 = 1;
  for (const raw of text.split(/[\s,]+/).filter(Boolean)) {
    let tok = raw;
    if (tok.startsWith('+')) {
      sign = 1;
      tok = tok.slice(1);
    } else if (tok.startsWith('\u2212') || tok.startsWith('-')) {
      sign = -1;
      tok = tok.slice(1);
    }
    if (tok) out.push([tok, sign]);
  }
  return out;
}

/**
 * Union of chronological change lists: the same field changed repeatedly collapses to
 * first-from -> last-to, no-ops (from === to) drop, label diffs net out.
 */
export function mergeChanges(chronological: ChangeLine[][]): ChangeLine[] {
  const diffs = new Map<string, ChangeLine>();
  const labels = new Map<string, number>();
  const labelOrder: string[] = [];
  const other = new Map<string, ChangeLine>();
  const order: string[] = [];
  for (const list of chronological) {
    for (const c of list) {
      if (c.field === 'labels' && c.text) {
        if (!order.includes('labels')) order.push('labels');
        for (const [name, sign] of labelTokens(c.text)) {
          if (!labels.has(name)) labelOrder.push(name);
          labels.set(name, (labels.get(name) ?? 0) + sign);
        }
        continue;
      }
      const isDiff = !c.text && (c.from !== undefined || c.to !== undefined);
      const reviewish = c.action === 'review' || c.action === 'unreview';
      if (isDiff && !reviewish) {
        const key = c.field;
        const prev = diffs.get(key);
        if (!prev) order.push(`d:${key}`);
        const merged: ChangeLine = { ...c, from: prev ? prev.from : c.from };
        if (c.field === 'assignee') merged.action = merged.to ? 'assignee' : 'unassigned';
        diffs.set(key, merged);
      } else {
        const key = `o:${c.field}|${c.action ?? ''}|${c.text ?? ''}|${c.to ?? ''}`;
        if (!other.has(key)) order.push(key);
        other.set(key, c);
      }
    }
  }
  const out: ChangeLine[] = [];
  for (const key of order) {
    if (key === 'labels') {
      const parts = labelOrder
        .filter((n) => (labels.get(n) ?? 0) !== 0)
        .map((n) => ((labels.get(n) ?? 0) > 0 ? `+${n}` : `\u2212${n}`));
      if (parts.length > 0) out.push({ field: 'labels', text: parts.join(' '), action: 'labels' });
    } else if (key.startsWith('d:')) {
      const c = diffs.get(key.slice(2));
      if (c && c.from !== c.to) out.push(c);
    } else {
      const c = other.get(key);
      if (c) out.push(c);
    }
  }
  return out;
}

/** Parts for a (possibly merged) entry; `items` is newest first. */
export function describeEntryParts(items: NotificationItem[]): EventParts {
  const primary = items[0];
  if (items.length < 2) return describeEventParts(primary);
  const actor = actorName(primary.author);
  if (mergeCategory(primary) === 'changes') {
    const chrono = [...items].reverse().map(changesOf);
    return changesParts(actor, orderChanges(mergeChanges(chrono)));
  }
  const latest = describeEventParts(primary);
  const n = items.length;
  const promoted = items.some(isMention);
  return {
    ...latest,
    verb: promoted ? 'mentioned you' : `commented ${n} times`,
    verbSuffix: promoted ? `${n} comments` : undefined,
    promoted,
    count: n,
    comments: items.map((i) => ({
      id: i.id,
      text: describeEventParts(i).commentText ?? cleanCommentText(i.bodyPreview),
      createdAt: i.createdAt,
      mention: isMention(i),
    })),
  };
}

export function buildEntries(input: {
  items: NotificationItem[];
  readSet: ReadonlySet<string>;
  source: SourceFilter;
  unreadOnly: boolean;
  now: number;
}): NotificationEntry[] {
  const { readSet, now } = input;
  // Merge over everything in the source scope so read state never splits a run,
  // then drop runs with nothing unread when unreadOnly.
  const sorted = filterItems(input.items, readSet, input.source, false);
  const groups = new Map<string, NotificationItem[]>();
  const byEntity = new Map<string, NotificationItem[]>();
  for (const item of [...sorted].reverse()) {
    const key = entityKey(item);
    if (!key) {
      groups.set(item.id, [item]);
      continue;
    }
    const seq = byEntity.get(key);
    if (seq) seq.push(item);
    else byEntity.set(key, [item]);
  }
  for (const seq of byEntity.values()) {
    let run: NotificationItem[] = [];
    const flush = () => {
      if (run.length > 0) groups.set(run[run.length - 1].id, [...run].reverse());
    };
    for (const item of seq) {
      const last = run[run.length - 1];
      const cat = last ? mergeCategory(last) : null;
      const joins =
        last &&
        cat !== null &&
        cat === mergeCategory(item) &&
        actorKey(item) !== '' &&
        actorKey(item) === actorKey(last) &&
        ts(item) - ts(last) <= MERGE_GAP_MS &&
        bucketOf(item.createdAt, now) === bucketOf(last.createdAt, now);
      if (joins) run.push(item);
      else {
        flush();
        run = [item];
      }
    }
    flush();
  }

  const entries: NotificationEntry[] = [];
  let current: TimeBucket | null = null;
  for (const item of sorted) {
    const group = groups.get(item.id);
    if (!group) continue; // older member of a merged run
    const isUnread = group.some((i) => !readSet.has(i.id));
    if (input.unreadOnly && !isUnread) continue;
    const bucket = bucketOf(item.createdAt, now);
    if (bucket !== current) {
      current = bucket;
      entries.push({ kind: 'header', id: `header:${bucket}`, bucket, label: BUCKET_LABEL[bucket] });
    }
    entries.push({ kind: 'event', id: `event:${item.id}`, item, items: group, isUnread });
  }
  return entries;
}

/** Pixel height for the virtualizer's first paint (default density); real heights are measured. */
export function estimateEntryHeight(entry: NotificationEntry): number {
  if (entry.kind === 'header') return 32;
  const parts = describeEntryParts(entry.items);
  // card: py-2.5 (20) + border (2) + line 1 h-5 (20) + line 2 h-5 (20) + wrapper pb-1.5 (6)
  let h = 68;
  // list: mt-1 (4) + rows of h-5 (20) separated by gap-1 (4), plus a "+N more" row when capped
  const list = (n: number) => {
    if (n < 2) return 0;
    const rows = Math.min(3, n) + (n > 3 ? 1 : 0);
    return 4 + rows * 20 + (rows - 1) * 4;
  };
  h += list(parts.changes?.length ?? 0);
  h += list(parts.comments?.length ?? 0);
  return h;
}

export function isFocusableEntry(entry: NotificationEntry): entry is EventEntry {
  return entry.kind === 'event';
}
