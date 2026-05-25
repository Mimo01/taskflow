/**
 * YesterdayColumn — left column of the Standup Notes page.
 *
 * Aggregates four independent data sources by Jira issue key:
 *   - Tempo worklogs    (hours per issue)
 *   - Jira activity     (transitions + comments per issue)
 *   - GitLab commits    (grouped by Jira key from message; D-08 message-only fallback)
 *   - GitLab MR events  (grouped by Jira key from target_title; else standalone)
 *
 * Renders:
 *   - Column heading "Yesterday" + stat line (D-10)
 *   - Per-section loading/empty/error/disabled states (UI-SPEC States per Section)
 *   - Issue groups → standalone MR groups → Other commits (in order)
 *   - Full-column empty state when all sources are empty/disabled
 *
 * D-14 branch-fallback note: commit grouping uses message extraction only.
 * Branch-name → Jira key resolution (per-commit /refs API) is deferred to avoid
 * Pitfall 7 fan-out. Commits with no key in the message route to "Other commits".
 *
 * Exports generateMarkdown() for StandupNotesPage's Copy markdown handler.
 */

import type { UseQueryResult } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useMemo } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { extractJiraKeyFromMessage } from '@/lib/standup-date';
import type { GitLabCommit, GitLabUserMREvent } from '@/services/gitlab';
import type { JiraActivityItem, StandupIssueMeta } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';
import type { TempoWorklog } from '@/services/tempo';
import IssueActivityGroup, { type SubItem } from './IssueActivityGroup';
import OtherCommitsGroup from './OtherCommitsGroup';
import StandaloneMrGroup from './StandaloneMrGroup';
import StandupSectionHeader from './StandupSectionHeader';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YesterdayColumnProps {
  tempoEnabled: boolean;
  yesterdayDate: string;
  dateLabel: string;
  tempoQuery: UseQueryResult<TempoWorklog[], Error>;
  jiraActivityQuery: UseQueryResult<JiraActivityItem[], Error>;
  commitsQuery: UseQueryResult<GitLabCommit[], Error>;
  mrEventsQuery: UseQueryResult<GitLabUserMREvent[], Error>;
  /** Resolved issue key → metadata map for icons + parent-story rollup grouping. */
  issueMeta: Record<string, StandupIssueMeta>;
  /** Navigate to the issue detail page (threads the breadcrumb trail). */
  onIssueClick: (key: string) => void;
  /** Navigate to the MR detail page. Receives "${projectId}/${iid}" string. */
  onMRClick: (projectIdAndIid: string) => void;
}

/** Internal shape of a joined issue group (used for rendering + markdown). */
interface IssueGroup {
  issueKey: string;
  summary: string;
  issueType?: string;
  totalSeconds: number;
  subItems: SubItem[];
}

