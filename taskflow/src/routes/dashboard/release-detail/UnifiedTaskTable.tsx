import {
  AlertTriangle,
  Check,
  GitBranch,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  ListChecks,
  ListTodo,
  Loader2,
  type LucideIcon,
  Milestone,
  Search,
  X,
} from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { LinkContextMenu } from '@/components/ui/link-context-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FilterPopover, SortableHeader } from '@/components/ui/table-filter-sort';
import { UNASSIGNED_FILTER, UNASSIGNED_LABEL } from '@/lib/assignee-filter';
import { isEpicTypeName } from '@/lib/issue-type';
import { openExternal } from '@/lib/openExternal';
import { PEEKED_ROW_CLASS } from '@/lib/peek-highlight';
import { type ChipTone, statusPillClass } from '@/lib/statusStyles';
import { nextSort, type SortDir } from '@/lib/table-sort';
import { cn } from '@/lib/utils';
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import { extractTicketKeys } from '@/services/linkEngine';
import { useIsPeeked } from '@/stores/peek.store';
import {
  CALLOUT_COUNT_CLASS,
  CALLOUT_ERROR_CLASS,
  CALLOUT_FIX_ACTION_COL,
  CALLOUT_HEADER_CLASS,
  CALLOUT_HINT_CLASS,
  CALLOUT_ICON_CLASS,
  CALLOUT_LIST_CLASS,
  CALLOUT_ROW_CLASS,
  CALLOUT_SECTION_CLASS,
  CALLOUT_SHOW_ALL_CLASS,
  CALLOUT_STATE_PILL_CLASS,
  CALLOUT_TITLE_CLASS,
  CALLOUT_VISIBLE_ROWS,
} from './calloutSection';
import type { Channel, DriftMark, DriftRow } from './driftDetection';
import { UNLABELED_FILTER } from './graphs/MrLabels';
import { ApplyFixVersionAction, LinkTaskAction } from './NotCoveredFixActions';
import { useNotCoveredFixes } from './notCoveredFixes';
import {
  buildTaskFilterOptions,
  matchesTaskFilters,
  sortTaskRows,
  type TaskSortKey,
} from './taskTableFilters';
import { type MrFixAction, useMrFixMutation, useMrGroupFix } from './useMrFixMutation';
import { type TaskIssueFilterState, useTaskIssueFilters } from './useTaskIssueFilters';

/**
 * Every write input the BR/MS action cells need, resolved upstream by
 * `useReleaseDetail` and threaded through as one prop (P87 D-08 — this
 * table stays presentational: it fetches nothing and reads no store).
 *
 * Re-hosted verbatim from `MrDriftSection.tsx` — same six fields.
 */
export interface MrFixContext {
  projectId: number | null;
  baseUrl: string | null;
  token: string | null;
  releaseBranchName: string | null;
  releaseBranchExists: boolean;
  matchedMilestone: { id: number; title: string } | null;
}

export interface UnifiedTaskTableProps {
  /** Lifted status/type/assignee filters so the release graphs can toggle them (261102-vuw). */
  issueFilterState?: TaskIssueFilterState;
  versionName: string;
  hasReleaseDate: boolean;
  isLoadingIssues: boolean;
  isLoadingDrift: boolean;
  driftUnavailable: boolean;
  hasMatchedMilestone: boolean;
  /**
   * CR-06: the GitLab milestone lookup itself failed. `hasMatchedMilestone`
   * is false in this case too, but for an entirely different reason — an
   * unanswered question, not a verified absence — so the banner must not
   * assert "No GitLab milestone matched".
   */
  milestoneLookupFailed: boolean;
  primaryRows: Array<{ issue: JiraIssue; mrs: DriftRow[] }>;
  secondaryRows: DriftRow[];
  /** Task key -> Jira issue type name for the not-covered rows' linked keys. */
  secondaryKeyTypes?: Record<string, string>;
  flaggedMrCount: number;
  brFlaggedCount: number;
  msFlaggedCount: number;
  onOpenIssue: (key: string) => void;
  onOpenIssueFull: (key: string) => void;
  onSeedBreadcrumb: () => void;
  onNavigateToIssueFromMR: (key: string) => void;
  fix: MrFixContext;
  /**
   * Jira write context for the "Not in version" Apply action. Optional (and
   * separate from `fix`) so existing fixtures need no change; without it no
   * Apply button renders.
   */
  jiraFix?: { baseUrl: string | null; versionId: string };
  /** MR label name filtering the table (set by clicking a label pill in the MR graph). */
  labelFilter?: string | null;
  onClearLabelFilter?: () => void;
}

// Shared column grid constants (D-02) — every row that renders a given column
// uses the same width for it. Explicit px throughout, never `%` or an
// unconstrained narrow `flex-1` (recorded WebKit/Tauri zero-width-column
// collapse).
//
// WR-06: the two tables are deliberately DIFFERENT SHAPES, and each has its own
// header strip. A task row is Key / Summary / Assignee / Status / MR / BR / MS;
// a secondary MR sub-line is icon+Key / State / Author / Reviewers / Merge request /
// MR state / BR / MS / Fix (261102-fkr, reordered 261103-jmo to match the
// deployment-package table). Sharing one strip across both put three
// column headings — Assignee, Status, MR — over the middle of the MR title
// text. Do not "re-unify" the strips without also restoring those cells.
// Keys must never wrap — a Jira key broken at its dash reads as two keys. Fixed
// width + nowrap; widened from 72px so the common PROJ-1234 shape fits without
// spilling into the summary column.
const EMPTY_KEY_TYPES: Record<string, string> = {};
const COL_ICON = 'flex-none w-[1.125rem] @max-[640px]:hidden';
const COL_KEY = 'flex-none w-[5.5rem] whitespace-nowrap';
const COL_SUMMARY = 'flex-1 min-w-0';
const COL_PERSON = 'flex-none w-[8.75rem] min-w-0 @max-[860px]:w-9';
const COL_STATE = 'flex-none w-[6rem] @max-[400px]:hidden';
// MR status: a fixed-size segmented ring + "merged/live" ("3/5"), so the column
// is narrow and never stretches with the MR count; it drops at 520 (BR/MS stay).
const COL_MR = 'flex-none w-[5rem] min-w-0 @max-[520px]:hidden';
// Primary-row assignee sits LAST (shipped list convention: Key / Title / Status /
// domain columns / Assignee — AIO Executions + Defects, Backlog). Wider when there
// is room, avatar-only at 860 like every other release table.
const COL_ASSIGNEE =
  'flex-none w-[9rem] @min-[1100px]:w-[11rem] min-w-0 pr-2 @max-[860px]:w-9 @max-[860px]:pr-0';
// Secondary (uncovered MR) row columns, explicit widths. The state pill and
// MR-state cells are flex parents so their pills keep their own geometry. The
// state pill collapses to an icon at 520 (same geometry as the package callout).
const COL_SECONDARY_STATE = 'w-[84px] flex-none @max-[520px]:w-7';
const COL_SECONDARY_KEY = '@max-[520px]:hidden';
const COL_SECONDARY_SUMMARY = 'flex-[2_1_0%] min-w-[6rem]';
/** What the row's fix button will do — same sizing as the package section's Fix column. */
const COL_SECONDARY_FIX_TARGET = 'flex-[1_1_0%] min-w-[7rem] max-w-[280px] @max-[600px]:hidden';
const MUTED_STATE_PILL_CLASS =
  'inline-flex items-center justify-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground';
const COL_REVIEWERS =
  'flex-none w-[4.5rem] min-w-0 flex items-center overflow-hidden @max-[640px]:hidden';
const COL_MR_STATE = 'flex-none w-[5rem] flex items-center @max-[400px]:hidden';

/** Text colour per tone for the MR status style (glyph + word, ring count). */
const MR_TONE_TEXT: Record<ChipTone, string> = {
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-green-600 dark:text-green-400',
  red: 'text-red-600 dark:text-red-400',
  orange: 'text-orange-600 dark:text-orange-400',
  amber: 'text-amber-600 dark:text-amber-400',
  purple: 'text-purple-600 dark:text-purple-400',
  muted: 'text-muted-foreground',
};

/** Worst mark across a task's MRs: flag beats ok beats na. */
export function aggregateMark(marks: DriftMark[]): DriftMark {
  if (marks.includes('flag')) return 'flag';
  if (marks.includes('ok')) return 'ok';
  return 'na';
}

export type MrStateKind = 'merged' | 'open' | 'draft' | 'closed';

function mrStateKind(mr: GitLabMR): MrStateKind {
  if (mr.state === 'merged') return 'merged';
  if (mr.state === 'opened') return mr.draft ? 'draft' : 'open';
  return 'closed';
}

const MR_KIND_ORDER: MrStateKind[] = ['merged', 'open', 'draft', 'closed'];

/**
 * Overall status of a task's MRs for the task row: one group per state
 * present (merged, open, draft, closed) with its count — every MR counted,
 * no "+N" — plus the single-state word, a tone, the merged/live fraction and
 * the live groups the ring draws. Pure — derived inline in render (React Compiler).
 */
