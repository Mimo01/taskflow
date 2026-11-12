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
  /**
   * Store ids of hidden duplicate copies of merged items (the same Jira comment stored under
   * both jira-comment-X and jira-allcomment-X). Read / Done must act on them too — use entryIds().
   */
  duplicateIds?: string[];
}

/** 2+ cards on one issue / MR, collapsed: newest card on top, the rest peek out behind it. */
export interface StackEntry {
  kind: 'stack';
  id: `stack:${string}`;
  entity: string;
  /** Member cards, newest first. */
  cards: EventEntry[];
  /** True when ANY member card is unread. */
  isUnread: boolean;
  /** Notifications hidden behind the top card (the "+N" count). */
  more: number;
}

/** Header row of an EXPANDED stack ("Show less" / "Clear"); members follow as plain events. */
export interface StackHeaderEntry {
  kind: 'stack-header';
  id: `stack-header:${string}`;
  entity: string;
  cards: EventEntry[];
}

export type NotificationEntry = HeaderEntry | EventEntry | StackEntry | StackHeaderEntry;

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
  // A week or older: the actual date reads better than "3w" and replaces the old hover tooltip.
  const then = new Date(iso);
  const sameYear = then.getFullYear() === new Date(now).getFullYear();
  return then.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
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
  /**
   * Single change where one side is empty: 'added' (none -> value) or 'removed' (value -> none).
   * The verb already says it ("added fix version"), so the row shows only the one value.
   */
  singleMode?: 'added' | 'removed';
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

/** "a, b" -> "+a +b": one signed token per label so each renders as its own chip. */
function prefixList(sign: string, value: string): string {
  return value
    .split(/,\s*/)
    .filter(Boolean)
    .map((v) => `${sign}${v.replace(/\s+/g, '\u00A0')}`)
    .join(' ');
}

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
      return { field: 'labels', text: prefixList('+', value), action: 'labels' };
    case 'labels removed':
      return { field: 'labels', text: prefixList('\u2212', value), action: 'labels' };
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

/**
 * Text to parse change lines from: the untruncated body. The service cuts `bodyPreview`
 * (120 chars for system notes), which would chop titles and drop the last labels. Like
 * commentPreview, `fullBody` counts as the untruncated preview only when it extends it.
 */
function changeSource(item: Pick<NotificationItem, 'bodyPreview' | 'fullBody'>): string {
  return item.fullBody?.startsWith(item.bodyPreview) ? item.fullBody : item.bodyPreview;
}

/** Light cleanup of Jira wiki / GitLab markdown so a comment reads as plain text. */
/**
 * Preview text for a comment: the stored preview is cut server-side (80/120 chars) with no marker,
 * so when the full body is longer, end the preview with an ellipsis to signal there is more.
 */
export function commentPreview(item: Pick<NotificationItem, 'bodyPreview' | 'fullBody'>): string {
  const preview = cleanCommentText(item.bodyPreview);
  const full = item.fullBody ? cleanCommentText(item.fullBody) : '';
  if (
    preview &&
    full.length > preview.length &&
    full.startsWith(preview) &&
    !preview.endsWith('\u2026')
  ) {
    return `${preview.replace(/[\s.,;:]+$/, '')}\u2026`;
  }
  return preview;
}

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
      // The flag value is always "Impediment": the event is the phrase ("flagged", like "merged").
      if (field === 'flagged') {
        if (toV || fromV) out.push({ field: toV ? 'flagged' : 'removed flag', action: 'flag' });
        continue;
      }
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
    // Value-less events ("merged", "marked as draft") are the phrase itself; "edited" reads as a verb.
    const phraseOnly = !first.from && !first.to && !first.text;
    const signed = signedTextMode(first);
    if (signed) {
      // "+frontend +bug" -> "added labels frontend bug"; "−ana" -> "unassigned ana"
      const added = signed === 'added';
      return {
        verb: oneSidedVerb(first, added),
        actor,
        snippet: '',
        changes: [{ ...first, text: stripSigns(first.text ?? '') }],
        singleMode: signed,
      };
    }
    const oneSided = !first.text && Boolean(first.from) !== Boolean(first.to);
    if (oneSided) {
      const added = Boolean(first.to);
      return {
        verb: oneSidedVerb(first, added),
        actor,
        snippet: '',
        changes,
        singleMode: added ? 'added' : 'removed',
      };
    }
    return {
      verb: phraseOnly
        ? first.field
        : first.text === 'edited'
          ? `edited ${first.field}`
          : `changed ${first.field}`,
      actor,
      snippet: '',
      changes,
    };
  }
  return { verb: 'updated', actor, snippet: '' };
}

