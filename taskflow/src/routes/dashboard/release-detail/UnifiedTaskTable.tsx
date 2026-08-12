import { openUrl } from '@tauri-apps/plugin-opener';
import { AlertTriangle, Check, GitBranch, GitMerge, Loader2, Milestone } from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Progress } from '@/components/ui/progress';
import { statusPillClass } from '@/lib/statusStyles';
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import { extractTicketKeys } from '@/services/linkEngine';
import type { Channel, DriftMark, DriftRow } from './driftDetection';
import { type MrFixAction, useMrFixMutation } from './useMrFixMutation';

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
  issueCounts: { issuesFixed: number; issuesTotal: number } | undefined;
  versionName: string;
  hasReleaseDate: boolean;
  isLoadingIssues: boolean;
  isLoadingDrift: boolean;
  driftUnavailable: boolean;
  hasMatchedMilestone: boolean;
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
}

// Shared column grid constants (D-02) — task rows, MR sub-lines and secondary
// rows provably use the same widths. Explicit px throughout, never `%` or an
// unconstrained narrow `flex-1` (recorded WebKit/Tauri zero-width-column
// collapse).
// Keys must never wrap — a Jira key broken at its dash reads as two keys. Fixed
// width + nowrap; widened from 72px so the common PROJ-1234 shape fits without
// spilling into the summary column.
const COL_KEY = 'flex-none w-[88px] whitespace-nowrap';
const COL_SUMMARY = 'flex-1 min-w-0';
const COL_PERSON = 'flex-none w-[140px] min-w-0';
const COL_STATE = 'flex-none w-[96px]';
const COL_MR = 'flex-none w-[190px] min-w-0';

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
      className="flex-none w-[28px] flex items-center justify-center"
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
  const lastMarkRef = useRef(mark);
  if (lastMarkRef.current !== mark) {
    lastMarkRef.current = mark;
    if (mark === 'ok' && status === 'error') reset();
  }

  const rootClassName = 'flex-none w-[28px] flex items-center justify-center';
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
 * Shared column header strip — same grid as task rows / MR sub-lines /
 * secondary rows (D-12).
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
function ColumnHeaderStrip() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium py-1 bg-muted/30">
      <span className={COL_KEY}>Key</span>
      <span className={COL_SUMMARY}>Summary</span>
      <span className={COL_PERSON}>Assignee</span>
      <span className={COL_STATE}>Status</span>
      <span className={COL_MR}>MR</span>
      <span className="flex-none w-[28px] text-center" title="Target branch matches release branch">
        BR
      </span>
      <span className="flex-none w-[28px] text-center" title="Release milestone assigned">
        MS
      </span>
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
}: {
  row: DriftRow;
  onNavigateToIssueFromMR: (key: string) => void;
  fix: MrFixContext;
  keyCell?: React.ReactNode;
}) {
  const { mr } = row;
  const isFlagged = row.br === 'flag' || row.ms === 'flag';

  const iidButton = (
    <button
      type="button"
      onClick={() => openUrl(mr.web_url)}
      title={channelsTitle(row.channels)}
      className="font-mono text-xs hover:underline"
    >
      !{mr.iid}
    </button>
  );

  const titleContent = (() => {
    const keys = extractTicketKeys(mr.title);
    if (keys.length === 0) return mr.title;
    const parts: React.ReactNode[] = [];
    let remaining = mr.title;
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

  return (
    <div
      data-testid="drift-row"
      title={`${mr.author.name} — ${mr.state}`}
      className={`group/row pl-4 flex items-center gap-2 text-xs py-1 ${isFlagged ? 'text-foreground' : 'text-muted-foreground'}`}
    >
      {keyCell ?? <span className={COL_KEY}>{iidButton}</span>}
      <span className={`${COL_SUMMARY} truncate`}>
        {keyCell ? (
          <span className="inline-flex items-center gap-2">
            {iidButton}
            {titleContent}
          </span>
        ) : (
          titleContent
        )}
      </span>
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
    </div>
  );
}

/**
 * Choose which MR to display on a consolidated task row when a task carries
 * 2+ merge requests (developer's explicit choice, live UAT checkpoint,
 * 2026-08-12): "99% of the time there is 1 MR for 1 task so the edge case of
 * having multiple is not worth solving. I want it all consolidated into one
 * single line for each task like it was before." A flagged MR (br or ms)
 * wins; ties are broken by highest `iid`. With no flagged MR, highest `iid`
 * wins. No MR is dropped from the underlying data — the rest surface behind
 * the `+N` marker (`mr-extra-count`).
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
  const pool = flagged.length > 0 ? flagged : mrs;
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
    <div className={`relative flex-none w-[28px] ${interactive ? 'z-10' : 'pointer-events-none'}`}>
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
  isLoadingDrift,
  driftUnavailable,
  hasMatchedMilestone,
  fix,
}: {
  mrs: DriftRow[];
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
          loading…
        </div>
        {naDriftCells}
      </>
    );
  }

  // Pending beats failed beats verified-empty (order matters). A channel
  // that failed to answer is an unknown, not a verified absence — never
  // orange, matching the neutral mr-slot-unavailable treatment.
  if (driftUnavailable && mrs.length === 0) {
    return (
      <>
        <div
          data-testid="mr-slot-failed"
          title="GitLab merge request lookup failed — this task's MR status is unknown"
          className={`pointer-events-none relative ${COL_MR} flex items-center gap-1.5 text-xs py-1 text-muted-foreground`}
        >
          — couldn't check merge requests
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
          <AlertTriangle className="size-3.5" />
          No merge request
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
          — MR status unavailable
        </div>
        {naDriftCells}
      </>
    );
  }

  const selected = selectDisplayMr(mrs);
  if (!selected) return null; // unreachable — mrs.length > 0 is guaranteed by the branches above

  const { mr } = selected;
  const others = mrs.filter((r) => r.mr.id !== mr.id);

  // Pre-milestone look (v1.13.5), restored per the developer's explicit
  // choice at the live UAT checkpoint: GitMerge icon + state-coloured `!iid`
  // link + outline state badge.
  const stateLinkClass =
    mr.state === 'merged'
      ? 'text-green-600 dark:text-green-400'
      : mr.state === 'opened'
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-gray-500';
  const stateBadgeClass =
    mr.state === 'merged'
      ? 'border-green-500 text-green-600'
      : mr.state === 'opened'
        ? 'border-blue-500 text-blue-600'
        : 'border-gray-400 text-gray-500';

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
        <button
          type="button"
          data-testid="mr-cell-link"
          onClick={(e) => {
            e.stopPropagation();
            openUrl(mr.web_url);
          }}
          title={`${mr.author.name} — ${mr.title}`}
          className={`pointer-events-auto relative z-10 inline-flex items-center gap-1 hover:underline ${stateLinkClass}`}
        >
          <GitMerge className="size-3.5" />!{mr.iid}
        </button>
        <Badge variant="outline" className={`pointer-events-none text-[10px] ${stateBadgeClass}`}>
          {mr.state}
        </Badge>
        {others.length > 0 && (
          <span
            data-testid="mr-extra-count"
            className="pointer-events-none text-muted-foreground"
            title={`Also: ${others.map((r) => `!${r.mr.iid}`).join(', ')}`}
          >
            +{others.length}
          </span>
        )}
      </div>
      {selected.evaluated ? (
        <>
          {/* CR-05: `interactive` is DERIVED, never hardcoded — an ok/na/
              non-actionable-flag cell renders an inert glyph, and claiming
              `z-10` for it would put a 28px dead zone over the row overlay. */}
          <DriftCellSlot interactive={isMrFixActionable(selected.br, 'retarget', fix)}>
            <DriftActionCell
              mr={mr}
              action="retarget"
              mark={selected.br}
              testId="drift-br"
              fix={fix}
            />
          </DriftCellSlot>
          <DriftCellSlot interactive={isMrFixActionable(selected.ms, 'assign-milestone', fix)}>
            <DriftActionCell
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
  isLoadingDrift: boolean;
  driftUnavailable: boolean;
  hasMatchedMilestone: boolean;
  fix: MrFixContext;
  onOpenIssue: (key: string) => void;
  onOpenIssueFull: (key: string) => void;
  onSeedBreadcrumb: () => void;
}) {
  return (
    <div
      data-testid="task-row"
      className="group/row relative flex items-center gap-2 text-sm py-1.5 hover:bg-muted/40"
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
            <span className="line-clamp-1">{issue.fields.assignee.displayName}</span>
          </>
        ) : (
          <>
            <CachedAvatar url={null} name="Unassigned" size={20} />
            <span className="text-muted-foreground">Unassigned</span>
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
        isLoadingDrift={isLoadingDrift}
        driftUnavailable={driftUnavailable}
        hasMatchedMilestone={hasMatchedMilestone}
        fix={fix}
      />
    </div>
  );
}