export function mrStatusSummary(rows: DriftRow[]): {
  groups: Array<{ kind: MrStateKind; count: number }>;
  label: string;
  ariaLabel: string;
  tone: ChipTone;
  /** Merged share of the live (non-closed) MRs, 0..1. */
  progress: number;
  /** Visible row text: merged / live ("3/5"), or "closed" when nothing is live. */
  fraction: string;
  /**
   * What the ring draws: the live groups only (merged / open / draft). Closed
   * MRs are abandoned work — they stay in the popover but never in the ring or
   * the "merged/live" count, so the two always agree.
   */
  ringGroups: Array<{ kind: MrStateKind; count: number }>;
} {
  const n = rows.length;
  const counts = new Map<MrStateKind, number>();
  for (const r of rows) counts.set(mrStateKind(r.mr), (counts.get(mrStateKind(r.mr)) ?? 0) + 1);
  const groups = MR_KIND_ORDER.filter((k) => counts.has(k)).map((k) => ({
    kind: k,
    count: counts.get(k) ?? 0,
  }));

  const merged = counts.get('merged') ?? 0;
  const open = counts.get('open') ?? 0;
  const draft = counts.get('draft') ?? 0;
  const closed = counts.get('closed') ?? 0;
  const live = merged + open + draft;

  let label: string;
  let tone: ChipTone;
  if (live === 0) {
    label = 'Closed';
    tone = 'muted';
  } else if (merged === live) {
    label = 'Merged';
    tone = 'green';
  } else if (merged === 0) {
    label = open === 0 ? 'Draft' : 'Open';
    tone = open === 0 ? 'muted' : 'blue';
  } else {
    label = `${merged}/${live} merged`;
    tone = 'blue';
  }

  const parts = [`${merged} merged`, `${open + draft} open`];
  if (closed > 0) parts.push(`${closed} closed`);
  const fraction = live === 0 ? 'Closed' : `${merged}/${live}`;
  // Starts with the visible text (WCAG 2.5.3 label-in-name).
  const ariaLabel = `${groups.filter((g) => g.kind !== 'closed').length > 1 ? `${fraction} merged` : label} — ${n} merge request${n === 1 ? '' : 's'}: ${parts.join(', ')} — show details`;

  const progress = live === 0 ? 0 : merged / live;

  const ringGroups = groups.filter((g) => g.kind !== 'closed');

  return { groups, label, ariaLabel, tone, progress, fraction, ringGroups };
}

export type SecondaryReason = 'no-linked-task' | 'not-in-fix-version' | 'unevaluated';

/**
 * Why a row is uncovered. Rows whose TASK reason was not evaluated (locked;
 * closed rows never reach this list — 261103-eu3) get 'unevaluated'
 * (T-91.1-14). Merged rows carry a real TASK reason since 261103-eu3.
 */
export function secondaryReason(row: DriftRow): SecondaryReason {
  if (row.taskReason === 'not-in-fix-version') return 'not-in-fix-version';
  if (row.taskReason === 'no-linked-task') return 'no-linked-task';
  return 'unevaluated';
}

const REASON_PILL_LABEL: Record<SecondaryReason, string> = {
  'no-linked-task': 'No task',
  'not-in-fix-version': 'Not in version',
  unevaluated: 'Not evaluated',
};

/**
 * Every linked key is an Epic. Epics can't carry a fix version, so the row
 * keeps its "Not in version" state but has no Apply fix.
 */
function isEpicOnlyRow(row: DriftRow, keyTypes: Record<string, string>): boolean {
  return row.taskKeys.length > 0 && row.taskKeys.every((k) => isEpicTypeName(keyTypes[k]));
}

function epicOnlyTitle(keys: string[]): string {
  return `${keys.join(', ')} ${keys.length > 1 ? 'are' : 'is'} an Epic — epics can't carry a fix version; link the MR to a task instead`;
}

function SecondaryReasonPill({ row, versionName }: { row: DriftRow; versionName: string }) {
  const reason = secondaryReason(row);
  let title: string;
  if (reason === 'not-in-fix-version') {
    const keys = row.taskKeys.join(', ');
    title = keys
      ? `${keys} ${row.taskKeys.length > 1 ? 'are' : 'is'} not in fix version ${versionName}`
      : `Linked task is not in fix version ${versionName}`;
  } else if (reason === 'no-linked-task') {
    title = 'No linked task';
  } else {
    title = `Not evaluated (MR is ${row.mr.state})`;
  }
  return (
    <span
      data-testid="secondary-reason-pill"
      data-reason={reason}
      title={title}
      className={`${reason === 'unevaluated' ? MUTED_STATE_PILL_CLASS : CALLOUT_STATE_PILL_CLASS} pointer-events-none whitespace-nowrap ${COL_SECONDARY_STATE}`}
    >
      <AlertTriangle aria-hidden className="hidden size-3 @max-[520px]:block" />
      <span className="@max-[520px]:sr-only">{REASON_PILL_LABEL[reason]}</span>
    </span>
  );
}

function MrAuthorCell({ mr }: { mr: GitLabMR }) {
  return (
    <span className={`${COL_PERSON} flex items-center gap-1.5`}>
      <CachedAvatar url={mr.author.avatar_url || null} name={mr.author.name} size={20} />
      <span className="line-clamp-1 @max-[860px]:sr-only">{mr.author.name}</span>
    </span>
  );
}

function MrReviewersCell({ mr }: { mr: GitLabMR }) {
  const reviewers = mr.reviewers ?? [];
  if (reviewers.length === 0) {
    return (
      <span className={`${COL_REVIEWERS} text-muted-foreground`} title="No reviewers">
        &mdash;
      </span>
    );
  }
  const label = `Reviewers: ${reviewers.map((r) => r.name).join(', ')}`;
  return (
    <span className={COL_REVIEWERS} title={label}>
      <span className="flex items-center -space-x-1.5">
        {reviewers.map((r) => (
          <CachedAvatar
            key={r.id}
            url={r.avatar_url || null}
            name={r.name}
            size={18}
            className="ring-1 ring-background rounded-full"
          />
        ))}
      </span>
    </span>
  );
}

function MrStatePill({ mr }: { mr: GitLabMR }) {
  return (
    <span className={COL_MR_STATE}>
      <MrStateGlyph mr={mr} testId="secondary-mr-state" />
    </span>
  );
}

const CHANNEL_NAMES: Record<Channel, string> = {
  A: 'Jira link',
  B: 'GitLab milestone',
  C: 'release branch',
};

/**
 * Locate a normalised ticket key's ORIGINAL spelling inside a title.
 *
 * `extractTicketKeys` returns normalised keys — uppercased, and with the space
 * form ("PROJ 123") rewritten to the dash form ("PROJ-123"). The returned key is
 * therefore often not a literal substring of the title it came from, so callers
 * must not use `title.indexOf(key)` to locate it.
 *
 * @returns The match position and the text as it actually appears in the title,
 *          or `null` when the key cannot be located (caller should skip it).
 */
export function matchTicketKeyInTitle(
  title: string,
  normalisedKey: string,
): { index: number; text: string } | null {
  const [project, number] = normalisedKey.split('-');
  if (!project || !number) return null;
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Either separator, any case — mirrors the two patterns extractTicketKeys accepts.
  const re = new RegExp(`${escapeRe(project)}[\\s-]${escapeRe(number)}`, 'i');
  const m = re.exec(title);
  return m ? { index: m.index, text: m[0] } : null;
}

/**
 * Drop the ticket key(s) a title merely starts with — "[PROJ-1] Fix x",
 * "PROJ-1: Fix x", "PROJ-1 - Fix x" → "Fix x". Used by the secondary table,
 * whose Key column already shows the key, so repeating it in the title is noise.
 * Only a LEADING prefix is removed (keys later in the title stay as links), and
 * the title is left untouched if stripping would leave nothing.
 */
export function stripLeadingTicketKeys(title: string, keys: string[]): string {
  let rest = title;
  for (let n = 0; n < keys.length; n++) {
    const hit = keys
      .map((k) => matchTicketKeyInTitle(rest, k))
      .find((m) => m !== null && /^[\s[(]*$/.test(rest.slice(0, m.index)));
    if (!hit) break;
    const next = rest
      .slice(hit.index + hit.text.length)
      .replace(/^[\])]?\s*[:\-\u2013\u2014,/]*\s*/, '');
    if (!next) break;
    rest = next;
  }
  return rest;
}

function channelsTitle(channels: Set<Channel>): string {
  const names = (['A', 'B', 'C'] as Channel[])
    .filter((c) => channels.has(c))
    .map((c) => CHANNEL_NAMES[c]);
  return `Found via: ${names.join(', ')}`;
}

function DriftMarkCell({
  mark,
  testId,
  title,
}: {
  mark: DriftMark;
  testId: string;
  title?: string;
}) {
  return (
    <span
      data-testid={testId}
      title={title}
      className="flex-none w-[1.75rem] flex items-center justify-center"
    >
      {mark === 'ok' ? (
        <Check className="size-3.5 text-green-600 dark:text-green-400" />
      ) : mark === 'flag' ? (
        <AlertTriangle className="size-3.5 text-orange-600 dark:text-orange-400" />
      ) : (
        <span className="text-muted-foreground">&mdash;</span>
      )}
    </span>
  );
}

/**
 * Whether a BR/MS cell for `mark` would render an interactive `<button>`
 * rather than an inert glyph — the single predicate `DriftActionCell` uses
 * internally AND the task row uses to decide the cell's hit-testing class
 * (CR-05). Keeping one function means the two can never disagree: an inert
 * cell that claimed `z-10` would silently eat the full-row click.
 *
 * `pending` / `error` are deliberately not considered: both are only
 * reachable from a click on a cell that was actionable, and when a
 * prerequisite disappears underneath a failure the cell degrades back to an
 * inert span — which is exactly what `false` describes.
 */
export function mrFixReadiness(
  action: MrFixAction,
  fix: MrFixContext,
): { configComplete: boolean; prereqReady: boolean } {
  const configComplete = fix.projectId != null && fix.baseUrl != null && fix.token != null;
  const prereqReady =
    action === 'retarget'
      ? fix.releaseBranchExists && fix.releaseBranchName != null
      : fix.matchedMilestone != null;
  return { configComplete, prereqReady };
}

export function isMrFixActionable(
  mark: DriftMark,
  action: MrFixAction,
  fix: MrFixContext,
): boolean {
  const { configComplete, prereqReady } = mrFixReadiness(action, fix);
  return mark === 'flag' && configComplete && prereqReady;
}

/**
 * BR/MS action cell (D-01..D-09, D-14, MRFIX-01..04): renders the same 28px
 * geometry as `DriftMarkCell` in every state, but a flagged + actionable cell
 * becomes a focus-reachable button that fires `useMrFixMutation` on click and
 * reveals its action icon on row-hover/focus.
 *
 * Calls `useMrFixMutation` unconditionally (Rules of Hooks) — every cell
 * owns its own hook instance regardless of whether it ends up actionable,
 * so BR and MS lock independently (D-09).
 */