const SIGNED_TOKEN = /^[+\u2212-]/;

/**
 * Splits signed label / name tokens. ASCII space, tab, newline and comma only — NOT `\s`, which
 * also matches the U+00A0 that prefixList puts inside a multi-word label ("+needs\u00A0review").
 */
const TOKEN_SPLIT = /[ \t\n,]+/;

/** Text change made only of "+x" tokens (added) or only "−x" tokens (removed); mixed -> undefined. */
function signedTextMode(c: ChangeLine): 'added' | 'removed' | undefined {
  if (!c.text) return undefined;
  const toks = c.text.split(TOKEN_SPLIT).filter(Boolean);
  if (toks.length === 0 || !toks.every((t) => SIGNED_TOKEN.test(t))) return undefined;
  if (toks.every((t) => t.startsWith('+'))) return 'added';
  if (toks.every((t) => !t.startsWith('+'))) return 'removed';
  return undefined;
}

function stripSigns(text: string): string {
  return text
    .split(/ +/)
    .filter(Boolean)
    .map((t) => t.replace(SIGNED_TOKEN, ''))
    .join(' ');
}

/** "added fix version" / "removed component"; people and reviews get their natural verbs. */
function oneSidedVerb(c: ChangeLine, added: boolean): string {
  if (c.action === 'review' || c.action === 'unreview')
    return added ? 'requested review from' : 'removed review from';
  if (c.field === 'assignee') return added ? 'assigned' : 'unassigned';
  return `${added ? 'added' : 'removed'} ${c.field}`;
}

