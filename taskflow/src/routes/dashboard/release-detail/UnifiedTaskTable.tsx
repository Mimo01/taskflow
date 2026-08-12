import { openUrl } from '@tauri-apps/plugin-opener';
import { AlertTriangle, Check, GitBranch, Loader2, Milestone } from 'lucide-react';
import type React from 'react';
import { useRef } from 'react';
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
const COL_KEY = 'flex-none w-[72px]';
const COL_SUMMARY = 'flex-1 min-w-0';
const COL_PERSON = 'flex-none w-[140px] min-w-0';
const COL_STATE = 'flex-none w-[96px]';

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

/** State ternary shared by MR state badges — extracted once rather than triplicated. */
function mrStateBadgeClass(state: string): string {
  return state === 'merged'
    ? 'border-green-500 text-green-600'
    : state === 'opened'
      ? 'border-blue-500 text-blue-600'
      : 'border-gray-400 text-gray-500';
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

  const configComplete = fix.projectId != null && fix.baseUrl != null && fix.token != null;
  const prereqReady =
    action === 'retarget'
      ? fix.releaseBranchExists && fix.releaseBranchName != null
      : fix.matchedMilestone != null;
  const actionable = mark === 'flag' && configComplete && prereqReady;

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
      className="group/row pl-4 flex items-center gap-2 text-xs py-1 text-muted-foreground"
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
      <span className={`${COL_PERSON} inline-flex items-center gap-1.5`}>
        <CachedAvatar url={mr.author.avatar_url} name={mr.author.name} size={20} />
        <span className="truncate">{mr.author.name}</span>
      </span>
      <Badge
        variant="outline"
        className={`${COL_STATE} text-[10px] justify-center ${mrStateBadgeClass(mr.state)}`}
      >
        {mr.state}
      </Badge>
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

function TaskRow({
  issue,
  onOpenIssue,
  onOpenIssueFull,
  onSeedBreadcrumb,
}: {
  issue: JiraIssue;
  onOpenIssue: (key: string) => void;
  onOpenIssueFull: (key: string) => void;
  onSeedBreadcrumb: () => void;
}) {
  return (
    <div
      data-testid="task-row"
      className="relative flex items-center gap-2 text-sm py-1.5 border-b border-border/50 hover:bg-muted/40"
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
      <span className="pointer-events-none flex-none w-[28px]" />
      <span className="pointer-events-none flex-none w-[28px]" />
    </div>
  );
}

function MrSlot({
  isLoadingDrift,
  driftUnavailable,
  mrs,
  hasMatchedMilestone,
  onNavigateToIssueFromMR,
  fix,
}: {
  isLoadingDrift: boolean;
  driftUnavailable: boolean;
  mrs: DriftRow[];
  hasMatchedMilestone: boolean;
  onNavigateToIssueFromMR: (key: string) => void;
  fix: MrFixContext;
}) {
  if (isLoadingDrift) {
    return (
      <div
        data-testid="mr-slot-pending"
        className="pl-4 flex items-center gap-2 text-xs py-1 text-muted-foreground"
      >
        <Loader2 className="size-3.5 animate-spin" />
        loading merge requests…
      </div>
    );
  }

  // Pending beats failed beats verified-empty (order matters). A channel
  // that failed to answer is an unknown, not a verified absence — never
  // orange, matching the neutral mr-slot-unavailable treatment.
  if (driftUnavailable && mrs.length === 0) {
    return (
      <div
        data-testid="mr-slot-failed"
        title="GitLab merge request lookup failed — this task's MR status is unknown"
        className="pl-4 flex items-center gap-2 text-xs py-1 text-muted-foreground"
      >
        — couldn't check merge requests
      </div>
    );
  }

  if (mrs.length === 0 && hasMatchedMilestone) {
    return (
      <div
        data-testid="mr-slot-none"
        className="pl-4 flex items-center gap-2 text-xs py-1 text-orange-600 dark:text-orange-400"
      >
        <AlertTriangle className="size-3.5" />
        No merge request
      </div>
    );
  }

  if (mrs.length === 0 && !hasMatchedMilestone) {
    return (
      <div
        data-testid="mr-slot-unavailable"
        title="No GitLab milestone matched — cannot check for MRs"
        className="pl-4 flex items-center gap-2 text-xs py-1 text-muted-foreground"
      >
        — MR status unavailable
      </div>
    );
  }

  return (
    <>
      {mrs.map((row) => (
        <MrSubLine
          key={row.mr.id}
          row={row}
          onNavigateToIssueFromMR={onNavigateToIssueFromMR}
          fix={fix}
        />
      ))}
    </>
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
  onOpenIssue,
  onOpenIssueFull,
  onSeedBreadcrumb,
  onNavigateToIssueFromMR,
  fix,
}: UnifiedTaskTableProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">Issues</h3>
        {issueCounts && (
          <Badge variant="secondary" className="text-xs tabular-nums">
            {issueCounts.issuesFixed} / {issueCounts.issuesTotal} done
          </Badge>
        )}
        {!isLoadingDrift && !isLoadingIssues && (
          <Badge
            variant="secondary"
            className="ml-1.5 text-xs tabular-nums"
            data-testid="flagged-count-badge"
            title="Merge requests needing attention"
          >
            {flaggedMrCount}
          </Badge>
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

      {isLoadingIssues ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="size-3.5 animate-spin" />
          Loading issues...
        </div>
      ) : primaryRows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No issues in this fix version</p>
      ) : (
        <>
          <ColumnHeaderStrip />
          <div data-testid="task-list">
            {primaryRows.map(({ issue, mrs }) => (
              <div key={issue.id}>
                <TaskRow
                  issue={issue}
                  onOpenIssue={onOpenIssue}
                  onOpenIssueFull={onOpenIssueFull}
                  onSeedBreadcrumb={onSeedBreadcrumb}
                />
                <MrSlot
                  isLoadingDrift={isLoadingDrift}
                  driftUnavailable={driftUnavailable}
                  mrs={mrs}
                  hasMatchedMilestone={hasMatchedMilestone}
                  onNavigateToIssueFromMR={onNavigateToIssueFromMR}
                  fix={fix}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {!isLoadingIssues && secondaryRows.length > 0 && (
        <div data-testid="secondary-section" className="mt-4 pt-4 border-t border-border/50">
          <h4 className="text-sm font-medium">Not covered by tasks above</h4>
          <ColumnHeaderStrip />
          {secondaryRows.map((row) => {
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
