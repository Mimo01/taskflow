import {
  AlertTriangle,
  Check,
  GitBranch,
  GitMerge,
  Loader2,
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
import { FilterPopover, SortableHeader } from '@/components/ui/table-filter-sort';
import { UNASSIGNED_FILTER, UNASSIGNED_LABEL } from '@/lib/assignee-filter';
import { openExternal } from '@/lib/openExternal';
import { PEEKED_ROW_CLASS } from '@/lib/peek-highlight';
import { statusPillClass } from '@/lib/statusStyles';
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
import { type MrFixAction, useMrFixMutation } from './useMrFixMutation';
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
// a secondary MR sub-line is Reason / Key / Merge request / Author / Reviewers /
// State / BR / MS (261102-fkr). Sharing one strip across both put three
// column headings — Assignee, Status, MR — over the middle of the MR title
// text. Do not "re-unify" the strips without also restoring those cells.
// Keys must never wrap — a Jira key broken at its dash reads as two keys. Fixed
// width + nowrap; widened from 72px so the common PROJ-1234 shape fits without
// spilling into the summary column.
const COL_ICON = 'flex-none w-[1.125rem] @max-[640px]:hidden';
const COL_KEY = 'flex-none w-[5.5rem] whitespace-nowrap';
const COL_SUMMARY = 'flex-1 min-w-0';
const COL_PERSON = 'flex-none w-[8.75rem] min-w-0 @max-[860px]:w-9';
const COL_STATE = 'flex-none w-[6rem] @max-[400px]:hidden';
const COL_MR = 'flex-none w-[11.875rem] min-w-0 @max-[860px]:w-[5.5rem] @max-[520px]:hidden';
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
const COL_MR_STATE = 'flex-none w-[4rem] flex items-center @max-[400px]:hidden';

function mrStateBadgeClass(state: GitLabMR['state']): string {
  return state === 'merged'
    ? 'border-green-500 text-green-600'
    : state === 'opened'
      ? 'border-blue-500 text-blue-600'
      : 'border-gray-400 text-gray-500';
}

function mrStateLabel(mr: GitLabMR): string {
  if (mr.state === 'opened') return mr.draft ? 'Draft' : 'Open';
  if (mr.state === 'merged') return 'Merged';
  if (mr.state === 'closed') return 'Closed';
  return 'Locked';
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
  const isDraft = mr.state === 'opened' && mr.draft;
  return (
    <span className={COL_MR_STATE}>
      <Badge
        variant="outline"
        data-testid="secondary-mr-state"
        className={`pointer-events-none text-[10px] ${isDraft ? 'border-dashed border-gray-400 text-gray-500' : mrStateBadgeClass(mr.state)}`}
      >
        {mrStateLabel(mr)}
      </Badge>
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
  // consolidated task row this cell renders at a fixed position whose `mr`
  // prop is `selectDisplayMr(mrs)` — a value a filter toggle or a cache patch
  // can swap underneath it. `mark` alone does not notice (two MRs both flagged
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
        className={COL_PERSON}
        {...headerProps}
      />
      <SortableHeader sortKey="status" label="Status" className={COL_STATE} {...headerProps} />
      <span className={COL_MR}>MR</span>
      <span
        className="flex-none w-[1.75rem] text-center"
        title="Target branch matches release branch"
      >
        BR
      </span>
      <span className="flex-none w-[1.75rem] text-center" title="Release milestone assigned">
        MS
      </span>
      <span className={CALLOUT_FIX_ACTION_COL} aria-hidden="true" />
    </div>
  );
}

/**
 * The SECONDARY (uncovered-MRs) table's header strip (WR-06).
 *
 * A secondary row is an `MrSubLine`: `pl-6` + Key + the MR title + BR + MS.
 * It renders no Assignee, Status or MR cell, so labelling those columns —
 * which the shared `ColumnHeaderStrip` did — put three headings over the
 * middle of the title text. The `pl-6` here matches the row's own indent so
 * the "Key" label sits over the key cell rather than 16px to its left.
 */
function SecondaryHeaderStrip() {
  return (
    <div data-testid="secondary-header" className={CALLOUT_HEADER_CLASS}>
      <span className={COL_SECONDARY_STATE}>
        <span className="@max-[520px]:sr-only">State</span>
      </span>
      <span className={`${COL_KEY} ${COL_SECONDARY_KEY}`}>Key</span>
      <span className={COL_SECONDARY_SUMMARY}>Merge request</span>
      <span className={COL_PERSON}>Author</span>
      <span className={COL_REVIEWERS}>Reviewers</span>
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
  fixTarget?: { text: string; title: string };
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

  const rowEl = (
    <div
      data-testid="drift-row"
      className={
        reasonCell
          ? `group/row ${CALLOUT_ROW_CLASS} ${isFlagged ? 'text-foreground' : 'text-muted-foreground'}`
          : `group/row pl-6 flex items-center gap-2 text-xs py-1 density-compact:py-0.5 density-comfortable:py-2 ${isFlagged ? 'text-foreground' : 'text-muted-foreground'}`
      }
    >
      {reasonCell}
      {keyCell ?? <span className={COL_KEY}>{iidButton}</span>}
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
      {reasonCell && (
        <>
          <MrAuthorCell mr={mr} />
          <MrReviewersCell mr={mr} />
          <MrStatePill mr={mr} />
        </>
      )}
      {row.evaluated ? (
        <>
          <DriftActionCell mr={mr} action="retarget" mark={row.br} testId="drift-br" fix={fix} />
          <DriftActionCell
            mr={mr}
            action="assign-milestone"
            mark={row.ms}
            testId="drift-ms"
            fix={fix}
          />
        </>
      ) : (
        <>
          <DriftMarkCell mark="na" testId="drift-br" />
          <DriftMarkCell mark="na" testId="drift-ms" />
        </>
      )}
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
                <span aria-hidden="true">→ </span>
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
 * Choose which MR to display on a consolidated task row when a task carries
 * 2+ merge requests (developer's explicit choice, live UAT checkpoint,
 * 2026-08-12): "99% of the time there is 1 MR for 1 task so the edge case of
 * having multiple is not worth solving. I want it all consolidated into one
 * single line for each task like it was before."
 *
 * Precedence: a flagged MR (br or ms) wins; failing that, an EVALUATED one
 * (WR-09); ties within the winning pool are broken by highest `iid`.
 *
 * "Evaluated" here means BR/MS evaluated (`row.evaluated`, opened MRs only).
 * Merged/closed MRs keep `evaluated: false` (merged MRs get a TASK reason
 * since 261103-eu3, which does not affect this selection).
 *
 * The evaluated tier is not a nicety. Merged/closed MRs are not evaluated, and
 * on a release branch that has already begun landing work they carry the
 * HIGHEST iids — so a plain highest-iid rule surfaced the merged `!42` over
 * the clean open `!17` and reported the task as "not evaluated" (— / —) while
 * its actual live MR was correctly targeted and milestoned. Prefer the MR the
 * drift columns can actually say something about.
 *
 * No MR is dropped from the underlying data — the rest surface behind the
 * `+N` marker (`mr-extra-count`).
 *
 * When a category filter (UAT-91.1-B) is active, the caller
 * (`UnifiedTaskTable`'s `filteredPrimaryRows`) has already restricted `mrs`
 * to the matching subset before this function ever runs, so the displayed
 * MR automatically prefers a filter match — no separate branch needed here.
 *
 * @param mrs - the task's attached MRs (already filter-restricted by the caller, if a filter is active)
 * @returns the MR to render on the row, or null when the task has no MRs
 */
export function selectDisplayMr(mrs: DriftRow[]): DriftRow | null {
  if (mrs.length === 0) return null;
  const flagged = mrs.filter((r) => r.br === 'flag' || r.ms === 'flag');
  const evaluated = mrs.filter((r) => r.evaluated);
  const pool = flagged.length > 0 ? flagged : evaluated.length > 0 ? evaluated : mrs;
  return pool.reduce((best, r) => (r.mr.iid > best.mr.iid ? r : best));
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
 * The task row's MR cell plus its BR/MS drift cells, consolidated onto one
 * line (developer's explicit choice, live UAT checkpoint — see
 * `selectDisplayMr`). Replaces the old per-MR sub-line list entirely in the
 * primary table; `MrSubLine` survives unchanged for the secondary
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
   * active filter (deliberately — the displayed MR must match the filter), so
   * counting the `+N` others from it under-reports: a task with one flagged
   * and three clean MRs would show `+3` unfiltered and no marker at all under
   * the filter, as if three MRs had vanished. The marker describes the task,
   * not the current view, so it is always computed from this list.
   */
  allMrs: DriftRow[];
  isLoadingDrift: boolean;
  driftUnavailable: boolean;
  hasMatchedMilestone: boolean;
  fix: MrFixContext;
}) {
  if (isLoadingDrift) {
    return (
      <>
        <div
          data-testid="mr-slot-pending"
          className={`pointer-events-none relative ${COL_MR} flex items-center gap-1.5 text-xs py-1 text-muted-foreground`}
        >
          <Loader2 className="size-3.5 animate-spin" />
          <span className="@max-[860px]:sr-only">loading…</span>
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
          <span className="truncate min-w-0 @max-[860px]:sr-only">— MR status unknown</span>
          <span aria-hidden="true" className="hidden truncate min-w-0 @max-[860px]:inline">
            — unknown
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
          <AlertTriangle className="size-3.5 flex-none" />
          <span className="truncate min-w-0 @max-[860px]:sr-only">No merge request</span>
          <span aria-hidden="true" className="hidden truncate min-w-0 @max-[860px]:inline">
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
          <span className="truncate min-w-0 @max-[860px]:sr-only">— no milestone, not checked</span>
          <span aria-hidden="true" className="hidden truncate min-w-0 @max-[860px]:inline">
            — not checked
          </span>
        </div>
        {naDriftCells}
      </>
    );
  }

  const selected = selectDisplayMr(mrs);
  if (!selected) return null; // unreachable — mrs.length > 0 is guaranteed by the branches above

  const { mr } = selected;
  // WR-08: from `allMrs`, never `mrs` — see the prop's docstring.
  const others = allMrs.filter((r) => r.mr.id !== mr.id);

  // Pre-milestone look (v1.13.5), restored per the developer's explicit
  // choice at the live UAT checkpoint: GitMerge icon + state-coloured `!iid`
  // link + outline state badge.
  const stateLinkClass =
    mr.state === 'merged'
      ? 'text-green-600 dark:text-green-400'
      : mr.state === 'opened'
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-gray-500';
  const stateBadgeClass = mrStateBadgeClass(mr.state);

  return (
    <>
      {/* CR-05: the wrapper must opt OUT of hit-testing. It is a later
          positioned sibling of the row's `absolute inset-0` overlay button, so
          with `relative` alone (z-index: auto) it paints and hit-tests ABOVE
          the overlay and swallows the D-04 full-row click across the whole
          190px column. Genuinely interactive children opt back in with
          `relative z-10` — the established sibling-overlay convention shared
          with the Key/Summary/Assignee/Status cells. */}
      <div className={`pointer-events-none relative ${COL_MR} flex items-center gap-1.5 text-xs`}>
        {/* `pointer-events-auto` on the link is load-bearing, not decoration:
            the wrapper above opts the whole cell out of hit-testing and
            `pointer-events` INHERITS, so without it the MR link itself would
            stop being clickable. */}
        {/* render prop (not the default children/span wrap) — this cell relies on
            precise pointer-events opt-in (CR-05 above), so LinkContextMenu attaches
            directly to the <button> with no extra wrapper element. */}
        <LinkContextMenu
          href={mr.web_url}
          render={
            <button
              type="button"
              data-testid="mr-cell-link"
              onClick={(e) => {
                e.stopPropagation();
                openExternal(mr.web_url);
              }}
              title={`${mr.author.name} — ${mr.title}`}
              className={`pointer-events-auto relative z-10 inline-flex items-center gap-1 hover:underline ${stateLinkClass}`}
            >
              <GitMerge className="size-3.5" />!{mr.iid}
            </button>
          }
        />
        <span className="@max-[860px]:sr-only">
          <Badge variant="outline" className={`pointer-events-none text-[10px] ${stateBadgeClass}`}>
            {mr.state}
          </Badge>
        </span>
        {others.length > 0 && (
          /* CR-08: this marker is the ONLY route to the MRs consolidation
             hides — non-selected MRs are attached to a covered task, so
             `buildTaskMrAttachment` excludes them from `secondaryRows` by
             construction. It carried `pointer-events-none`, which removes it
             from hit-testing, so the browser never fired the hover that would
             render its `title`: it announced N hidden MRs and offered no way
             to see them. It must opt back INTO hit-testing (and above the row
             overlay) for the tooltip to exist at all. The sr-only list is the
             non-hover equivalent — a `title` is announced inconsistently and
             not at all without a pointer. */
          <span
            data-testid="mr-extra-count"
            className="pointer-events-auto relative z-10 cursor-help text-muted-foreground"
            title={`Also: ${others.map((r) => `!${r.mr.iid} (${r.mr.state})`).join(', ')}`}
          >
            +{others.length}
            <span className="sr-only">
              {` — also on this task: ${others.map((r) => `!${r.mr.iid} (${r.mr.state})`).join(', ')}`}
            </span>
          </span>
        )}
      </div>
      {selected.evaluated ? (
        <>
          {/* CR-05: `interactive` is DERIVED, never hardcoded — an ok/na/
              non-actionable-flag cell renders an inert glyph, and claiming
              `z-10` for it would put a 28px dead zone over the row overlay. */}
          {/* CR-07: `key` by mr.id, not by position. These cells hold their
              write state in component state (D-08, deliberately, so a failure
              survives background refetches), and the row's `mr` changes
              whenever the selection input does — without the key React would
              reuse the hook instance and a sticky failure, plus its retry
              write, would rebind to a different merge request. */}
          <DriftCellSlot interactive={isMrFixActionable(selected.br, 'retarget', fix)}>
            <DriftActionCell
              key={`br-${mr.id}`}
              mr={mr}
              action="retarget"
              mark={selected.br}
              testId="drift-br"
              fix={fix}
            />
          </DriftCellSlot>
          <DriftCellSlot interactive={isMrFixActionable(selected.ms, 'assign-milestone', fix)}>
            <DriftActionCell
              key={`ms-${mr.id}`}
              mr={mr}
              action="assign-milestone"
              mark={selected.ms}
              testId="drift-ms"
              fix={fix}
            />
          </DriftCellSlot>
        </>
      ) : (
        naDriftCells
      )}
    </>
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
      <span
        className={`pointer-events-none relative ${COL_PERSON} inline-flex items-center gap-1.5 text-xs`}
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
      <div className={`pointer-events-none relative ${COL_STATE} flex items-center`}>
        <span className={statusPillClass(issue.fields.status.statusCategory?.key)}>
          {issue.fields.status.name}
        </span>
      </div>
      <TaskMrCell
        mrs={mrs}
        allMrs={allMrs}
        isLoadingDrift={isLoadingDrift}
        driftUnavailable={driftUnavailable}
        hasMatchedMilestone={hasMatchedMilestone}
        fix={fix}
      />
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

  // WR-08: `allMrs` rides along unfiltered so the `+N` marker keeps describing
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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
        <h3 className="text-sm font-semibold">Issues</h3>
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
          found is silently missing from it and from the `+N` count. The
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
              const reason = secondaryReason(row);
              let actionCell: React.ReactNode = null;
              let fixTarget: { text: string; title: string } | undefined;
              if (reason === 'not-in-fix-version' && jiraFix) {
                fixTarget = {
                  text: `add to ${versionName}`,
                  title: `Add fix version ${versionName} to ${keys.join(', ')} (other fix versions are kept)`,
                };
                actionCell = (
                  <ApplyFixVersionAction
                    keys={keys}
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