function DriftActionCell({
  mr,
  action,
  mark,
  testId,
  fix,
}: {
  mr: GitLabMR;
  action: MrFixAction;
  mark: DriftMark;
  testId: string;
  fix: MrFixContext;
}) {
  const { status, errorMessage, fire, reset } = useMrFixMutation({
    action,
    mr,
    projectId: fix.projectId,
    baseUrl: fix.baseUrl,
    token: fix.token,
    targetBranch: fix.releaseBranchName,
    milestone: fix.matchedMilestone,
  });

  const { prereqReady } = mrFixReadiness(action, fix);
  const actionable = isMrFixActionable(mark, action, fix);

  // WR-08: a sticky failure must not outlive the problem it describes. If a
  // background refetch shows this field is now correct — someone fixed it in
  // GitLab directly, or the other user did — the red "click to retry" cell is
  // stale, and the only way out of it would be another pointless write. This
  // is the documented "adjust state when a prop changes" pattern (a render-
  // phase update guarded by a ref), not an effect: React re-renders
  // immediately, so the cell never paints red for a row that is already ok.
  //
  // CR-07: the same guard must also fire when the CELL'S MR CHANGES. On the
  // task row's popover lists MRs whose order can change under a filter toggle
  // or a cache patch. `mark` alone does not notice (two MRs both flagged
  // share `mark === 'flag'`), so an error/pending state — and the `fire()`
  // lock — would migrate onto a merge request whose write was never issued.
  // Callers additionally `key` this component by `mr.id`; this guard is the
  // belt to that braces, and covers any caller that forgets.
  const lastMarkRef = useRef(mark);
  const lastMrIdRef = useRef(mr.id);
  if (lastMrIdRef.current !== mr.id) {
    lastMrIdRef.current = mr.id;
    lastMarkRef.current = mark;
    // Unconditional: nothing this instance holds describes the new MR.
    reset();
  } else if (lastMarkRef.current !== mark) {
    lastMarkRef.current = mark;
    if (mark === 'ok' && status === 'error') reset();
  }

  const rootClassName = 'flex-none w-[1.75rem] flex items-center justify-center';
  const actionLabel =
    action === 'retarget'
      ? `Retarget to ${fix.releaseBranchName}`
      : `Assign milestone ${fix.matchedMilestone?.title}`;

  /**
   * WR-05: the failure message is otherwise announced to nobody — it lives
   * only in a title/aria-label on an element the user may not be focused on.
   * The region is rendered in EVERY button state (empty while idle/pending)
   * so it already exists in the DOM when the text arrives; a live region that
   * mounts together with its content is unreliably announced.
   */
  const liveRegion = (
    <span role="status" aria-live="polite" className="sr-only">
      {status === 'error' ? (errorMessage ?? 'Update failed') : ''}
    </span>
  );

  if (status === 'pending') {
    // WR-05: stays a <button> (never a <span>) so a keyboard user who just
    // activated this cell keeps the focus ring — swapping the element type
    // dropped focus to document.body and forced a re-traversal of the row.
    // `aria-disabled` rather than `disabled`, because browsers blur a focused
    // element the moment it becomes disabled — which is the bug, not the fix.
    // The click itself is already inert: `fire()` returns early while pending.
    return (
      <button
        type="button"
        data-testid={testId}
        onClick={fire}
        aria-disabled="true"
        aria-busy="true"
        aria-label={actionLabel}
        className={`${rootClassName} rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`}
      >
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        {liveRegion}
      </button>
    );
  }

  if (status === 'error') {
    // WR-08: only offer the retry when a retry could actually succeed. If the
    // prerequisite disappeared under the failure (release branch deleted,
    // GitLab token cleared), a click is guaranteed to throw 'GitLab project
    // not configured' / 'Release branch unavailable' — and because this
    // branch is evaluated before the inert-cell branch below, that
    // explanation would otherwise be unreachable for the rest of the session.
    if (!actionable) {
      const label = errorMessage ?? 'Update failed';
      return (
        <span data-testid={testId} title={label} className={rootClassName}>
          <AlertTriangle className="size-3.5 text-red-600 dark:text-red-400" />
          {liveRegion}
        </span>
      );
    }
    const label = errorMessage ?? 'Update failed — click to retry';
    return (
      <button
        type="button"
        data-testid={testId}
        onClick={fire}
        title={label}
        aria-label={label}
        className={`${rootClassName} rounded hover:bg-accent hover:ring-1 hover:ring-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`}
      >
        <AlertTriangle className="size-3.5 text-red-600 dark:text-red-400" />
        {liveRegion}
      </button>
    );
  }

  if (mark === 'ok') {
    return (
      <span data-testid={testId} className={rootClassName}>
        <Check className="size-3.5 text-green-600 dark:text-green-400" />
      </span>
    );
  }

  if (mark === 'na') {
    return (
      <span data-testid={testId} className={rootClassName}>
        <span className="text-muted-foreground">&mdash;</span>
      </span>
    );
  }

  // mark === 'flag' from here on.
  if (!actionable) {
    const inertTitle =
      action === 'retarget' && !prereqReady
        ? "Release branch doesn't exist yet — create it above to enable retargeting"
        : undefined;
    return (
      <span data-testid={testId} title={inertTitle} className={rootClassName}>
        <AlertTriangle className="size-3.5 text-orange-600 dark:text-orange-400" />
      </span>
    );
  }

  const ActionIcon = action === 'retarget' ? GitBranch : Milestone;

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={fire}
      title={actionLabel}
      aria-label={actionLabel}
      className={`${rootClassName} group/fix rounded hover:bg-accent hover:ring-1 hover:ring-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`}
    >
      <AlertTriangle className="size-3.5 text-orange-600 dark:text-orange-400 group-hover/row:hidden group-focus-visible/fix:hidden" />
      <ActionIcon className="size-3.5 hidden group-hover/row:block group-focus-visible/fix:block" />
      {liveRegion}
    </button>
  );
}

/**
 * The PRIMARY (task) table's column header strip — same grid as a `TaskRow`.
 * The secondary table has its own strip (`SecondaryHeaderStrip`, WR-06); this
 * one must not be reused there, because a secondary row renders neither an
 * Assignee nor a Status nor an MR cell.
 *
 * WR-05 decision: visible labels only — deliberately no ARIA grid roles
 * (table / row / columnheader). The UI-SPEC mandates a div+flex structure
 * with no cell elements (Row anatomy: "not a table element"), so ARIA row
 * semantics over rows that expose no cell-role children would produce an
 * incomplete grid that assistive technology reports worse than plain text.
 * Visible labels restore the missing information for every user, screen
 * reader users included, with no partial-ARIA hazard. Do not "finish" this
 * into ARIA table semantics later.
 */
type TaskSort = { key: TaskSortKey | null; dir: SortDir };

function ColumnHeaderStrip({
  sort,
  onSort,
}: {
  sort: TaskSort;
  onSort: (key: TaskSortKey) => void;
}) {
  const headerProps = {
    activeSortKey: sort.key,
    activeSortDir: sort.dir,
    onSort,
    testIdPrefix: 'task',
  };
  return (
    <div
      data-testid="task-column-header"
      className="sticky top-(--release-sticky-top,0px) z-20 border-b flex items-center gap-2 text-xs text-muted-foreground font-medium pl-2 py-1 density-compact:py-0.5 density-comfortable:py-2 bg-[color-mix(in_oklab,var(--color-muted)_10%,var(--color-background))]"
    >
      <span className={COL_ICON} aria-hidden="true" />
      <SortableHeader sortKey="key" label="Key" className={COL_KEY} {...headerProps} />
      <SortableHeader sortKey="summary" label="Summary" className={COL_SUMMARY} {...headerProps} />
      <span className={COL_MR} title="Merge requests — merged / open">
        MRs
      </span>
      <span
        className="flex-none w-[1.75rem] text-center"
        title="Target branch matches release branch"
      >
        BR
      </span>
      <span className="flex-none w-[1.75rem] text-center" title="Release milestone assigned">
        MS
      </span>
      <SortableHeader sortKey="status" label="Status" className={COL_STATE} {...headerProps} />
      <SortableHeader
        sortKey="assignee"
        label={
          <>
            <span className="@max-[860px]:sr-only">Assignee</span>
            <span aria-hidden="true" className="hidden @max-[860px]:inline">
              Asg.
            </span>
          </>
        }
        className={COL_ASSIGNEE}
        {...headerProps}
      />
    </div>
  );
}

/**
 * The SECONDARY (uncovered-MRs) table's header strip (WR-06).
 *
 * A secondary row is an `MrSubLine`: icon + Key, State, Author, Reviewers, the MR
 * title, MR state, BR, MS, Fix (same lead order as the deployment-package table).
 * It renders no Assignee, Status or MR cell, so labelling those columns —
 * which the shared `ColumnHeaderStrip` did — put three headings over the
 * middle of the title text. The `pl-6` here matches the row's own indent so
 * the "Key" label sits over the key cell rather than 16px to its left.
 */