/** Internal shape of a standalone MR group (MR not linked to any issue). */
interface StandaloneMrGroupData {
  iid: number;
  projectId: number;
  title: string;
  /** Comment events collapsed to a count (D-05) — not listed individually. */
  commentCount: number;
  /** Approval events on this MR. */
  approvals: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Returns "Yesterday" if dateStr is the calendar day before today, otherwise the day name. */
function getColumnHeading(dateStr: string): string {
  const today = new Date();
  const calYesterday = new Date(today);
  calYesterday.setDate(today.getDate() - 1);
  // Use local calendar components — never toISOString() which converts to UTC
  // and shifts the date for users east of UTC (same rule as standup-date.ts).
  const calYesterdayLocal = `${calYesterday.getFullYear()}-${String(calYesterday.getMonth() + 1).padStart(2, '0')}-${String(calYesterday.getDate()).padStart(2, '0')}`;
  if (dateStr === calYesterdayLocal) return 'Yesterday';
  const [y, m, d] = dateStr.split('-').map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

// ─── Markdown export ──────────────────────────────────────────────────────────

export interface MarkdownSources {
  tempoData?: TempoWorklog[];
  jiraData?: JiraActivityItem[];
  commitsData?: GitLabCommit[];
  mrEventsData?: GitLabUserMREvent[];
  issueMeta?: Record<string, StandupIssueMeta>;
}

/**
 * Generate a markdown standup summary for the clipboard (D-12, Pattern 7).
 *
 * Format:
 * ## {DayLabel} (YYYY-MM-DD)  — "Yesterday" if date is calendar-yesterday, else day name
 *
 * ### PROJ-123: Issue summary
 * - Sub-item label
 * ...
 *
 * ### Other commits
 * - commit title (short_id)
 */
export function generateMarkdown(sources: MarkdownSources, date: string): string {
  const { issueGroups, standaloneMrGroups, otherCommits } = buildGroups(
    sources.tempoData,
    sources.jiraData,
    sources.commitsData,
    sources.mrEventsData,
    sources.issueMeta,
  );

  const lines: string[] = [`## ${getColumnHeading(date)} (${date})`, ''];

  for (const group of issueGroups) {
    lines.push(`### ${group.issueKey}: ${group.summary}`);
    for (const item of group.subItems) {
      lines.push(`- ${item.label}`);
    }
    lines.push('');
  }

  for (const mr of standaloneMrGroups) {
    lines.push(`### !${mr.iid}: ${mr.title}`);
    if (mr.commentCount > 0) {
      lines.push(`- ${mr.commentCount} comment${mr.commentCount === 1 ? '' : 's'} on !${mr.iid}`);
    }
    if (mr.approvals > 0) {
      lines.push(`- Approved !${mr.iid}`);
    }
    lines.push('');
  }

  if (otherCommits.length > 0) {
    lines.push('### Other commits');
    for (const commit of otherCommits) {
      lines.push(`- ${commit.title} (${commit.short_id})`);
    }
    lines.push('');
  }

  if (issueGroups.length === 0 && standaloneMrGroups.length === 0 && otherCommits.length === 0) {
    lines.push('Nothing to recap.');
  }

  return lines.join('\n');
}

// ─── Data join logic ──────────────────────────────────────────────────────────

/**
 * Build the three rendering buckets from the four raw data sources.
 *
 * Join strategy — everything keys off a single rollup group per issue:
 * 1. Seed groups from Tempo worklogs (seconds).
 * 2. Add Jira transitions + comments.
 * 3. Add commits (Jira key from message; D-08 message-only; else "Other commits").
 * 4. Add MR events (approvals listed; comments collapsed to a per-MR count).
 *
 * Parent-story rollup (issueMeta): a sub-task's activity is grouped under its
 * PARENT story so e.g. time logged on a sub-task and MR comments on its story
 * appear together. Stories/epics stay under their own key. Without issueMeta
 * (not yet loaded / failed) there is no rollup — grouping is per-issue.
 *
 * Never uses toLocaleDateString() — date comparisons use .slice(0, 10).
 */
function buildGroups(
  tempoData?: TempoWorklog[],
  jiraData?: JiraActivityItem[],
  commitsData?: GitLabCommit[],
  mrEventsData?: GitLabUserMREvent[],
  issueMeta?: Record<string, StandupIssueMeta>,
): {
  issueGroups: IssueGroup[];
  standaloneMrGroups: StandaloneMrGroupData[];
  otherCommits: GitLabCommit[];
} {
  const issueMap = new Map<string, IssueGroup>();
  const standaloneMrMap = new Map<number, StandaloneMrGroupData>();
  const otherCommits: GitLabCommit[] = [];

  // Resolve the rollup target for an issue key: a sub-task rolls up to its
  // parent story; everything else stays under its own key. Returns the group's
  // display key/summary/type sourced from metadata when available.
  function resolveRollup(key: string): { rollupKey: string; summary?: string; type?: string } {
    const meta = issueMeta?.[key];
    if (meta?.isSubtask && meta.parentKey) {
      return { rollupKey: meta.parentKey, summary: meta.parentSummary, type: meta.parentType };
    }
    return { rollupKey: key, summary: meta?.summary, type: meta?.type };
  }

  // Get-or-create the rollup group for an issue key, upgrading its summary/type
  // as better information becomes available. Metadata wins; the source-provided
  // fallbacks fill in when metadata hasn't loaded (or for untyped sources).
  function ensureGroup(key: string, fallbackSummary?: string, fallbackType?: string): IssueGroup {
    const { rollupKey, summary, type } = resolveRollup(key);
    const resolvedSummary = summary ?? fallbackSummary;
    const resolvedType = type ?? fallbackType;

    const existing = issueMap.get(rollupKey);
    if (existing) {
      if (resolvedSummary && (!existing.summary || existing.summary === existing.issueKey)) {
        existing.summary = resolvedSummary;
      }
      if (!existing.issueType && resolvedType) existing.issueType = resolvedType;
      return existing;
    }
    const group: IssueGroup = {
      issueKey: rollupKey,
      summary: resolvedSummary ?? rollupKey,
      issueType: resolvedType,
      totalSeconds: 0,
      subItems: [],
    };
    issueMap.set(rollupKey, group);
    return group;
  }

  // 1. Seed from Tempo worklogs. Time rolls into the group total AND surfaces as
  //    a per-logged-issue sub-item, so a sub-task you logged on stays visible
  //    (with its own hours) under its parent story rather than vanishing into a
  //    single aggregate. Multiple entries on the same issue are summed.
  const worklogByGroup = new Map<string, Map<string, { seconds: number; summary: string }>>();
  for (const worklog of tempoData ?? []) {
    const group = ensureGroup(
      worklog.issue.key,
      worklog.issue.summary,
      worklog.issue.issueType?.name,
    );
    group.totalSeconds += worklog.timeSpentSeconds;

    const perIssue =
      worklogByGroup.get(group.issueKey) ?? new Map<string, { seconds: number; summary: string }>();
    const entry = perIssue.get(worklog.issue.key) ?? {
      seconds: 0,
      summary: worklog.issue.summary ?? worklog.issue.key,
    };
    entry.seconds += worklog.timeSpentSeconds;
    perIssue.set(worklog.issue.key, entry);
    worklogByGroup.set(group.issueKey, perIssue);
  }
  for (const [groupKey, perIssue] of worklogByGroup) {
    const group = issueMap.get(groupKey);
    if (!group) continue;
    for (const [issueKey, { seconds, summary }] of perIssue) {
      group.subItems.push({
        kind: 'worklog',
        label: `${formatDuration(seconds)} · ${issueKey} ${summary}`,
        // When the worklog issue differs from the group key (subtask rolled up
        // to parent), carry the original key so the row is clickable to the subtask.
        issueKey: issueKey !== groupKey ? issueKey : undefined,
      });
    }
  }

  // 2. Add Jira transitions + comments
  for (const activity of jiraData ?? []) {
    const group = ensureGroup(activity.issueKey, activity.summary, activity.issueType);
    for (const t of activity.transitions) {
      group.subItems.push({ kind: 'transition', label: `${t.fromStatus} → ${t.toStatus}` });
    }
    for (const c of activity.comments) {
      const snippet = c.body.length > 80 ? `${c.body.slice(0, 80)}…` : c.body;
      group.subItems.push({ kind: 'jira-comment', label: `Comment: "${snippet}"` });
    }
  }

  // 3. Route commits by Jira key from message (D-08 message-only; branch deferred D-14)
  for (const commit of commitsData ?? []) {
    const key =
      extractJiraKeyFromMessage(commit.message) ?? extractJiraKeyFromMessage(commit.title);
    if (key) {
      const group = ensureGroup(key);
      group.subItems.push({ kind: 'commit', label: `${commit.title} (${commit.short_id})` });
    } else {
      otherCommits.push(commit);
    }
  }

  // 4. Route MR events by key extracted from target_title.
  //    Approvals are listed individually; comment events are collapsed into a
  //    per-MR count (D-05) so a chatty review thread reads "N comments on <MR
  //    name>" instead of one line per comment. Comments must group on the MR iid
  //    (note.noteable_iid) — target_iid is the per-comment note id and would
  //    make every comment look like a separate MR. Labels use the MR title (its
  //    name), not the bare iid, so the recap reads naturally.
  const keyedCommentCounts = new Map<string, Map<number, { count: number; title: string; projectId: number }>>(); // rollupKey -> (mrIid -> {count, title, projectId})
  for (const event of mrEventsData ?? []) {
    const key = extractJiraKeyFromMessage(event.target_title);
    const isApproval = event.action_name === 'approved';
    const mrIid = event.note?.noteable_iid ?? event.target_iid;
    if (key) {
      const group = ensureGroup(key, event.target_title);
      if (isApproval) {
        group.subItems.push({ kind: 'approval', label: `Approved ${event.target_title}`, mrProjectId: event.project_id, mrIid });
      } else {
        const perIid =
          keyedCommentCounts.get(group.issueKey) ??
          new Map<number, { count: number; title: string; projectId: number }>();
        const entry = perIid.get(mrIid) ?? { count: 0, title: event.target_title, projectId: event.project_id };
        entry.count += 1;
        perIid.set(mrIid, entry);
        keyedCommentCounts.set(group.issueKey, perIid);
      }
    } else {
      // Standalone MR group keyed by MR iid — counts only (D-05)
      const existing = standaloneMrMap.get(mrIid);
      if (existing) {
        if (isApproval) existing.approvals += 1;
        else existing.commentCount += 1;
      } else {
        standaloneMrMap.set(mrIid, {
          iid: mrIid,
          projectId: event.project_id,
          title: event.target_title,
          commentCount: isApproval ? 0 : 1,
          approvals: isApproval ? 1 : 0,
        });
      }
    }
  }

  // Emit one aggregated MR-comment sub-item per (group, MR): "N comments on <name>"
  for (const [rollupKey, perIid] of keyedCommentCounts) {
    const group = issueMap.get(rollupKey);
    if (!group) continue;
    for (const [mrIid, { count, title, projectId }] of perIid) {
      group.subItems.push({
        kind: 'mr-comment',
        label: `${count} comment${count === 1 ? '' : 's'} on ${title}`,
        mrProjectId: projectId,
        mrIid,
      });
    }
  }

  return {
    issueGroups: [...issueMap.values()],
    standaloneMrGroups: [...standaloneMrMap.values()],
    otherCommits,
  };
}

// ─── Section state helpers ────────────────────────────────────────────────────

function LoadingSkeletons() {
  return (
    <div className="flex flex-col gap-2 py-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function YesterdayColumn({
  tempoEnabled,
  yesterdayDate,
  dateLabel,
  tempoQuery,
  jiraActivityQuery,
  commitsQuery,
  mrEventsQuery,
  issueMeta,
  onIssueClick,
  onMRClick,
}: YesterdayColumnProps) {
  // Build joined groups in a stable useMemo
  const { issueGroups, standaloneMrGroups, otherCommits } = useMemo(
    () =>
      buildGroups(
        tempoQuery.data,
        jiraActivityQuery.data,
        commitsQuery.data,
        mrEventsQuery.data,
        issueMeta,
      ),
    [tempoQuery.data, jiraActivityQuery.data, commitsQuery.data, mrEventsQuery.data, issueMeta],
  );

  // Stat line figures (D-10)
  const totalSeconds = useMemo(
    () => issueGroups.reduce((sum, g) => sum + g.totalSeconds, 0),
    [issueGroups],
  );
  const commitCount = useMemo(
    () =>
      issueGroups.reduce(
        (sum, g) => sum + g.subItems.filter((s) => s.kind === 'commit').length,
        0,
      ) + otherCommits.length,
    [issueGroups, otherCommits],
  );
  // Count raw MR events (comments + approvals) — independent of the per-MR
  // comment collapsing so the stat line still reflects true activity volume.
  const mrEventCount = mrEventsQuery.data?.length ?? 0;

  const hasAnyData =
    issueGroups.length > 0 || standaloneMrGroups.length > 0 || otherCommits.length > 0;

  const hasStatLine = totalSeconds > 0 || commitCount > 0 || mrEventCount > 0;

  // Determine whether all integrations are effectively disabled / empty
  const allIntegrationsDisabledOrEmpty =
    !tempoEnabled &&
    !jiraActivityQuery.data?.length &&
    !commitsQuery.data?.length &&
    !mrEventsQuery.data?.length &&
    !jiraActivityQuery.isLoading &&
    !commitsQuery.isLoading &&
    !mrEventsQuery.isLoading;

  return (
    <div>
      {/* Column heading */}
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-2xl font-semibold">{getColumnHeading(yesterdayDate)}</h2>
        <p className="text-xs text-muted-foreground">{dateLabel}</p>
      </div>

      {/* D-10 Summary stat line — only when at least one source has data */}
      {hasStatLine && (
        <p className="text-xs text-muted-foreground mb-4">
          {formatDuration(totalSeconds)} logged across{' '}
          {issueGroups.filter((g) => g.totalSeconds > 0).length} stories &middot; {commitCount}{' '}
          commits &middot; {mrEventCount} MR events
        </p>
      )}

      {/* Full-column empty state when ALL sources are empty/disabled */}
      {!hasAnyData &&
        !tempoQuery.isLoading &&
        !jiraActivityQuery.isLoading &&
        !commitsQuery.isLoading &&
        !mrEventsQuery.isLoading &&
        !tempoQuery.isError &&
        !jiraActivityQuery.isError &&
        !commitsQuery.isError &&
        !mrEventsQuery.isError && (
          <EmptyState
            icon={Clock}
            title="Nothing to recap"
            subtitle={
              allIntegrationsDisabledOrEmpty
                ? 'No integrations enabled. Enable Jira, GitLab, or Tempo in Settings → Integrations.'
                : `All integrations returned empty results for ${yesterdayDate}.`
            }
          />
        )}

      {/* ── Joined group list: issue → standalone MR → other commits ─── */}
      {/* Populated content renders first; per-source empty/loading/error
          notices fall to the bottom so "nothing here" never sits above data. */}
      {hasAnyData && (
        <div className="flex flex-col divide-y divide-border">
          {/* Task groups (priority): activity grouped under the issue it belongs to */}
          {issueGroups.length > 0 && (
            <div className="mb-4">
              <StandupSectionHeader label="Worked On" count={issueGroups.length} />
              <div className="[&>*]:py-2">
                {issueGroups.map((group) => (
                  <IssueActivityGroup
                    key={group.issueKey}
                    issueKey={group.issueKey}
                    summary={group.summary}
                    issueType={group.issueType}
                    subItems={group.subItems}
                    onClick={() => onIssueClick(group.issueKey)}
                    onIssueClick={onIssueClick}
                    onMRClick={onMRClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Fallback: MR activity that couldn't be matched to a tracked issue */}
          {standaloneMrGroups.length > 0 && (
            <div className="mb-4 pt-4">
              <StandupSectionHeader label="Other Merge Requests" count={standaloneMrGroups.length} />
              <div className="divide-y divide-border [&>*]:py-2">
                {standaloneMrGroups.map((mr) => (
                  <StandaloneMrGroup
                    key={mr.iid}
                    iid={mr.iid}
                    projectId={mr.projectId}
                    title={mr.title}
                    commentCount={mr.commentCount}
                    approvals={mr.approvals}
                    onMRClick={onMRClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Fallback: commits without a linked Jira issue */}
          {otherCommits.length > 0 && (
            <div className="mb-4 pt-4">
              <StandupSectionHeader label="Other Commits" count={otherCommits.length} />
              <OtherCommitsGroup commits={otherCommits} />
            </div>
          )}
        </div>
      )}

      {/* ── Per-source status (empty / loading / error) — below the data ─ */}
      {hasAnyData && <div className="mt-4" />}

      {/* ── Tempo section ──────────────────────────────────────────────── */}
      {!tempoEnabled ? (
        <p className="text-xs text-muted-foreground mb-3">
          Tempo is disabled. Enable it in Settings → Integrations.
        </p>
      ) : tempoQuery.isError ? (
        <div className="mb-3">
          <ErrorState
            error={tempoQuery.error}
            onRetry={() => void tempoQuery.refetch()}
            viewName="Tempo worklogs"
          />
        </div>
      ) : tempoQuery.isLoading && !tempoQuery.data ? (
        <LoadingSkeletons />
      ) : null}

      {/* ── Jira activity section ──────────────────────────────────────── */}
      {jiraActivityQuery.isError ? (
        <div className="mb-3">
          <ErrorState
            error={jiraActivityQuery.error}
            onRetry={() => void jiraActivityQuery.refetch()}
            viewName="Jira activity"
          />
        </div>
      ) : jiraActivityQuery.isLoading && !jiraActivityQuery.data ? (
        <LoadingSkeletons />
      ) : null}

      {/* ── Commits section ────────────────────────────────────────────── */}
      {commitsQuery.isError ? (
        <div className="mb-3">
          <ErrorState
            error={commitsQuery.error}
            onRetry={() => void commitsQuery.refetch()}
            viewName="Git commits"
          />
        </div>
      ) : commitsQuery.isLoading && !commitsQuery.data ? (
        <LoadingSkeletons />
      ) : null}

      {/* ── MR events section ──────────────────────────────────────────── */}
      {mrEventsQuery.isError ? (
        <div className="mb-3">
          <ErrorState
            error={mrEventsQuery.error}
            onRetry={() => void mrEventsQuery.refetch()}
            viewName="MR activity"
          />
        </div>
      ) : mrEventsQuery.isLoading && !mrEventsQuery.data ? (
        <LoadingSkeletons />
      ) : null}
    </div>
  );
}
