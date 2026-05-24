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

import { useMemo } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Clock, GitBranch, MessageSquare } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { extractJiraKeyFromMessage } from '@/lib/standup-date';
import type { JiraActivityItem } from '@/services/jira';
import type { GitLabCommit, GitLabUserMREvent } from '@/services/gitlab';
import type { TempoWorklog } from '@/services/tempo';
import IssueActivityGroup, { type SubItem } from './IssueActivityGroup';
import OtherCommitsGroup from './OtherCommitsGroup';
import StandaloneMrGroup from './StandaloneMrGroup';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YesterdayColumnProps {
  tempoEnabled: boolean;
  yesterdayDate: string;
  dateLabel: string;
  tempoQuery: UseQueryResult<TempoWorklog[], Error>;
  jiraActivityQuery: UseQueryResult<JiraActivityItem[], Error>;
  commitsQuery: UseQueryResult<GitLabCommit[], Error>;
  mrEventsQuery: UseQueryResult<GitLabUserMREvent[], Error>;
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
interface StandaloneMrGroup {
  iid: number;
  title: string;
  events: GitLabUserMREvent[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Returns "Yesterday" if dateStr is the calendar day before today, otherwise the day name. */
function getColumnHeading(dateStr: string): string {
  const today = new Date();
  const calYesterday = new Date(today);
  calYesterday.setDate(today.getDate() - 1);
  const calYesterdayIso = calYesterday.toISOString().slice(0, 10);
  if (dateStr === calYesterdayIso) return 'Yesterday';
  const [y, m, d] = dateStr.split('-').map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

// ─── Markdown export ──────────────────────────────────────────────────────────

export interface MarkdownSources {
  tempoData?: TempoWorklog[];
  jiraData?: JiraActivityItem[];
  commitsData?: GitLabCommit[];
  mrEventsData?: GitLabUserMREvent[];
}

/**
 * Generate a markdown standup summary for the clipboard (D-12, Pattern 7).
 *
 * Format:
 * ## Yesterday (YYYY-MM-DD)
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
  );

  const lines: string[] = [`## Yesterday (${date})`, ''];

  for (const group of issueGroups) {
    lines.push(`### ${group.issueKey}: ${group.summary}`);
    for (const item of group.subItems) {
      lines.push(`- ${item.label}`);
    }
    lines.push('');
  }

  for (const mr of standaloneMrGroups) {
    lines.push(`### !${mr.iid}: ${mr.title}`);
    for (const event of mr.events) {
      const label =
        event.action_name === 'approved'
          ? `Approved !${event.target_iid}`
          : `Commented on !${event.target_iid}`;
      lines.push(`- ${label}`);
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
 * Join strategy:
 * 1. Seed issue groups from Tempo worklogs (key + summary + seconds).
 * 2. Add Jira transitions + comments under their issueKey.
 * 3. For each commit, extract Jira key from message (D-08 message-only).
 *    - Key found → add as 'commit' sub-item under that issue group.
 *    - No key → push to otherCommits bucket.
 * 4. For each MR event, attempt key extraction from target_title.
 *    - Key found → add as 'mr-comment' or 'approval' sub-item under issue group.
 *    - No key → group by target_iid in standaloneMrGroups.
 *
 * Never uses toLocaleDateString() — date comparisons use .slice(0, 10).
 */
function buildGroups(
  tempoData?: TempoWorklog[],
  jiraData?: JiraActivityItem[],
  commitsData?: GitLabCommit[],
  mrEventsData?: GitLabUserMREvent[],
): { issueGroups: IssueGroup[]; standaloneMrGroups: StandaloneMrGroup[]; otherCommits: GitLabCommit[] } {
  const issueMap = new Map<string, IssueGroup>();
  const standaloneMrMap = new Map<number, StandaloneMrGroup>();
  const otherCommits: GitLabCommit[] = [];

  // 1. Seed from Tempo worklogs
  for (const worklog of tempoData ?? []) {
    const key = worklog.issue.key;
    const existing = issueMap.get(key);
    if (existing) {
      existing.totalSeconds += worklog.timeSpentSeconds;
      if (!existing.summary && worklog.issue.summary) {
        existing.summary = worklog.issue.summary;
      }
    } else {
      issueMap.set(key, {
        issueKey: key,
        summary: worklog.issue.summary ?? key,
        totalSeconds: worklog.timeSpentSeconds,
        subItems: [],
      });
    }
  }

  // 2. Add Jira transitions + comments
  for (const activity of jiraData ?? []) {
    const { issueKey, summary, transitions, comments } = activity;
    const group = issueMap.get(issueKey) ?? {
      issueKey,
      summary,
      totalSeconds: 0,
      subItems: [],
    };
    if (!issueMap.has(issueKey)) {
      issueMap.set(issueKey, group);
    }
    // Update summary if it was set to the key as fallback
    if (group.summary === issueKey && summary) {
      group.summary = summary;
    }

    for (const t of transitions) {
      group.subItems.push({
        kind: 'transition',
        label: `${t.fromStatus} → ${t.toStatus}`,
      });
    }
    for (const c of comments) {
      const snippet = c.body.length > 80 ? `${c.body.slice(0, 80)}…` : c.body;
      group.subItems.push({ kind: 'jira-comment', label: `Comment: "${snippet}"` });
    }
  }

  // 3. Route commits by Jira key from message (D-08 message-only; branch deferred D-14)
  for (const commit of commitsData ?? []) {
    const key = extractJiraKeyFromMessage(commit.message) ?? extractJiraKeyFromMessage(commit.title);
    if (key) {
      const group = issueMap.get(key) ?? {
        issueKey: key,
        summary: key,
        totalSeconds: 0,
        subItems: [],
      };
      if (!issueMap.has(key)) {
        issueMap.set(key, group);
      }
      group.subItems.push({ kind: 'commit', label: `${commit.title} (${commit.short_id})` });
    } else {
      otherCommits.push(commit);
    }
  }

  // 4. Route MR events by key extracted from target_title
  for (const event of mrEventsData ?? []) {
    const key =
      extractJiraKeyFromMessage(event.target_title);
    if (key) {
      const group = issueMap.get(key) ?? {
        issueKey: key,
        summary: event.target_title,
        totalSeconds: 0,
        subItems: [],
      };
      if (!issueMap.has(key)) {
        issueMap.set(key, group);
      }
      const kind = event.action_name === 'approved' ? 'approval' : 'mr-comment';
      const label =
        event.action_name === 'approved'
          ? `Approved !${event.target_iid}`
          : `Commented on !${event.target_iid}`;
      group.subItems.push({ kind, label });
    } else {
      // Standalone MR group keyed by target_iid
      const existing = standaloneMrMap.get(event.target_iid);
      if (existing) {
        existing.events.push(event);
      } else {
        standaloneMrMap.set(event.target_iid, {
          iid: event.target_iid,
          title: event.target_title,
          events: [event],
        });
      }
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
}: YesterdayColumnProps) {
  // Build joined groups in a stable useMemo
  const { issueGroups, standaloneMrGroups, otherCommits } = useMemo(
    () =>
      buildGroups(
        tempoQuery.data,
        jiraActivityQuery.data,
        commitsQuery.data,
        mrEventsQuery.data,
      ),
    [tempoQuery.data, jiraActivityQuery.data, commitsQuery.data, mrEventsQuery.data],
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
  const mrEventCount = useMemo(
    () =>
      issueGroups.reduce(
        (sum, g) =>
          sum + g.subItems.filter((s) => s.kind === 'mr-comment' || s.kind === 'approval').length,
        0,
      ) + standaloneMrGroups.reduce((sum, mr) => sum + mr.events.length, 0),
    [issueGroups, standaloneMrGroups],
  );

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
      <div className="mb-2">
        <h2 className="text-xl font-semibold">{getColumnHeading(yesterdayDate)}</h2>
        <p className="text-xs text-muted-foreground">{dateLabel}</p>
      </div>

      {/* D-10 Summary stat line — only when at least one source has data */}
      {hasStatLine && (
        <p className="text-xs text-muted-foreground mb-4">
          {(totalSeconds / 3600).toFixed(1)}h logged across{' '}
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
      ) : tempoQuery.data?.length === 0 ? (
        <div className="mb-3">
          <EmptyState
            icon={Clock}
            title="No worklogs yesterday"
            subtitle={`No time was logged on ${yesterdayDate} in Tempo.`}
          />
        </div>
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
      ) : jiraActivityQuery.data?.length === 0 ? (
        <div className="mb-3">
          <EmptyState
            icon={MessageSquare}
            title="No Jira activity yesterday"
            subtitle={`No status transitions or comments were found for ${yesterdayDate}.`}
          />
        </div>
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
      ) : commitsQuery.data?.length === 0 ? (
        <div className="mb-3">
          <EmptyState
            icon={GitBranch}
            title="No commits yesterday"
            subtitle={`No commits were authored by you on ${yesterdayDate}.`}
          />
        </div>
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
      ) : mrEventsQuery.data?.length === 0 ? (
        <div className="mb-3">
          <EmptyState
            icon={MessageSquare}
            title="No MR activity yesterday"
            subtitle={`No comments or approvals were recorded for ${yesterdayDate}.`}
          />
        </div>
      ) : null}

      {/* ── Joined group list: issue → standalone MR → other commits ─── */}
      {hasAnyData && (
        <div className="divide-y divide-border">
          {issueGroups.map((group) => (
            <IssueActivityGroup
              key={group.issueKey}
              issueKey={group.issueKey}
              summary={group.summary}
              issueType={group.issueType}
              totalSeconds={group.totalSeconds}
              subItems={group.subItems}
            />
          ))}

          {standaloneMrGroups.map((mr) => (
            <StandaloneMrGroup
              key={mr.iid}
              iid={mr.iid}
              title={mr.title}
              events={mr.events}
            />
          ))}

          {otherCommits.length > 0 && <OtherCommitsGroup commits={otherCommits} />}
        </div>
      )}
    </div>
  );
}