export function UnifiedTaskTable({
  issueCounts,
  versionName,
  hasReleaseDate,
  isLoadingIssues,
  isLoadingDrift,
  driftUnavailable,
  hasMatchedMilestone,
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
}: UnifiedTaskTableProps) {
  // UAT-91.1-B: local category filter driven by the two work-queue badges.
  // Applied at render time (not to props) — see T-91.1-18 threat disposition.
  const [activeFilter, setActiveFilter] = useState<'br' | 'ms' | null>(null);

  const filterPredicate =
    activeFilter === 'br'
      ? (r: DriftRow) => r.br === 'flag'
      : activeFilter === 'ms'
        ? (r: DriftRow) => r.ms === 'flag'
        : null;

  const filteredPrimaryRows = filterPredicate
    ? primaryRows
        .map(({ issue, mrs }) => ({ issue, mrs: mrs.filter(filterPredicate) }))
        .filter(({ mrs }) => mrs.length > 0)
    : primaryRows;

  const filteredSecondaryRows = filterPredicate
    ? secondaryRows.filter(filterPredicate)
    : secondaryRows;

  const clearFilter = () => setActiveFilter(null);

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">Issues</h3>
        {issueCounts && (
          <Badge variant="secondary" className="text-xs tabular-nums">
            {issueCounts.issuesFixed} / {issueCounts.issuesTotal} done
          </Badge>
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
                onClick={() => setActiveFilter((prev) => (prev === 'br' ? null : 'br'))}
              >
                <Badge
                  variant="outline"
                  className="text-xs tabular-nums gap-1 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700"
                >
                  <AlertTriangle className="size-3" />
                  {brFlaggedCount} wrong branch
                </Badge>
              </button>
            )}
            {msFlaggedCount > 0 && (
              <button
                type="button"
                data-testid="flagged-ms-badge"
                aria-pressed={activeFilter === 'ms'}
                aria-label={`Show ${msFlaggedCount} merge requests with no release milestone`}
                onClick={() => setActiveFilter((prev) => (prev === 'ms' ? null : 'ms'))}
              >
                <Badge
                  variant="outline"
                  className="text-xs tabular-nums gap-1 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700"
                >
                  <AlertTriangle className="size-3" />
                  {msFlaggedCount} no milestone
                </Badge>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress bar (Jira-driven) */}
      {issueCounts && issueCounts.issuesTotal > 0 && (
        <Progress
          value={Math.round((issueCounts.issuesFixed / issueCounts.issuesTotal) * 100)}
          className="max-w-xs mb-4"
          indicatorClassName="bg-green-500"
        />
      )}

      {/* Degraded banner (D-16) — one banner, merges the two prior sources */}
      {!hasMatchedMilestone && (
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
      )}

      {/* Filter escape hatch (UAT-91.1-B) — needed because a successful fix
          dropping a count to zero hides its own badge. */}
      {activeFilter && (
        <div
          data-testid="filter-active-notice"
          className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 mb-4 text-xs"
        >
          <span>
            {activeFilter === 'br'
              ? 'Showing only merge requests with a wrong target branch'
              : 'Showing only merge requests with no release milestone'}
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

      {isLoadingIssues ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="size-3.5 animate-spin" />
          Loading issues...
        </div>
      ) : filteredPrimaryRows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          {activeFilter ? 'No merge requests match this filter' : 'No issues in this fix version'}
        </p>
      ) : (
        <>
          <ColumnHeaderStrip />
          <div data-testid="task-list">
            {filteredPrimaryRows.map(({ issue, mrs }) => (
              <div key={issue.id} data-testid="task-group" className="border-b border-border/50">
                <TaskRow
                  issue={issue}
                  mrs={mrs}
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
        <div data-testid="secondary-section" className="mt-4 pt-4 border-t border-border/50">
          <h4 className="text-sm font-medium">Not covered by tasks above</h4>
          <ColumnHeaderStrip />
          {filteredSecondaryRows.map((row) => {
            const keys = row.taskKeys;
            let keyCell: React.ReactNode;
            if (row.taskReason === 'not-in-fix-version') {
              const suffix = keys.length > 1 ? 'are' : 'is';
              keyCell = (
                <span
                  data-testid="secondary-key-flagged"
                  className={`${COL_KEY} font-mono text-xs text-orange-600 dark:text-orange-400 inline-flex items-center gap-1`}
                  title={`${keys.join(', ')} ${suffix} not in fix version ${versionName}`}
                >
                  <AlertTriangle className="size-3" />
                  {keys[0]}
                  {keys.length > 1 ? ` +${keys.length - 1}` : ''}
                </span>
              );
            } else if (keys.length === 0) {
              keyCell = (
                <span
                  data-testid="secondary-key-none"
                  className={`${COL_KEY} font-mono text-xs text-muted-foreground`}
                >
                  &mdash;
                </span>
              );
            } else {
              // Keys present but the row carries no evaluated out-of-scope verdict — the
              // merged/closed/locked `task: 'na'` case. Never assert a drift the row marks
              // as not evaluated (T-91.1-14).
              keyCell = (
                <span
                  data-testid="secondary-key-unevaluated"
                  className={`${COL_KEY} font-mono text-xs text-muted-foreground inline-flex items-center gap-1`}
                  title={`${keys.join(', ')} — not evaluated (MR is ${row.mr.state})`}
                >
                  {keys[0]}
                  {keys.length > 1 ? ` +${keys.length - 1}` : ''}
                </span>
              );
            }
            return (
              <MrSubLine
                key={row.mr.id}
                row={row}
                onNavigateToIssueFromMR={onNavigateToIssueFromMR}
                fix={fix}
                keyCell={keyCell}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