function SecondaryHeaderStrip() {
  return (
    <div data-testid="secondary-header" className={CALLOUT_HEADER_CLASS}>
      <span className={`${COL_ICON} ${COL_SECONDARY_KEY}`} aria-hidden="true" />
      <span className={`${COL_KEY} ${COL_SECONDARY_KEY}`}>Key</span>
      <span className={COL_SECONDARY_STATE}>
        <span className="@max-[520px]:sr-only">State</span>
      </span>
      <span className={COL_PERSON}>Author</span>
      <span className={COL_REVIEWERS}>Reviewers</span>
      <span className={COL_SECONDARY_SUMMARY}>Merge request</span>
      <span className={COL_MR_STATE}>MR state</span>
      <span
        className="flex-none w-[1.75rem] text-center"
        title="Target branch matches release branch"
      >
        BR
      </span>
      <span className="flex-none w-[1.75rem] text-center" title="Release milestone assigned">
        MS
      </span>
      <span className={COL_SECONDARY_FIX_TARGET}>Fix</span>
      {/* Spacer over the rows' trailing Apply / Link task cell — without it every
          header label shifts right and BR/MS sit over the action buttons. */}
      <span
        data-testid="secondary-header-fix-action"
        className={CALLOUT_FIX_ACTION_COL}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * One MR sub-line, shared between the primary table (indented under its task)
 * and the secondary table (uncovered MRs). `keyCell` swaps the leading key
 * column's content — the `!iid` link for primary rows, or a leading `!iid`
 * link plus a reason marker for secondary rows (D-11).
 */
function MrSubLine({
  row,
  onNavigateToIssueFromMR,
  fix,
  keyCell,
  reasonCell,
  actionCell,
  fixTarget,
  error,
}: {
  row: DriftRow;
  onNavigateToIssueFromMR: (key: string) => void;
  fix: MrFixContext;
  keyCell?: React.ReactNode;
  /** Secondary rows only: reason pill, which also switches on the author/reviewers/state cells. */
  reasonCell?: React.ReactNode;
  /** Secondary rows only: trailing fix action (Apply / Link task); the column is always reserved. */
  actionCell?: React.ReactNode;
  /** Secondary rows only: what `actionCell` will do ("→ 1.2.0"), shown in the Fix column. */
  fixTarget?: { text: string; title: string; note?: boolean };
  /** Secondary rows only: inline fix error rendered under the row. */
  error?: string;
}) {
  const { mr } = row;
  const isFlagged = row.br === 'flag' || row.ms === 'flag';

  const iidButton = (
    <LinkContextMenu href={mr.web_url}>
      <button
        type="button"
        onClick={() => openExternal(mr.web_url)}
        title={channelsTitle(row.channels)}
        className="font-mono text-xs hover:underline"
      >
        !{mr.iid}
      </button>
    </LinkContextMenu>
  );

  // Secondary rows already show the key in their Key column — don't repeat it as a title prefix.
  const displayTitle = keyCell ? stripLeadingTicketKeys(mr.title, row.taskKeys) : mr.title;
  const titleContent = (() => {
    const keys = extractTicketKeys(displayTitle);
    if (keys.length === 0) return displayTitle;
    const parts: React.ReactNode[] = [];
    let remaining = displayTitle;
    for (const k of keys) {
      // `extractTicketKeys` NORMALISES what it returns: it uppercases the key
      // and rewrites the space form ("PROJ 123") to the dash form
      // ("PROJ-123"). So the returned key is frequently NOT a literal
      // substring of the title, and a plain indexOf() misses. Locate the
      // original spelling instead — case-insensitive, with either separator —
      // and skip the key entirely when it cannot be located, rather than
      // slicing on a -1 index (which silently ate `key.length - 1`
      // characters of the title).
      const match = matchTicketKeyInTitle(remaining, k);
      if (!match) continue;
      if (match.index > 0) parts.push(remaining.slice(0, match.index));
      parts.push(
        <button
          key={k}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigateToIssueFromMR(k);
          }}
          className="text-primary hover:underline font-mono"
        >
          {match.text}
        </button>,
      );
      remaining = remaining.slice(match.index + match.text.length);
    }
    if (remaining) parts.push(remaining);
    return parts;
  })();

  const summaryCell = (
    <span className={`${reasonCell ? COL_SECONDARY_SUMMARY : COL_SUMMARY} truncate`}>
      {keyCell ? (
        <span className="inline-flex items-center gap-2">
          {iidButton}
          {titleContent}
        </span>
      ) : (
        titleContent
      )}
    </span>
  );

  const rowEl = (
    <div
      data-testid="drift-row"
      className={
        reasonCell
          ? `group/row ${CALLOUT_ROW_CLASS} ${isFlagged ? 'text-foreground' : 'text-muted-foreground'}`
          : `group/row pl-6 flex items-center gap-2 text-xs py-1 density-compact:py-0.5 density-comfortable:py-2 ${isFlagged ? 'text-foreground' : 'text-muted-foreground'}`
      }
    >
      {/* Secondary rows: icon+Key, State, Author, Reviewers, then the MR title
          (same lead order as the deployment-package table). Primary: Key, title. */}
      {keyCell ?? <span className={COL_KEY}>{iidButton}</span>}
      {reasonCell && (
        <>
          {reasonCell}
          <MrAuthorCell mr={mr} />
          <MrReviewersCell mr={mr} />
        </>
      )}
      {summaryCell}
      {reasonCell && <MrStatePill mr={mr} />}
      {/* 261103-fqd: BR is opened-only (GitLab rejects retargeting a merged
          MR); MS is also evaluated for merged MRs, so it renders regardless. */}
      {row.evaluated ? (
        <DriftActionCell mr={mr} action="retarget" mark={row.br} testId="drift-br" fix={fix} />
      ) : (
        <DriftMarkCell mark="na" testId="drift-br" />
      )}
      <DriftActionCell
        mr={mr}
        action="assign-milestone"
        mark={row.ms}
        testId="drift-ms"
        fix={fix}
      />
      {reasonCell && (
        <>
          {/* Fix sits directly before the button it describes. */}
          <span
            data-testid="secondary-fix-target"
            className={`${COL_SECONDARY_FIX_TARGET} truncate text-xs text-muted-foreground`}
            title={fixTarget?.title}
          >
            {fixTarget ? (
              <>
                {!fixTarget.note && <span aria-hidden="true">→ </span>}
                {fixTarget.text}
              </>
            ) : null}
          </span>
          <span className={CALLOUT_FIX_ACTION_COL}>{actionCell}</span>
        </>
      )}
    </div>
  );

  if (!reasonCell) return rowEl;
  return (
    <div className="min-w-0">
      {rowEl}
      {error && (
        <p className={CALLOUT_ERROR_CLASS} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Wraps a BR/MS drift cell for placement directly on a `TaskRow`, which sits
 * behind an absolute inset-0 overlay button (D-04 full-row click). An
 * actionable cell (button) needs `relative z-10` to win the click above the
 * overlay's stacking context; a purely inert cell (em-dash / check glyph)
 * gets `pointer-events-none` instead so a click there still falls through to
 * open the row — matching the sibling-overlay convention used by the
 * Key/Assignee/Status cells above.
 */
function DriftCellSlot({
  children,
  interactive,
}: {
  children: React.ReactNode;
  interactive: boolean;
}) {
  return (
    <div
      className={`relative flex-none w-[1.75rem] ${interactive ? 'z-10' : 'pointer-events-none'}`}
    >
      {children}
    </div>
  );
}

const naDriftCells = (
  <>
    <DriftCellSlot interactive={false}>
      <DriftMarkCell mark="na" testId="drift-br" />
    </DriftCellSlot>
    <DriftCellSlot interactive={false}>
      <DriftMarkCell mark="na" testId="drift-ms" />
    </DriftCellSlot>
  </>
);

/**
 * The task row's MR cell plus its BR/MS drift cells, on one line: an overall
 * status chip (state dots + progress label) and aggregate BR/MS marks. The
 * per-MR details and fix actions live in a popover opened by the chip or by a
 * flagged aggregate. `MrSubLine` survives unchanged for the secondary
 * (uncovered-MRs) table.
 *
 * The four MrSlot states (pending/failed/none/unavailable) render inline in
 * the MR cell's own space rather than as a separate full-width line — same
 * precedence, same `data-testid`s, same tooltip text as before this task.
 */
function TaskMrCell({
  mrs,
  allMrs,
  isLoadingDrift,
  driftUnavailable,
  hasMatchedMilestone,
  fix,
}: {
  mrs: DriftRow[];
  /**
   * WR-08: the task's UNFILTERED MR list. `mrs` is already restricted to the
   * active filter, so summarising from it under-reports: a task with one
   * flagged and three clean MRs would look like a single-MR task under the
   * filter, as if three MRs had vanished. The chip, the aggregate marks and
   * the popover describe the task, not the current view, so they are always
   * computed from this list.
   */
  allMrs: DriftRow[];
  isLoadingDrift: boolean;
  driftUnavailable: boolean;
  hasMatchedMilestone: boolean;
  fix: MrFixContext;
}) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  if (isLoadingDrift) {
    return (
      <>
        <div
          data-testid="mr-slot-pending"
          className={`pointer-events-none relative ${COL_MR} flex items-center gap-1.5 text-xs py-1 text-muted-foreground`}
        >
          <Loader2 className="size-4 flex-none animate-spin" />
          <span className="sr-only">loading…</span>
        </div>
        {naDriftCells}
      </>
    );
  }

  // Pending beats failed beats verified-empty (order matters). A channel
  // that failed to answer is an unknown, not a verified absence — never
  // orange, matching the neutral mr-slot-unavailable treatment.
  // WR-07: these two slots keep `pointer-events-none` ON PURPOSE — they are
  // non-interactive, and the row's full-row click must fall through them
  // (CR-05). That also means their `title` can never render: the browser
  // fires no hover for an element removed from hit-testing. So the VISIBLE
  // text has to carry the state on its own, with the long-form explanation in
  // the page-wide banner above. The titles below are supplementary only —
  // never move information into them that appears nowhere else.
  if (driftUnavailable && mrs.length === 0) {
    return (
      <>
        <div
          data-testid="mr-slot-failed"
          title="GitLab merge request lookup failed — this task's MR status is unknown"
          className={`pointer-events-none relative ${COL_MR} flex items-center gap-1.5 text-xs py-1 text-muted-foreground`}
        >
          <MrEmptyRing />
          <span className="sr-only">MR status unknown</span>
          <span aria-hidden="true" className="truncate min-w-0">
            Unknown
          </span>
        </div>
        {naDriftCells}
      </>
    );
  }

  if (mrs.length === 0 && hasMatchedMilestone) {
    return (
      <>
        <div
          data-testid="mr-slot-none"
          className={`pointer-events-none relative ${COL_MR} flex items-center gap-1.5 text-xs py-1 text-orange-600 dark:text-orange-400`}
        >
          <AlertTriangle className="size-4 flex-none" />
          <span className="sr-only">No merge request</span>
          <span aria-hidden="true" className="truncate min-w-0">
            No MR
          </span>
        </div>
        {naDriftCells}
      </>
    );
  }

  if (mrs.length === 0 && !hasMatchedMilestone) {
    return (
      <>
        <div
          data-testid="mr-slot-unavailable"
          title="No GitLab milestone matched — cannot check for MRs"
          className={`pointer-events-none relative ${COL_MR} flex items-center gap-1.5 text-xs py-1 text-muted-foreground`}
        >
          <MrEmptyRing />
          <span className="sr-only">No milestone, not checked</span>
          <span aria-hidden="true" className="truncate min-w-0">
            No MS
          </span>
        </div>
        {naDriftCells}
      </>
    );
  }

  // WR-08: the chip and the aggregate BR/MS marks describe the TASK (`allMrs`),
  // never the filter-restricted `mrs` — a task with one flagged and three clean
  // MRs must not look like a single-MR task just because a category filter is on.
  const summary = mrStatusSummary(allMrs);
  const brAgg = aggregateMark(allMrs.filter((r) => r.evaluated).map((r) => r.br));
  const msAgg = aggregateMark(allMrs.map((r) => r.ms));
  const brFlagCount = allMrs.filter((r) => r.evaluated && r.br === 'flag').length;
  const msFlagCount = allMrs.filter((r) => r.ms === 'flag').length;
  const sorted = sortPopoverMrs(allMrs);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setEverOpened(true);
      }}
    >
      {/* CR-05: the wrapper must opt OUT of hit-testing. It is a later
          positioned sibling of the row's `absolute inset-0` overlay button, so
          with `relative` alone (z-index: auto) it paints and hit-tests ABOVE
          the overlay and swallows the D-04 full-row click across the whole
          column. The chip opts back in with `pointer-events-auto relative
          z-10` (pointer-events INHERITS, so without it the chip itself would
          stop being clickable). */}
      <div className={`pointer-events-none relative ${COL_MR} flex items-center gap-1.5 text-xs`}>
        <PopoverTrigger
          render={<button type="button" />}
          data-testid="mr-status-chip"
          aria-label={summary.ariaLabel}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'pointer-events-auto relative z-10 -ml-1 inline-flex h-6 cursor-pointer items-center gap-1.5 rounded px-1 text-xs font-medium tabular-nums transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted',
            MR_TONE_TEXT[summary.tone],
          )}
        >
          <MrStatusGlyph summary={summary} />
        </PopoverTrigger>
      </div>
      {/* BR/MS on the row. One MR → its own action cell (fixes in place).
          Several MRs → a group cell that applies the action to every flagged
          MR at once. A flag that can't be auto-fixed (no release branch / no
          milestone / no GitLab config) stays a popover trigger so the user
          can see which MR and why. CR-05: ok / na stay inert. */}
      <RowDriftCell
        action="retarget"
        testId="task-drift-br"
        rows={allMrs.filter((r) => r.evaluated)}
        mark={brAgg}
        flagCount={brFlagCount}
        driftLabel="branch drift"
        fix={fix}
      />
      <RowDriftCell
        action="assign-milestone"
        testId="task-drift-ms"
        rows={allMrs}
        mark={msAgg}
        flagCount={msFlagCount}
        driftLabel="milestone drift"
        fix={fix}
      />
      {/* Lazy keepMounted: the per-MR cells hold their write state (incl. a
          sticky red failure, D-08) in component state, so once opened the
          content stays mounted while closed. Never-opened rows mount nothing. */}
      <PopoverContent
        data-testid="mr-popover"
        keepMounted={everOpened}
        align="end"
        sideOffset={6}
        className="w-[40rem] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
      >
        {/* Inner @container: container queries never style the container itself. */}
        <div className="@container">
          <div className="flex items-center gap-2 border-b bg-muted/30 p-3">
            <span className="text-sm font-semibold">Merge requests</span>
            <span className="text-xs tabular-nums text-muted-foreground">{allMrs.length}</span>
            <span
              className={cn(
                'ml-auto inline-flex items-center gap-1.5 text-xs font-medium tabular-nums',
                MR_TONE_TEXT[summary.tone],
              )}
            >
              <MrStatusGlyph summary={summary} long />
            </span>
          </div>
          <div
            aria-hidden="true"
            className="flex items-center gap-2 border-b bg-[color-mix(in_oklab,var(--color-muted)_10%,var(--color-background))] px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            <span className={MR_POP_COL_STATE}>State</span>
            <span className={MR_POP_COL_IID}>MR</span>
            <span className="min-w-0 flex-1">Title</span>
            <span className={MR_POP_COL_AUTHOR}>Author</span>
            <span className="w-[1.75rem] flex-none text-center">BR</span>
            <span className="w-[1.75rem] flex-none text-center">MS</span>
          </div>
          {/* `relative`: the cells' sr-only live regions are abspos and would
              otherwise stretch the document past this scroller. */}
          <ul className="relative max-h-[22rem] overflow-auto p-1">
            {sorted.map((r) => (
              <MrPopoverLine key={r.mr.id} row={r} fix={fix} />
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * One row BR or MS cell. Kept MOUNTED across mark changes on purpose: a fix
 * patches the cache optimistically (flag → ok) while its write is in flight,
 * and swapping components on `mark` would unmount the cell mid-write —
 * losing the spinner and, on failure, the sticky red retry state (D-08).
 * So the branch is chosen on the TASK's shape (one MR / several) and the
 * fix's readiness, never on the live mark; the cells render every mark.
 */
function RowDriftCell({
  action,
  testId,
  rows,
  mark,
  flagCount,
  driftLabel,
  fix,
}: {
  action: MrFixAction;
  testId: string;
  /** The task's MRs this column evaluates (BR: opened only; MS: all). */
  rows: DriftRow[];
  mark: DriftMark;
  flagCount: number;
  driftLabel: string;
  fix: MrFixContext;
}) {
  const { configComplete, prereqReady } = mrFixReadiness(action, fix);
  const ready = configComplete && prereqReady;
  if (!ready || rows.length === 0) {
    return (
      <DriftCellSlot interactive={mark === 'flag'}>
        {mark === 'flag' ? (
          <AggregateFlagTrigger
            testId={testId}
            label={`${flagCount} merge request${flagCount === 1 ? '' : 's'} with ${driftLabel} — show details`}
          />
        ) : (
          <DriftMarkCell mark={mark} testId={testId} />
        )}
      </DriftCellSlot>
    );
  }
  if (rows.length === 1) {
    const [only] = rows;
    const field = action === 'retarget' ? only.br : only.ms;
    return (
      <DriftCellSlot interactive={field === 'flag'}>
        <DriftActionCell
          key={`row-${action}-${only.mr.id}`}
          mr={only.mr}
          action={action}
          mark={field}
          testId={testId}
          fix={fix}
        />
      </DriftCellSlot>
    );
  }
  return (
    <DriftGroupActionCell
      action={action}
      testId={testId}
      flagged={rows
        .filter((r) => (action === 'retarget' ? r.br : r.ms) === 'flag')
        .map((r) => r.mr)}
      mark={mark}
      fix={fix}
    />
  );
}

/**
 * Group BR/MS cell for a task with several MRs: one click applies the action
 * to EVERY flagged MR (retarget all / assign milestone to all). Mirrors
 * `DriftActionCell`'s states — pending spinner, sticky red failure with retry
 * (re-fires over whichever MRs are still flagged), hover reveal — but its
 * hover glyph is ListChecks ("fix all"), not the single-MR action icon.
 */
function DriftGroupActionCell({
  action,
  testId,
  flagged,
  mark,
  fix,
}: {
  action: MrFixAction;
  testId: string;
  flagged: GitLabMR[];
  mark: DriftMark;
  fix: MrFixContext;
}) {
  const { status, errorMessage, fire, reset } = useMrGroupFix({
    action,
    mrs: flagged,
    projectId: fix.projectId,
    baseUrl: fix.baseUrl,
    token: fix.token,
    targetBranch: fix.releaseBranchName,
    milestone: fix.matchedMilestone,
  });

  // WR-08 (as in DriftActionCell): a sticky failure must not outlive the
  // problem — once every MR in the column is ok, drop the red state.
  const lastMarkRef = useRef(mark);
  if (lastMarkRef.current !== mark) {
    lastMarkRef.current = mark;
    if (mark === 'ok' && status === 'error') reset();
  }

  const rootClassName = 'flex-none w-[1.75rem] flex items-center justify-center';
  const n = flagged.length;
  const actionLabel =
    action === 'retarget'
      ? `Retarget ${n} merge request${n === 1 ? '' : 's'} to ${fix.releaseBranchName}`
      : `Assign milestone ${fix.matchedMilestone?.title} to ${n} merge request${n === 1 ? '' : 's'}`;
  const liveRegion = (
    <span role="status" aria-live="polite" className="sr-only">
      {status === 'error' ? (errorMessage ?? 'Update failed') : ''}
    </span>
  );
  const buttonClass = `${rootClassName} rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`;

  let body: React.ReactNode;
  if (status === 'pending') {
    body = (
      <button
        type="button"
        data-testid={testId}
        onClick={fire}
        aria-disabled="true"
        aria-busy="true"
        aria-label={actionLabel}
        className={buttonClass}
      >
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        {liveRegion}
      </button>
    );
  } else if (status === 'error') {
    const label = `${errorMessage ?? 'Update failed'} — click to retry`;
    body = (
      <button
        type="button"
        data-testid={testId}
        onClick={fire}
        title={label}
        aria-label={label}
        className={`${buttonClass} hover:bg-accent hover:ring-1 hover:ring-border`}
      >
        <AlertTriangle className="size-3.5 text-red-600 dark:text-red-400" />
        {liveRegion}
      </button>
    );
  } else if (mark === 'flag') {
    body = (
      <button
        type="button"
        data-testid={testId}
        onClick={fire}
        title={actionLabel}
        aria-label={actionLabel}
        className={`${buttonClass} group/fix hover:bg-accent hover:ring-1 hover:ring-border`}
      >
        <AlertTriangle className="size-3.5 text-orange-600 dark:text-orange-400 group-hover/row:hidden group-focus-visible/fix:hidden" />
        <ListChecks className="hidden size-3.5 group-hover/row:block group-focus-visible/fix:block" />
        {liveRegion}
      </button>
    );
  } else {
    body = <DriftMarkCell mark={mark} testId={testId} />;
  }
  return <DriftCellSlot interactive={mark === 'flag' || status !== 'idle'}>{body}</DriftCellSlot>;
}

/** Flagged aggregate BR/MS mark: a real button that opens the row's MR popover. */
function AggregateFlagTrigger({ testId, label }: { testId: string; label: string }) {
  return (
    <PopoverTrigger
      render={<button type="button" />}
      data-testid={testId}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      title={label}
      className="group/agg pointer-events-auto relative z-10 flex w-[1.75rem] flex-none items-center justify-center rounded hover:bg-accent hover:ring-1 hover:ring-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {/* Same hover reveal as `DriftActionCell`, but a different glyph: this
          opens the MR list (pick which MR to fix), it doesn't fix in place. */}
      <AlertTriangle className="size-3.5 text-orange-600 dark:text-orange-400 group-hover/row:hidden group-focus-visible/agg:hidden" />
      <ListChecks className="hidden size-3.5 group-hover/row:block group-focus-visible/agg:block" />
    </PopoverTrigger>
  );
}

// Popover columns. The author collapses to its avatar when the popover is
// squeezed (narrow window — it is capped at 100vw-2rem).
const MR_POP_COL_STATE = 'w-[5rem] flex-none';
const MR_POP_COL_IID = 'w-[3.5rem] flex-none';
const MR_POP_COL_AUTHOR = 'w-[11rem] flex-none min-w-0 @max-[34rem]:w-[22px]';

const MR_KIND_ORDER_STROKE: Record<MrStateKind, string> = {
  merged: 'stroke-green-500',
  open: 'stroke-blue-500',
  draft: 'stroke-muted-foreground/60',
  closed: 'stroke-muted-foreground/30',
};

const MR_KIND_GLYPH: Record<MrStateKind, LucideIcon> = {
  merged: Check,
  open: GitPullRequest,
  draft: GitPullRequestDraft,
  closed: GitPullRequestClosed,
};

/** Sentence case, like the app's status pills ("In Progress"). */
const MR_KIND_WORD: Record<MrStateKind, string> = {
  merged: 'Merged',
  open: 'Open',
  draft: 'Draft',
  closed: 'Closed',
};

const MR_KIND_TONE: Record<MrStateKind, ChipTone> = {
  merged: 'green',
  open: 'blue',
  draft: 'muted',
  closed: 'muted',
};

/** One state's glyph (a check when merged) + its word — the bare form of the MR status style. */
function MrKindGlyph({ kind }: { kind: MrStateKind }) {
  const Icon = MR_KIND_GLYPH[kind];
  return (
    <>
      <Icon aria-hidden="true" data-mr-state={kind} className="size-4 flex-none" />
      <span data-testid="mr-status-label">{MR_KIND_WORD[kind]}</span>
    </>
  );
}

/**
 * A single MR's state in the page's MR status style (uncovered-MRs table,
 * popover lines): coloured glyph + word, no pill.
 */
function MrStateGlyph({ mr, testId }: { mr: GitLabMR; testId: string }) {
  const kind = mrStateKind(mr);
  return (
    <span
      data-testid={testId}
      className={cn(
        'pointer-events-none inline-flex items-center gap-1.5 text-xs font-medium',
        MR_TONE_TEXT[MR_KIND_TONE[kind]],
      )}
    >
      <MrKindGlyph kind={kind} />
    </span>
  );
}

/**
 * The MR status visual. A mix of live states → the segmented ring + merged/live
 * ("1/2"; `long` adds "merged"). Every MR in one state → no ring (it would be
 * a single-colour circle): just that state's glyph — a check when all merged
 * — and its word.
 */
function MrStatusGlyph({
  summary,
  long = false,
}: {
  summary: ReturnType<typeof mrStatusSummary>;
  long?: boolean;
}) {
  if (summary.ringGroups.length > 1) {
    return (
      <>
        <MrStatusRing groups={summary.ringGroups} />
        <span data-testid="mr-status-label">
          {long ? `${summary.fraction} merged` : summary.fraction}
        </span>
      </>
    );
  }
  return <MrKindGlyph kind={summary.ringGroups[0]?.kind ?? 'closed'} />;
}

/** Dashed empty ring — the "no data" stand-in for `MrStatusRing` in the slot states. */
function MrEmptyRing() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 flex-none">
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        strokeWidth="1.5"
        strokeDasharray="2.5 2"
        className="stroke-muted-foreground/50"
      />
    </svg>
  );
}

/**
 * Tiny segmented ring — one arc per state, sized by its count (merged, open,
 * draft, closed; same order and colours as the release MR donut). Fixed size
 * whatever the MR count, so the row column never stretches. Arcs are
 * separated by a small gap when there is more than one.
 */
function MrStatusRing({ groups }: { groups: Array<{ kind: MrStateKind; count: number }> }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  const total = groups.reduce((n, g) => n + g.count, 0);
  const gap = groups.length > 1 ? 1.5 : 0;
  let offset = 0;
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 flex-none -rotate-90">
      <circle cx="8" cy="8" r={r} fill="none" strokeWidth="3" className="stroke-muted" />
      {groups.map(({ kind, count }) => {
        const len = (count / total) * c;
        const dash = Math.max(len - gap, 0.5);
        const el = (
          <circle
            key={kind}
            data-mr-group={kind}
            data-count={count}
            cx="8"
            cy="8"
            r={r}
            fill="none"
            strokeWidth="3"
            className={MR_KIND_ORDER_STROKE[kind]}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

/**
 * MR number ascending — and nothing else. A stable, state-independent order
 * so lines never jump while the user works through them (a fix flips a
 * flag, a merge flips a state; neither may reorder the list).
 */
function sortPopoverMrs(rows: DriftRow[]): DriftRow[] {
  return [...rows].sort((a, b) => a.mr.iid - b.mr.iid);
}

/**
 * One MR in the task row's popover. `group/row` is required: the portalled
 * content has no row ancestor, and `DriftActionCell` reveals its action icon
 * via `group-hover/row`. Cells are keyed by `mr.id` (CR-07) so a sticky failure
 * and the `fire()` lock stay on the MR whose write failed.
 */
function MrPopoverLine({ row, fix }: { row: DriftRow; fix: MrFixContext }) {
  const { mr } = row;
  // The task key is already on the row this popover belongs to — drop the
  // leading "[PROJ-1] " prefix, same as the uncovered-MRs table does.
  const displayTitle = stripLeadingTicketKeys(mr.title, row.taskKeys);
  return (
    <li
      data-testid="mr-popover-line"
      className="group/row flex h-9 items-center gap-2 rounded px-2 text-sm hover:bg-muted/50"
    >
      <span className={`${MR_POP_COL_STATE} flex items-center`}>
        <MrStateGlyph mr={mr} testId="mr-popover-state" />
      </span>
      <span className={MR_POP_COL_IID}>
        <LinkContextMenu href={mr.web_url}>
          <button
            type="button"
            onClick={() => openExternal(mr.web_url)}
            title={`Open !${mr.iid} in GitLab — ${channelsTitle(row.channels)}`}
            className="font-mono text-xs text-primary hover:underline"
          >
            !{mr.iid}
          </button>
        </LinkContextMenu>
      </span>
      <span className="min-w-0 flex-1 truncate" title={mr.title}>
        {displayTitle}
      </span>
      <span className={`${MR_POP_COL_AUTHOR} flex items-center gap-1.5`} title={mr.author.name}>
        <CachedAvatar url={mr.author.avatar_url || null} name={mr.author.name} size={22} />
        <span className="min-w-0 truncate text-xs @max-[34rem]:sr-only">{mr.author.name}</span>
      </span>
      {/* 261103-fqd: BR is gated on `evaluated` (opened only — a merged MR
          cannot be retargeted); MS is gated independently (opened + merged). */}
      {row.evaluated ? (
        <DriftActionCell
          key={`br-${mr.id}`}
          mr={mr}
          action="retarget"
          mark={row.br}
          testId="drift-br"
          fix={fix}
        />
      ) : (
        <DriftMarkCell mark="na" testId="drift-br" />
      )}
      <DriftActionCell
        key={`ms-${mr.id}`}
        mr={mr}
        action="assign-milestone"
        mark={row.ms}
        testId="drift-ms"
        fix={fix}
      />
    </li>
  );
}

function TaskRow({
  issue,
  mrs,
  allMrs,
  isLoadingDrift,
  driftUnavailable,
  hasMatchedMilestone,
  fix,
  onOpenIssue,
  onOpenIssueFull,
  onSeedBreadcrumb,
}: {
  issue: JiraIssue;
  mrs: DriftRow[];
  allMrs: DriftRow[];
  isLoadingDrift: boolean;
  driftUnavailable: boolean;
  hasMatchedMilestone: boolean;
  fix: MrFixContext;
  onOpenIssue: (key: string) => void;
  onOpenIssueFull: (key: string) => void;
  onSeedBreadcrumb: () => void;
}) {
  const isPeeked = useIsPeeked(issue.key);
  return (
    <div
      data-testid="task-row"
      data-peeked={isPeeked ? 'true' : undefined}
      className={cn(
        // pl-2 keeps the first cell clear of the 3px inset peek bar (the icon cell
        // drops at narrow widths, which would otherwise put the key under it).
        'group/row relative flex items-center gap-2 text-sm pl-2 py-1.5 density-compact:py-1 density-comfortable:py-2.5 hover:bg-muted/40',
        isPeeked && PEEKED_ROW_CLASS,
      )}
    >
      <button
        type="button"
        className="absolute inset-0 rounded cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Open ${issue.key} ${issue.fields.summary}`}
        data-testid="task-row-overlay"
        onClick={() => {
          onSeedBreadcrumb();
          onOpenIssue(issue.key);
        }}
      />
      <span
        className={`pointer-events-none relative ${COL_ICON} flex items-center justify-center`}
        style={{ width: 18, height: 18 }}
        aria-hidden={!issue.fields.issuetype}
      >
        {issue.fields.issuetype?.name && <IssueTypeIcon typeName={issue.fields.issuetype.name} />}
      </span>
      <button
        type="button"
        onClick={() => {
          onSeedBreadcrumb();
          onOpenIssueFull(issue.key);
        }}
        className={`relative z-10 ${COL_KEY} font-mono text-xs text-primary hover:underline text-left`}
      >
        {issue.key}
      </button>
      <span className={`pointer-events-none relative ${COL_SUMMARY} line-clamp-1`}>
        {issue.fields.summary}
      </span>
      <TaskMrCell
        mrs={mrs}
        allMrs={allMrs}
        isLoadingDrift={isLoadingDrift}
        driftUnavailable={driftUnavailable}
        hasMatchedMilestone={hasMatchedMilestone}
        fix={fix}
      />
      <div className={`pointer-events-none relative ${COL_STATE} flex items-center`}>
        <span className={statusPillClass(issue.fields.status.statusCategory?.key)}>
          {issue.fields.status.name}
        </span>
      </div>
      <span
        className={`pointer-events-none relative ${COL_ASSIGNEE} inline-flex items-center gap-1.5 text-xs`}
      >
        {issue.fields.assignee ? (
          <>
            <CachedAvatar
              url={issue.fields.assignee.avatarUrls['48x48']}
              name={issue.fields.assignee.displayName}
              size={20}
            />
            <span className="line-clamp-1 @max-[860px]:sr-only">
              {issue.fields.assignee.displayName}
            </span>
          </>
        ) : (
          <>
            <CachedAvatar url={null} name="Unassigned" size={20} />
            <span className="text-muted-foreground @max-[860px]:sr-only">Unassigned</span>
          </>
        )}
      </span>
    </div>
  );
}

export function UnifiedTaskTable({
  versionName,
  hasReleaseDate,
  isLoadingIssues,
  isLoadingDrift,
  driftUnavailable,
  hasMatchedMilestone,
  milestoneLookupFailed,
  primaryRows,
  secondaryRows,
  secondaryKeyTypes = EMPTY_KEY_TYPES,
  flaggedMrCount,
  brFlaggedCount,
  msFlaggedCount,
  onOpenIssue,
  onOpenIssueFull,
  onSeedBreadcrumb,
  onNavigateToIssueFromMR,
  fix,
  jiraFix,
  labelFilter = null,
  onClearLabelFilter,
  issueFilterState,
}: UnifiedTaskTableProps) {
  const notCovered = useNotCoveredFixes({ fix, jiraFix });
  const [secondaryExpanded, setSecondaryExpanded] = useState(false);
  // UAT-91.1-B: local category filter driven by the two work-queue badges.
  // Applied at render time (not to props) — see T-91.1-18 threat disposition.
  const [activeFilter, setActiveFilter] = useState<'br' | 'ms' | null>(null);

  // 261102-h1i: issue-level search/filters + column sort (same controls as the
  // AIO Defects tab). Local state — the page keys this component by versionId.
  const [query, setQuery] = useState('');
  const ownIssueFilters = useTaskIssueFilters();
  const f = issueFilterState ?? ownIssueFilters;
  const { statuses: statusFilter, setStatuses: setStatusFilter } = f;
  const { types: typeFilter, setTypes: setTypeFilter } = f;
  const { assignees: assigneeFilter, setAssignees: setAssigneeFilter } = f;
  const [sort, setSort] = useState<TaskSort>({ key: null, dir: 'asc' });

  const filterOptions = buildTaskFilterOptions(primaryRows);
  const issueFilters = {
    query,
    statuses: statusFilter,
    types: typeFilter,
    assignees: assigneeFilter,
  };
  const issueFiltersActive =
    query.trim() !== '' || statusFilter.size > 0 || typeFilter.size > 0 || assigneeFilter.size > 0;
  const issueRows = sortTaskRows(
    primaryRows.filter((r) => matchesTaskFilters(r.issue, issueFilters)),
    sort.key,
    sort.dir,
  );

  const formatAssignee = (v: string) => (v === UNASSIGNED_FILTER ? UNASSIGNED_LABEL : v);
  const dropFrom = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, v: string) => () =>
    setter((prev) => {
      const n = new Set(prev);
      n.delete(v);
      return n;
    });
  const activeChips: { dimension: string; value: string; label: string; remove: () => void }[] = [
    ...[...statusFilter].map((v) => ({
      dimension: 'Status',
      value: v,
      label: v,
      remove: dropFrom(setStatusFilter, v),
    })),
    ...[...typeFilter].map((v) => ({
      dimension: 'Type',
      value: v,
      label: v,
      remove: dropFrom(setTypeFilter, v),
    })),
    ...[...assigneeFilter].map((v) => ({
      dimension: 'Assignee',
      value: v,
      label: formatAssignee(v),
      remove: dropFrom(setAssigneeFilter, v),
    })),
  ];
  const clearIssueFilters = () => {
    setQuery('');
    setStatusFilter(new Set());
    setTypeFilter(new Set());
    setAssigneeFilter(new Set());
  };

  const driftPredicate =
    activeFilter === 'br'
      ? (r: DriftRow) => r.br === 'flag'
      : activeFilter === 'ms'
        ? (r: DriftRow) => r.ms === 'flag'
        : null;
  const labelPredicate = labelFilter
    ? labelFilter === UNLABELED_FILTER
      ? (r: DriftRow) => r.mr.labels.length === 0
      : (r: DriftRow) => r.mr.labels.some((l) => l.name === labelFilter)
    : null;
  // Label and drift filters compose (AND).
  const filterPredicate =
    driftPredicate || labelPredicate
      ? (r: DriftRow) => (driftPredicate?.(r) ?? true) && (labelPredicate?.(r) ?? true)
      : null;

  // WR-08: `allMrs` rides along unfiltered so the MR chip and popover keep describing
  // the TASK rather than the current view — filtering it too made MRs appear
  // to vanish from a task the moment a filter was applied.
  const filteredPrimaryRows = filterPredicate
    ? issueRows
        .map(({ issue, mrs }) => ({ issue, mrs: mrs.filter(filterPredicate), allMrs: mrs }))
        .filter(({ mrs }) => mrs.length > 0)
    : issueRows.map(({ issue, mrs }) => ({ issue, mrs, allMrs: mrs }));

  const filteredSecondaryRows = filterPredicate
    ? secondaryRows.filter(filterPredicate)
    : secondaryRows;

  // The count pill and the slice both come from the filtered array.
  const shownSecondaryRows = secondaryExpanded
    ? filteredSecondaryRows
    : filteredSecondaryRows.slice(0, CALLOUT_VISIBLE_ROWS);
  const hiddenSecondaryCount = filteredSecondaryRows.length - CALLOUT_VISIBLE_ROWS;
  // The Link-task picker always offers every release issue, regardless of table filters.
  const releaseIssues = primaryRows.map((r) => r.issue);

  const clearFilter = () => {
    setActiveFilter(null);
    onClearLabelFilter?.();
  };

  return (
    <section className="@container">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mb-2">
        {/* GraphSlot-style heading: muted icon + title, like the graphs above. */}
        <ListTodo aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Issues</h3>
        {!isLoadingIssues && primaryRows.length > 0 && (
          <span
            data-testid="issues-count"
            className="text-xs font-normal tabular-nums text-muted-foreground"
          >
            {primaryRows.length}
          </span>
        )}
        {!isLoadingDrift && !isLoadingIssues && (brFlaggedCount > 0 || msFlaggedCount > 0) && (
          <div
            className="ml-1.5 flex items-center gap-1.5"
            title={`${flaggedMrCount} merge requests need attention`}
          >
            {brFlaggedCount > 0 && (
              <button
                type="button"
                data-testid="flagged-br-badge"
                aria-pressed={activeFilter === 'br'}
                aria-label={`Show ${brFlaggedCount} merge requests targeting the wrong branch`}
                title={`Show ${brFlaggedCount} merge requests targeting the wrong branch`}
                onClick={() => setActiveFilter((prev) => (prev === 'br' ? null : 'br'))}
              >
                <Badge
                  variant="outline"
                  className="text-xs tabular-nums gap-1 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700"
                >
                  <AlertTriangle className="size-3" />
                  {brFlaggedCount}
                  <span className="@max-[520px]:hidden"> wrong branch</span>
                </Badge>
              </button>
            )}
            {msFlaggedCount > 0 && (
              <button
                type="button"
                data-testid="flagged-ms-badge"
                aria-pressed={activeFilter === 'ms'}
                aria-label={`Show ${msFlaggedCount} merge requests with no release milestone`}
                title={`Show ${msFlaggedCount} merge requests with no release milestone`}
                onClick={() => setActiveFilter((prev) => (prev === 'ms' ? null : 'ms'))}
              >
                <Badge
                  variant="outline"
                  className="text-xs tabular-nums gap-1 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700"
                >
                  <AlertTriangle className="size-3" />
                  {msFlaggedCount}
                  <span className="@max-[520px]:hidden"> no milestone</span>
                </Badge>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Degraded banner (D-16) — one banner, merges the two prior sources.
          CR-06: a FAILED milestone lookup takes precedence over the
          "no milestone matched" copy and is rendered neutrally: the check did
          not happen, so the page must not assert an absence, and "set a
          release date" would be a remedy for a problem nobody diagnosed. */}
      {!hasMatchedMilestone &&
        (milestoneLookupFailed ? (
          <div
            data-testid="drift-degraded-banner"
            className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 mb-4"
          >
            <AlertTriangle className="size-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              Couldn't reach GitLab to check for a milestone — MR status is unknown for this
              release.
            </p>
          </div>
        ) : (
          <div
            data-testid="drift-degraded-banner"
            className="flex items-center gap-2 rounded-md border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 px-3 py-2 mb-4"
          >
            <AlertTriangle className="size-4 text-orange-600 dark:text-orange-400 shrink-0" />
            <p className="text-xs text-orange-700 dark:text-orange-300">
              No GitLab milestone matched — MR linking is unavailable.
              {!hasReleaseDate && ' Set a release date to enable milestone matching.'}
            </p>
          </div>
        ))}

      {/* WR-10: `driftUnavailable` is a single OR across four independent
          inputs, but `TaskMrCell` consumes it ONLY under `mrs.length === 0`.
          When Channel C fails while Channel A succeeds, a task whose
          A-discovered MR is present renders as a fully confident row — no
          degradation signal at all — while any MR only Channel C would have
          found is silently missing from it and from the MR chip. The
          honest scope for a partial failure is the page, not the row, so the
          notice is rendered here regardless of any task's MR count. Suppressed
          only when the banner above is already reporting the same failure. */}
      {driftUnavailable && !(milestoneLookupFailed && !hasMatchedMilestone) && (
        <div
          data-testid="drift-partial-banner"
          className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 mb-4"
        >
          <AlertTriangle className="size-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Some GitLab merge-request lookups failed — this list may be incomplete, and a task
            showing no merge request may simply not have been checked.
          </p>
        </div>
      )}

      {/* Filter escape hatch (UAT-91.1-B) — needed because a successful fix
          dropping a count to zero hides its own badge. */}
      {(activeFilter || labelFilter) && (
        <div
          data-testid="filter-active-notice"
          className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 mb-4 text-xs"
        >
          <span>
            {[
              activeFilter === 'br'
                ? 'a wrong target branch'
                : activeFilter === 'ms'
                  ? 'no release milestone'
                  : null,
              labelFilter
                ? labelFilter === UNLABELED_FILTER
                  ? 'no label'
                  : `the label "${labelFilter}"`
                : null,
            ]
              .filter(Boolean)
              .reduce<string>((acc, part) => (acc ? `${acc} and ${part}` : `${part}`), '')
              .replace(/^/, 'Showing only merge requests with ')}
          </span>
          <button
            type="button"
            data-testid="filter-clear"
            className="text-xs font-medium underline underline-offset-2"
            onClick={clearFilter}
          >
            Clear filter
          </button>
        </div>
      )}

      {!isLoadingIssues && primaryRows.length > 0 && (
        <div
          role="toolbar"
          aria-label="Issue filters"
          data-testid="task-filter-toolbar"
          className="flex flex-wrap items-center gap-2 py-2 density-compact:py-1 density-comfortable:py-3 mb-2"
        >
          <div className="relative w-64 max-w-full">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search issues…"
              aria-label="Search issues"
              className="w-full rounded-md border bg-background py-1 pl-8 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <FilterPopover
            dimension="Status"
            testId="task-filter-status"
            options={filterOptions.statuses}
            selected={statusFilter}
            setSelected={setStatusFilter}
          />
          <FilterPopover
            dimension="Type"
            testId="task-filter-type"
            options={filterOptions.types}
            selected={typeFilter}
            setSelected={setTypeFilter}
          />
          <FilterPopover
            dimension="Assignee"
            testId="task-filter-assignee"
            options={filterOptions.assignees}
            selected={assigneeFilter}
            setSelected={setAssigneeFilter}
            formatOption={formatAssignee}
          />

          {activeChips.map((chip) => (
            <span
              key={`${chip.dimension}-${chip.value}`}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {chip.dimension}: {chip.label}
              <button
                type="button"
                className="hover:text-primary/60 shrink-0"
                data-testid={`task-filter-chip-${chip.dimension.toLowerCase()}-${chip.value}`}
                onClick={chip.remove}
                aria-label={`Remove filter ${chip.dimension}: ${chip.label}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {(issueFiltersActive || query !== '') && (
            <button
              type="button"
              data-testid="task-filter-clear-all"
              className="ml-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={clearIssueFilters}
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {isLoadingIssues ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="size-3.5 animate-spin" />
          Loading issues...
        </div>
      ) : issueFiltersActive && issueRows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No issues match the filters{' '}
          <button
            type="button"
            data-testid="task-filter-clear"
            className="text-xs font-medium underline underline-offset-2"
            onClick={clearIssueFilters}
          >
            Clear filters
          </button>
        </p>
      ) : filteredPrimaryRows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          {activeFilter || labelFilter
            ? 'No merge requests match this filter'
            : 'No issues in this fix version'}
        </p>
      ) : (
        <>
          <ColumnHeaderStrip sort={sort} onSort={(key) => setSort((prev) => nextSort(prev, key))} />
          <div data-testid="task-list">
            {filteredPrimaryRows.map(({ issue, mrs, allMrs }) => (
              <div key={issue.id} data-testid="task-group" className="border-b border-border/50">
                <TaskRow
                  issue={issue}
                  mrs={mrs}
                  allMrs={allMrs}
                  isLoadingDrift={isLoadingDrift}
                  driftUnavailable={driftUnavailable}
                  hasMatchedMilestone={hasMatchedMilestone}
                  fix={fix}
                  onOpenIssue={onOpenIssue}
                  onOpenIssueFull={onOpenIssueFull}
                  onSeedBreadcrumb={onSeedBreadcrumb}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {!isLoadingIssues && filteredSecondaryRows.length > 0 && (
        <div data-testid="secondary-section" className={`mt-4 ${CALLOUT_SECTION_CLASS}`}>
          <h3 className={CALLOUT_TITLE_CLASS}>
            <AlertTriangle className={CALLOUT_ICON_CLASS} />
            Not covered by tasks above
            <span className={CALLOUT_COUNT_CLASS} data-testid="secondary-count">
              {filteredSecondaryRows.length}
            </span>
            <span className={CALLOUT_HINT_CLASS}>
              Merge requests whose task isn&apos;t in this version, or that have no task.
            </span>
          </h3>
          <SecondaryHeaderStrip />
          <div className={CALLOUT_LIST_CLASS}>
            {shownSecondaryRows.map((row) => {
              const keys = row.taskKeys;
              const leadType = keys.length > 0 ? secondaryKeyTypes[keys[0]] : undefined;
              const iconCell = (
                <span
                  data-testid="secondary-type-icon"
                  className={`${COL_ICON} ${COL_SECONDARY_KEY} flex items-center justify-center`}
                  style={{ width: 18, height: 18 }}
                  aria-hidden="true"
                >
                  {leadType && <IssueTypeIcon typeName={leadType} />}
                </span>
              );
              let keyCell: React.ReactNode;
              // The leading key is a link, matching the primary table's key cell:
              // both open the issue full-page via the breadcrumb-seeding handler.
              // The `+N` suffix stays inert — it is a count, not a single target.
              const keyLink = (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToIssueFromMR(keys[0]);
                  }}
                  className="hover:underline"
                >
                  {keys[0]}
                </button>
              );
              if (row.taskReason === 'not-in-fix-version') {
                const suffix = keys.length > 1 ? 'are' : 'is';
                keyCell = (
                  <span
                    data-testid="secondary-key-flagged"
                    className={`${COL_KEY} ${COL_SECONDARY_KEY} font-mono text-xs text-orange-600 dark:text-orange-400 inline-flex items-center gap-1 overflow-hidden`}
                    title={`${keys.join(', ')} ${suffix} not in fix version ${versionName}`}
                  >
                    {keyLink}
                    {keys.length > 1 ? ` +${keys.length - 1}` : ''}
                  </span>
                );
              } else if (keys.length === 0) {
                keyCell = (
                  <span
                    data-testid="secondary-key-none"
                    className={`${COL_KEY} ${COL_SECONDARY_KEY} font-mono text-xs text-muted-foreground`}
                  >
                    &mdash;
                  </span>
                );
              } else {
                // Keys present but the row carries no evaluated out-of-scope verdict — now only
                // the locked `task: 'na'` case (closed rows are filtered out upstream in
                // buildTaskMrAttachment; merged rows carry a taskReason since 261103-eu3).
                // Never assert a drift the row marks as not evaluated (T-91.1-14).
                keyCell = (
                  <span
                    data-testid="secondary-key-unevaluated"
                    className={`${COL_KEY} ${COL_SECONDARY_KEY} font-mono text-xs text-muted-foreground inline-flex items-center gap-1 overflow-hidden`}
                    title={`${keys.join(', ')} — not evaluated (MR is ${row.mr.state})`}
                  >
                    {keyLink}
                    {keys.length > 1 ? ` +${keys.length - 1}` : ''}
                  </span>
                );
              }
              keyCell = (
                <>
                  {iconCell}
                  {keyCell}
                </>
              );
              const reason = secondaryReason(row);
              // Epics can't carry a fix version, so they are never offered to Apply.
              const applicableKeys = keys.filter((k) => !isEpicTypeName(secondaryKeyTypes[k]));
              let actionCell: React.ReactNode = null;
              let fixTarget: { text: string; title: string; note?: boolean } | undefined;
              if (reason === 'not-in-fix-version' && isEpicOnlyRow(row, secondaryKeyTypes)) {
                fixTarget = {
                  text: "Epics can't have a fix version",
                  title: epicOnlyTitle(keys),
                  note: true,
                };
              } else if (reason === 'not-in-fix-version' && jiraFix) {
                fixTarget = {
                  text: `add to ${versionName}`,
                  title: `Add fix version ${versionName} to ${applicableKeys.join(', ')} (other fix versions are kept)`,
                };
                actionCell = (
                  <ApplyFixVersionAction
                    keys={applicableKeys}
                    versionName={versionName}
                    pendingKey={notCovered.pending[row.mr.id]}
                    onApply={(k) => notCovered.applyFixVersion(row.mr.id, k)}
                  />
                );
              } else if (reason === 'no-linked-task') {
                fixTarget = {
                  text: 'link a release task',
                  title: 'Pick a task from this release; its key is prefixed to the MR title',
                };
                actionCell = (
                  <LinkTaskAction
                    issues={releaseIssues}
                    pending={notCovered.pending[row.mr.id] !== undefined}
                    onPick={(k) => notCovered.linkTask(row, k)}
                  />
                );
              }
              return (
                <MrSubLine
                  key={row.mr.id}
                  row={row}
                  onNavigateToIssueFromMR={onNavigateToIssueFromMR}
                  fix={fix}
                  keyCell={keyCell}
                  reasonCell={<SecondaryReasonPill row={row} versionName={versionName} />}
                  actionCell={actionCell}
                  fixTarget={fixTarget}
                  error={notCovered.errors[row.mr.id]}
                />
              );
            })}
          </div>
          {hiddenSecondaryCount > 0 && (
            <button
              type="button"
              data-testid="secondary-show-all"
              aria-expanded={secondaryExpanded}
              onClick={() => setSecondaryExpanded((v) => !v)}
              className={CALLOUT_SHOW_ALL_CLASS}
            >
              {secondaryExpanded ? 'Show less' : `Show all ${filteredSecondaryRows.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