/** Structured, plain-text description of an event. Never returns HTML. */
export function describeEventParts(item: NotificationItem): EventParts {
  const snippet = commentPreview(item);
  const actor = actorName(item.author);
  if (item.notificationType === 'mr-note' && isSystemNote(item)) {
    const lines = parseSystemLines(changeSource(item));
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
      const lines = parseChangeLines(changeSource(item));
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
  if (parts.singleMode && parts.changes?.length === 1) {
    const c = parts.changes[0];
    core = `${parts.verb} ${c.text ?? (parts.singleMode === 'added' ? c.to : c.from)}`;
  } else if (parts.changes && parts.changes.length > 0) {
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
    ? parseSystemLines(changeSource(item))
    : parseChangeLines(changeSource(item));
}

/** Which merge family an item belongs to; null = never merges (assignment, approval, pipeline, due, MR state). */
export function mergeCategory(item: NotificationItem): MergeCategory | null {
  if (item.notificationType === 'mr-note' && isSystemNote(item)) {
    const lines = parseSystemLines(changeSource(item));
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
      return parseChangeLines(changeSource(item)).length > 0 ? 'changes' : null;
    default:
      return null;
  }
}

export function entityKey(item: NotificationItem): string | null {
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
  for (const raw of text.split(TOKEN_SPLIT).filter(Boolean)) {
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
 * Union of chronological change lists: a chain of changes to one field (each `from` equal to the
 * previous `to`) collapses to first-from -> last-to, no-ops (from === to) drop, label diffs net out.
 * Changes that do not chain — e.g. two separate values added to a multi-value field (Fix Version,
 * Component, GitLab assignees) — stay separate lines so no value is lost.
 */
export function mergeChanges(chronological: ChangeLine[][]): ChangeLine[] {
  const diffs = new Map<string, ChangeLine>();
  /** Open diff keys per field, oldest first. */
  const fieldDiffs = new Map<string, string[]>();
  const labels = new Map<string, number>();
  const labelOrder: string[] = [];
  /** Net flag state over the merged window: flag then unflag cancels out. */
  let flagNet = 0;
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
      if (c.action === 'flag') {
        if (!order.includes('flag')) order.push('flag');
        flagNet = Math.max(-1, Math.min(1, flagNet + (c.field === 'flagged' ? 1 : -1)));
        continue;
      }
      const isDiff = !c.text && (c.from !== undefined || c.to !== undefined);
      const reviewish = c.action === 'review' || c.action === 'unreview';
      if (isDiff && !reviewish) {
        const keys = fieldDiffs.get(c.field) ?? [];
        // The same change twice (one changelog entry carried by two polled items) is one change.
        if (
          keys.some((k) => {
            const d = diffs.get(k);
            return d?.from === c.from && d?.to === c.to;
          })
        )
          continue;
        // Extend the most recent line of this field whose new value is this change's old value.
        let key = [...keys].reverse().find((k) => diffs.get(k)?.to === c.from);
        if (!key) {
          key = `${c.field}#${keys.length}`;
          keys.push(key);
          fieldDiffs.set(c.field, keys);
          order.push(`d:${key}`);
        }
        const prev = diffs.get(key);
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
    } else if (key === 'flag') {
      if (flagNet !== 0)
        out.push({ field: flagNet > 0 ? 'flagged' : 'removed flag', action: 'flag' });
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
    verb: promoted ? `mentioned you in ${n} comments` : `commented ${n} times`,
    promoted,
    count: n,
    comments: items.map((i) => ({
      id: i.id,
      text: describeEventParts(i).commentText ?? commentPreview(i),
      createdAt: i.createdAt,
      mention: isMention(i),
    })),
  };
}

/** Every store id a card stands for: merged items plus hidden duplicate copies. */
export function entryIds(entry: EventEntry): string[] {
  return [...entry.items.map((i) => i.id), ...(entry.duplicateIds ?? [])];
}

/** Every store id a stack stands for (all cards, merged items and duplicate copies). */
export function stackIds(stack: StackEntry | StackHeaderEntry): string[] {
  return stack.cards.flatMap(entryIds);
}

/**
 * Pure post-pass over buildEntries(): cards sharing an issue / MR (2+) collapse into one `stack`
 * at the position of the newest card; an expanded entity becomes a `stack-header` followed by its
 * cards (ids unchanged). Bucket headers are re-derived so none is left empty.
 */
/** Where an expanded stack sat when it was opened: ids of the entries just above / below it. */
export interface StackAnchor {
  after?: string;
  /** Bucket header right above the group when it was the first item of its bucket. */
  header?: string;
  before?: string;
}

/**
 * Same as stackEntriesNatural, but an expanded stack with an anchor stays where it was opened:
 * right after its upper neighbour (else right before its lower one) instead of re-sorting by its
 * newest card — removing the top card must not make the open group jump away (261111-m0g UAT).
 * A neighbour that is itself a stack is matched in either form (collapsed `stack:k` or expanded
 * `stack-header:k` + members). Without a surviving neighbour the stack falls back to its natural
 * position.
 */
export function stackEntries(
  entries: NotificationEntry[],
  expanded: ReadonlySet<string>,
  anchors?: ReadonlyMap<string, StackAnchor>,
): NotificationEntry[] {
  if (!anchors || anchors.size === 0) return stackEntriesNatural(entries, expanded);
  const natural = stackEntriesNatural(entries, expanded);
  const blockKey = (e: NotificationEntry): string | null => {
    if (e.kind === 'stack' || e.kind === 'stack-header') return e.entity;
    return null;
  };
  // Pull out each anchored block: an open stack (header + member cards), or — once clearing has
  // left a single card — that card, so the last one stays in the slot too instead of re-sorting.
  const blocks = new Map<string, NotificationEntry[]>();
  for (const [key] of anchors) {
    const start = natural.findIndex((e) => e.kind === 'stack-header' && e.entity === key);
    if (start >= 0 && expanded.has(key)) {
      const head = natural[start];
      const size = head.kind === 'stack-header' ? head.cards.length : 0;
      blocks.set(key, natural.slice(start, start + 1 + size));
      continue;
    }
    const singles = natural.filter((e) => e.kind === 'event' && entityKey(e.item) === key);
    if (singles.length === 1 && !natural.some((e) => e.kind === 'stack' && e.entity === key)) {
      blocks.set(key, singles);
    }
  }
  if (blocks.size === 0) return natural;
  // Remove the blocks but KEEP every header for now: a group anchored under its own bucket header
  // (e.g. the only item in "Yesterday") must be re-inserted under that header, not the next
  // bucket's. Headers left empty are dropped after insertion.
  const out = natural.filter((e) => ![...blocks.values()].some((b) => b.includes(e)));
  /** Index range [first, last] of the entry `id` in `out`, treating a stack id in either form. */
  const locate = (id: string): [number, number] | null => {
    const direct = out.findIndex((e) => e.id === id);
    if (direct >= 0) {
      const e = out[direct];
      if (e.kind === 'stack-header') return [direct, direct + e.cards.length];
      return [direct, direct];
    }
    const m = id.match(/^stack(?:-header)?:(.+)$/);
    if (!m) return null;
    const idx = out.findIndex((e) => blockKey(e) === m[1]);
    if (idx < 0) return null;
    const e = out[idx];
    return e.kind === 'stack-header' ? [idx, idx + e.cards.length] : [idx, idx];
  };
  for (const [key, block] of blocks) {
    const anchor = anchors.get(key) ?? {};
    const after = anchor.after ? locate(anchor.after) : null;
    if (after) {
      out.splice(after[1] + 1, 0, ...block);
      continue;
    }
    const header = anchor.header ? out.findIndex((e) => e.id === anchor.header) : -1;
    if (header >= 0) {
      out.splice(header + 1, 0, ...block);
      continue;
    }
    const before = anchor.before ? locate(anchor.before) : null;
    if (before) {
      out.splice(before[0], 0, ...block);
      continue;
    }
    // No surviving neighbour: natural position.
    return stackEntriesNatural(entries, expanded);
  }
  // Drop headers left with nothing under them.
  return out.filter(
    (e, i) => e.kind !== 'header' || (out[i + 1] !== undefined && out[i + 1].kind !== 'header'),
  );
}

function stackEntriesNatural(
  entries: NotificationEntry[],
  expanded: ReadonlySet<string>,
): NotificationEntry[] {
  const groups = new Map<string, EventEntry[]>();
  for (const e of entries) {
    if (e.kind !== 'event') continue;
    const key = entityKey(e.item);
    if (!key) continue;
    const g = groups.get(key);
    if (g) g.push(e);
    else groups.set(key, [e]);
  }
  const out: NotificationEntry[] = [];
  const seen = new Set<string>();
  let pendingHeader: HeaderEntry | null = null;
  const push = (...list: NotificationEntry[]) => {
    if (pendingHeader) {
      out.push(pendingHeader);
      pendingHeader = null;
    }
    out.push(...list);
  };
  for (const e of entries) {
    if (e.kind === 'header') {
      pendingHeader = e;
      continue;
    }
    if (e.kind !== 'event') {
      push(e);
      continue;
    }
    const key = entityKey(e.item);
    const cards = key ? groups.get(key) : undefined;
    if (!key || !cards || cards.length < 2) {
      push(e);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    if (expanded.has(key)) {
      push({ kind: 'stack-header', id: `stack-header:${key}`, entity: key, cards }, ...cards);
    } else {
      const total = cards.reduce((n, c) => n + c.items.length, 0);
      push({
        kind: 'stack',
        id: `stack:${key}`,
        entity: key,
        cards,
        isUnread: cards.some((c) => c.isUnread),
        more: total - cards[0].items.length,
      });
    }
  }
  return out;
}

const JIRA_COMMENT_ID_RE = /^jira-(?:all)?comment-(.+)$/;

/** The underlying Jira comment, whichever query (mention / all comments) produced the item. */
function jiraCommentIdentity(item: NotificationItem): string | null {
  if (item.source !== 'jira') return null;
  const m = item.id.match(JIRA_COMMENT_ID_RE);
  return m ? m[1] : null;
}

/**
 * Collapse copies of one Jira comment to a single item; the mention copy wins. Returns the
 * kept items (order preserved) and kept id -> ids of the dropped copies.
 */
function dedupeJiraComments(items: NotificationItem[]): {
  items: NotificationItem[];
  duplicates: Map<string, string[]>;
} {
  const best = new Map<string, NotificationItem>();
  const copies = new Map<string, string[]>();
  for (const item of items) {
    const key = jiraCommentIdentity(item);
    if (!key) continue;
    const prev = best.get(key);
    if (!prev || (isMention(item) && !isMention(prev))) best.set(key, item);
    copies.set(key, [...(copies.get(key) ?? []), item.id]);
  }
  const duplicates = new Map<string, string[]>();
  for (const [key, kept] of best) {
    const others = (copies.get(key) ?? []).filter((id) => id !== kept.id);
    if (others.length > 0) duplicates.set(kept.id, others);
  }
  if (duplicates.size === 0) return { items, duplicates };
  return {
    items: items.filter((i) => {
      const key = jiraCommentIdentity(i);
      return !key || best.get(key) === i;
    }),
    duplicates,
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
  const { items: sorted, duplicates } = dedupeJiraComments(
    filterItems(input.items, readSet, input.source, false),
  );
  // A comment is read when any stored copy of it is read.
  const isRead = (i: NotificationItem) =>
    readSet.has(i.id) || (duplicates.get(i.id) ?? []).some((id) => readSet.has(id));
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
    const isUnread = group.some((i) => !isRead(i));
    if (input.unreadOnly && !isUnread) continue;
    const duplicateIds = group.flatMap((i) => duplicates.get(i.id) ?? []);
    const bucket = bucketOf(item.createdAt, now);
    if (bucket !== current) {
      current = bucket;
      entries.push({ kind: 'header', id: `header:${bucket}`, bucket, label: BUCKET_LABEL[bucket] });
    }
    entries.push({
      kind: 'event',
      id: `event:${item.id}`,
      item,
      items: group,
      isUnread,
      ...(duplicateIds.length > 0 ? { duplicateIds } : {}),
    });
  }
  return entries;
}

/**
 * Unread notifications as the user SEES them: one per card (merged runs count once), so the bell
 * and tab chips match the list. Same merge rules as buildEntries.
 */
export function countUnreadCards(
  items: NotificationItem[],
  readSet: ReadonlySet<string>,
  source: SourceFilter,
  now: number,
): number {
  return buildEntries({ items, readSet, source, unreadOnly: true, now }).filter(
    (e) => e.kind === 'event',
  ).length;
}

/** Max rows a card's change / comment list may take (items + the "+N more" row). */
export const MAX_LIST_ROWS = 10;

/**
 * Items to show in a capped list. Up to MAX_LIST_ROWS items show in full; beyond that show
 * MAX_LIST_ROWS - 1 items plus a "+N more" row (N >= 2, since "+1 more" would cost the same
 * line as just showing the item).
 */
export function visibleCount(total: number): number {
  return total <= MAX_LIST_ROWS ? total : MAX_LIST_ROWS - 1;
}

/** Rows a list of `total` items occupies, including the "+N more" row. */
export function listRowCount(total: number): number {
  return total <= MAX_LIST_ROWS ? total : MAX_LIST_ROWS;
}

/** Geometry (px, default density) behind estimateEntryHeight; mirror NotificationRow / NotificationList. */
export const EST_HEADER_HEIGHT = 28;
export const EST_STACK_HEADER_HEIGHT = 40;
/** Collapsed-stack peek edges (StackCard pb-3). */
export const EST_STACK_PEEK = 12;
/** Card padding py-3 (24) + line 1 h-5 (20) + line 2 h-5 (20). */
export const EST_CARD_BASE = 64;
/** Gap under every card (wrapper pb-2). */
export const EST_CARD_GAP = 8;
/** List rows: h-5 rows, gap-1 between them, mt-1 above the list. */
export const EST_LIST_ROW = 20;
export const EST_LIST_ROW_GAP = 4;
export const EST_LIST_MARGIN = 4;
/** Quick-action pill row: mt-1.5 (6) + h-5 (20). */
export const EST_QUICK_ROW = 26;

/** Pixel height for the virtualizer's first paint (default density); real heights are measured. */
export function estimateEntryHeight(entry: NotificationEntry): number {
  if (entry.kind === 'header') return EST_HEADER_HEIGHT;
  if (entry.kind === 'stack-header') return EST_STACK_HEADER_HEIGHT;
  if (entry.kind === 'stack') return estimateEntryHeight(entry.cards[0]) + EST_STACK_PEEK;
  const parts = describeEntryParts(entry.items);
  let h = EST_CARD_BASE + EST_CARD_GAP;
  const list = (n: number) => {
    if (n < 2) return 0;
    const rows = listRowCount(n);
    return EST_LIST_MARGIN + rows * EST_LIST_ROW + (rows - 1) * EST_LIST_ROW_GAP;
  };
  h += list(parts.changes?.length ?? 0);
  h += list(parts.comments?.length ?? 0);
  if (quickActionFor(entry.item, parts)) h += EST_QUICK_ROW;
  return h;
}

export function isFocusableEntry(entry: NotificationEntry): entry is EventEntry | StackEntry {
  return entry.kind === 'event' || entry.kind === 'stack';
}

export type QuickActionKind = 'reply-jira' | 'reply-gitlab' | 'review' | 'open-mr' | 'pipeline';

export interface QuickAction {
  kind: QuickActionKind;
  label: string;
}

/**
 * The ONE context action a card offers (Ledger pill). Only things the app can already do:
 * Jira Reply = open the issue with the composer focused, GitLab Reply / View pipeline = open the
 * (safe) URL externally, Review / Open MR = the in-app MR page. Anything else: none.
 */
export function quickActionFor(item: NotificationItem, parts: EventParts): QuickAction | null {
  const hasMr = item.mrProjectId != null && item.mrIid != null;
  const safeUrl = Boolean(item.url && isSafeHttpUrl(item.url));
  switch (item.notificationType) {
    case 'jira-comment':
    case 'comment-mention':
      return item.source === 'jira' && getJiraKey(item)
        ? { kind: 'reply-jira', label: 'Reply' }
        : null;
    case 'gitlab-mention':
      return safeUrl ? { kind: 'reply-gitlab', label: 'Reply' } : null;
    case 'mr-note':
      if (isSystemNote(item)) {
        return hasMr && parts.changes?.some((c) => c.action === 'review')
          ? { kind: 'review', label: 'Review' }
          : null;
      }
      return safeUrl ? { kind: 'reply-gitlab', label: 'Reply' } : null;
    case 'mr-approval':
      return hasMr ? { kind: 'open-mr', label: 'Open MR' } : null;
    case 'pipeline-failure':
      return safeUrl ? { kind: 'pipeline', label: 'View pipeline' } : null;
    default:
      return null;
  }
}
