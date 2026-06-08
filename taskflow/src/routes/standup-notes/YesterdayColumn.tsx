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
import { ChevronDown, Clock } from 'lucide-react';
import { useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { buildRecentDayOptions, extractJiraKeyFromMessage } from '@/lib/standup-date';
import type { GitLabCommit, GitLabUserMREvent } from '@/services/gitlab';
import type { JiraActivityItem, JiraCreatedIssue, StandupIssueMeta } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';
import type { TempoWorklog } from '@/services/tempo';
import IssueActivityGroup, { type SubItem, type SubTaskSubGroup } from './IssueActivityGroup';
import OtherCommitsGroup from './OtherCommitsGroup';
import StandaloneMrGroup from './StandaloneMrGroup';
import StandupSectionHeader from './StandupSectionHeader';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YesterdayColumnProps {
  tempoEnabled: boolean;
  yesterdayDate: string;
  dateLabel: string;
  /** The schedule-resolved default day (no override). Used to label the first
   *  dropdown row "Yesterday" and to detect when the user reverts to default. */
  resolvedYesterday?: string;
  /** Called with the chosen date string, or null to revert to the resolved default. */
  onSelectDate?: (date: string | null) => void;
  tempoQuery: UseQueryResult<TempoWorklog[], Error>;
  jiraActivityQuery: UseQueryResult<JiraActivityItem[], Error>;
  commitsQuery: UseQueryResult<GitLabCommit[], Error>;
  mrEventsQuery: UseQueryResult<GitLabUserMREvent[], Error>;
  jiraCreatedQuery: UseQueryResult<JiraCreatedIssue[], Error>;
  /** Resolved issue key → metadata map for icons + parent-story rollup grouping. */
  issueMeta: Record<string, StandupIssueMeta>;
  /** Navigate to the issue detail page (threads the breadcrumb trail). */
  onIssueClick: (key: string) => void;
  /** Phase 77 Plan 04 (PEEK-01): clicking the group header body opens the peek panel. */
  onOpenIssue?: (key: string) => void;
  /** Navigate to the MR detail page. Receives "${projectId}/${iid}" string. */
  onMRClick: (projectIdAndIid: string) => void;
  /** True when watching a teammate — drives the commits "name-only match" hint. */
  isWatched?: boolean;
  /** Effective display name — used in the watched-person commits hint. */
  watchedDisplayName?: string | null;
  /** True when the watched person's GitLab account was resolved via user search — suppresses the display-name-only warning. */
  watchedGitlabResolved?: boolean;
}

/** Internal shape of a joined issue group (used for rendering + markdown). */
interface IssueGroup {
  issueKey: string;
  summary: string;
  issueType?: string;
  totalSeconds: number;
  subItems: SubItem[];
  /** Sub-task sub-groups: activity partitioned by originating sub-task key.
   *  Only non-empty sub-tasks appear here; sorted by issueKey ascending. */
  subTaskGroups: SubTaskSubGroup[];
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

/**
 * True for auto-generated merge commits (e.g. "Merge branch 'x' into 'y'",
 * "Merge request !123…", "Merge remote-tracking branch…"). GitLab doesn't
 * return parent_ids here, so detection keys off the conventional title prefix.
 */
function isMergeCommit(commit: GitLabCommit): boolean {
  return /^Merge\b/.test(commit.title);
}

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

/**
 * Format a day-option row label: "Weekday, D Month YYYY".
 *
 * Mirrors StandupNotesPage.formatDateLabel — uses local array lookups, never
 * toLocaleDateString(), per Phase 62 standing rule.
 */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatDayLabel(dateStr: string): string {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const day = parseInt(dayStr, 10);
  const d = new Date(year, month, day);
  const dayName = DAY_NAMES[d.getDay()];
  const monthName = MONTH_NAMES[month];
  return `${dayName}, ${day} ${monthName} ${year}`;
}

// ─── Markdown export ──────────────────────────────────────────────────────────

export interface MarkdownSources {
  tempoData?: TempoWorklog[];
  jiraData?: JiraActivityItem[];
  commitsData?: GitLabCommit[];
  mrEventsData?: GitLabUserMREvent[];
  createdData?: JiraCreatedIssue[];
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
    sources.createdData,
    sources.issueMeta,
  );

  const lines: string[] = [`## ${getColumnHeading(date)} (${date})`, ''];

  for (const group of issueGroups) {
    lines.push(`### ${group.issueKey}: ${group.summary}`);
    for (const item of group.subItems) {
      const text =
        item.kind === 'worklog' && item.description
          ? `${item.label} · ${item.description}`
          : item.label;
      lines.push(`- ${text}`);
    }
    // Nested sub-task sub-groups: 2-space indented sub-task line, 4-space indented items.
    for (const st of group.subTaskGroups) {
      lines.push(`  - ${st.issueKey}: ${st.summary}`);
      for (const item of st.subItems) {
        const text =
          item.kind === 'worklog' && item.description
            ? `${item.label} · ${item.description}`
            : item.label;
        lines.push(`    - ${text}`);
      }
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
  createdData?: JiraCreatedIssue[],
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
      subTaskGroups: [],
    };
    issueMap.set(rollupKey, group);
    return group;
  }

  // 0. Seed created issues first (pass 0) so the "Created" sub-item always
  //    appears as the first entry in each group's insertion order.
  for (const created of createdData ?? []) {
    const group = ensureGroup(created.issueKey, created.summary, created.issueType);
    group.subItems.push({ kind: 'issue-created', label: 'Created', originKey: created.issueKey });
  }

  // 1. Seed from Tempo worklogs. One sub-item per raw worklog entry — duration +
  //    description, no aggregation. The group total (stat line) still sums all seconds.
  for (const worklog of tempoData ?? []) {
    const group = ensureGroup(
      worklog.issue.key,
      worklog.issue.summary,
      worklog.issue.issueType?.name,
    );
    group.totalSeconds += worklog.timeSpentSeconds; // stat line unchanged

    const rollupKey = group.issueKey;
    const originKey = worklog.issue.key;
    group.subItems.push({
      kind: 'worklog',
      label: formatDuration(worklog.timeSpentSeconds),
      description: worklog.comment || undefined,
      // When the worklog issue differs from the group key (subtask rolled up
      // to parent), carry the original key so the row is clickable to the subtask.
      issueKey: originKey !== rollupKey ? originKey : undefined,
      // Tag the origin key for the sub-task partition pass.
      originKey,
    });
  }

  // 2. Add Jira transitions + comments
  for (const activity of jiraData ?? []) {
    const group = ensureGroup(activity.issueKey, activity.summary, activity.issueType);
    const originKey = activity.issueKey;
    if (activity.transitions.length > 0) {
      // Collapse all transitions to a single initial → final sub-item.
      // Sort by `at` ISO timestamp (string comparison is correct for ISO-8601) to
      // determine chronological order — do NOT trust array order from the API.
      const sorted = [...activity.transitions].sort((a, b) =>
        a.at < b.at ? -1 : a.at > b.at ? 1 : 0,
      );
      const initial = sorted[0].fromStatus;
      const final = sorted[sorted.length - 1].toStatus;
      group.subItems.push({
        kind: 'transition',
        // label stays the plain-text markdown source (generateMarkdown reads it) — DO NOT change.
        label: `${initial} → ${final}`,
        originKey,
        // Structured data for the styled pill render (categories drive pill color).
        transition: {
          fromStatus: initial,
          toStatus: final,
          fromCategory: sorted[0].fromCategory,
          toCategory: sorted[sorted.length - 1].toCategory,
        },
      });
    }
    for (const c of activity.comments) {
      const snippet = c.body.length > 80 ? `${c.body.slice(0, 80)}…` : c.body;
      group.subItems.push({ kind: 'jira-comment', label: `Comment: "${snippet}"`, originKey });
    }
  }

  // 3. Route commits by Jira key from message (D-08 message-only; branch deferred D-14)
  //    Commits on a tracked issue are collapsed to a single "N commits" sub-item
  //    per (group, origin) rather than listed individually — one line per origin per group.
  //    Composite key format: "${groupKey}::${originKey}" to track per-subtask counts.
  const commitCountByGroupOrigin = new Map<
    string,
    { groupKey: string; originKey: string; count: number }
  >();
  for (const commit of commitsData ?? []) {
    // Skip merge commits — they're noise in a standup recap, not real work.
    if (isMergeCommit(commit)) continue;
    const key =
      extractJiraKeyFromMessage(commit.message) ?? extractJiraKeyFromMessage(commit.title);
    if (key) {
      const group = ensureGroup(key);
      const compositeKey = `${group.issueKey}::${key}`;
      const existing = commitCountByGroupOrigin.get(compositeKey);
      if (existing) {
        existing.count += 1;
      } else {
        commitCountByGroupOrigin.set(compositeKey, {
          groupKey: group.issueKey,
          originKey: key,
          count: 1,
        });
      }
    } else {
      otherCommits.push(commit);
    }
  }
  for (const { groupKey, originKey, count } of commitCountByGroupOrigin.values()) {
    const group = issueMap.get(groupKey);
    if (!group) continue;
    group.subItems.push({
      kind: 'commit',
      label: `${count} commit${count === 1 ? '' : 's'}`,
      originKey,
    });
  }

  // 4. Route MR events by key extracted from target_title.
  //    Approvals are listed individually; comment events are collapsed into a
  //    per-(group, origin, MR) count (D-05) so a chatty review thread reads
  //    "N comments on <MR name>" instead of one line per comment. Comments must
  //    group on the MR iid (note.noteable_iid) — target_iid is the per-comment
  //    note id and would make every comment look like a separate MR. Labels use
  //    the MR title (its name), not the bare iid, so the recap reads naturally.
  //    Composite key format: "${groupKey}::${originKey}" for per-subtask attribution.
  const keyedCommentCounts = new Map<
    string,
    { originKey: string; perIid: Map<number, { count: number; title: string; projectId: number }> }
  >(); // compositeKey (groupKey::originKey) -> {originKey, perIid}
  for (const event of mrEventsData ?? []) {
    const key = extractJiraKeyFromMessage(event.target_title);
    const isApproval = event.action_name === 'approved';
    const mrIid = event.note?.noteable_iid ?? event.target_iid;
    if (key) {
      const group = ensureGroup(key, event.target_title);
      const originKey = key; // the extracted Jira key is the origin
      if (isApproval) {
        group.subItems.push({
          kind: 'approval',
          label: `Approved ${event.target_title}`,
          mrProjectId: event.project_id,
          mrIid,
          originKey,
        });
      } else {
        const compositeKey = `${group.issueKey}::${originKey}`;
        const bucket = keyedCommentCounts.get(compositeKey) ?? {
          originKey,
          perIid: new Map<number, { count: number; title: string; projectId: number }>(),
        };
        const entry = bucket.perIid.get(mrIid) ?? {
          count: 0,
          title: event.target_title,
          projectId: event.project_id,
        };
        entry.count += 1;
        bucket.perIid.set(mrIid, entry);
        keyedCommentCounts.set(compositeKey, bucket);
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

  // Emit one aggregated MR-comment sub-item per (group, origin, MR): "N comments on <name>"
  for (const [compositeKey, { originKey, perIid }] of keyedCommentCounts) {
    const groupKey = compositeKey.split('::')[0];
    const group = issueMap.get(groupKey);
    if (!group) continue;
    for (const [mrIid, { count, title, projectId }] of perIid) {
      group.subItems.push({
        kind: 'mr-comment',
        label: `${count} comment${count === 1 ? '' : 's'} on ${title}`,
        mrProjectId: projectId,
        mrIid,
        originKey,
      });
    }
  }

  // Partition pass: split each group's subItems into story-level vs per-subtask.
  // An item belongs to a sub-task when: originKey is set, originKey !== group.issueKey,
  // and issueMeta confirms it is a subtask of this group. Everything else is story-level.
  for (const group of issueMap.values()) {
    const storyLevel: SubItem[] = [];
    const bySubtask = new Map<string, SubItem[]>();
    for (const item of group.subItems) {
      const origin = item.originKey;
      const meta = origin ? issueMeta?.[origin] : undefined;
      const belongsToSubtask =
        origin && origin !== group.issueKey && meta?.isSubtask && meta.parentKey === group.issueKey;
      if (belongsToSubtask && origin) {
        const bucket = bySubtask.get(origin) ?? [];
        bucket.push(item);
        bySubtask.set(origin, bucket);
      } else {
        storyLevel.push(item);
      }
    }
    group.subItems = storyLevel;
    group.subTaskGroups = [...bySubtask.entries()]
      .map(([key, subItems]) => ({
        issueKey: key,
        summary: issueMeta?.[key]?.summary ?? key,
        issueType: issueMeta?.[key]?.type,
        subItems,
      }))
      .sort((a, b) => a.issueKey.localeCompare(b.issueKey));
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
  resolvedYesterday = yesterdayDate,
  onSelectDate = () => {},
  tempoQuery,
  jiraActivityQuery,
  commitsQuery,
  mrEventsQuery,
  jiraCreatedQuery,
  issueMeta,
  onIssueClick,
  onOpenIssue,
  onMRClick,
  isWatched = false,
  watchedDisplayName,
  watchedGitlabResolved = false,
}: YesterdayColumnProps) {
  // 14-day calendar option list — most-recent-first.
  // The resolved-default row always carries a tag so it reads as the default:
  // "Yesterday · …" when it genuinely is calendar-yesterday, otherwise
  // "Last working day · …" (e.g. Friday viewed on Monday — "Yesterday" wouldn't
  // be accurate but the row should still announce it's the default). Regular
  // rows show just their date.
  const dayOptions = useMemo(() => {
    const dates = buildRecentDayOptions(14);
    // The resolved default can fall outside the 14-calendar-day window after a
    // long weekend + holiday stretch (resolveYesterdayDate skips up to 14 working
    // iterations). Guarantee it is present so the radio value always matches a row.
    if (resolvedYesterday && !dates.includes(resolvedYesterday)) {
      dates.unshift(resolvedYesterday);
    }
    return dates.map((date) => {
      const dateLabel = formatDayLabel(date);
      if (date !== resolvedYesterday) return { date, label: dateLabel };
      // Default row: date first, then the tag — consistent with regular rows.
      const tag = getColumnHeading(date) === 'Yesterday' ? 'Yesterday' : 'Last working day';
      return { date, label: `${dateLabel} · ${tag}` };
    });
  }, [resolvedYesterday]);

  // Build joined groups in a stable useMemo
  const { issueGroups, standaloneMrGroups, otherCommits } = useMemo(
    () =>
      buildGroups(
        tempoQuery.data,
        jiraActivityQuery.data,
        commitsQuery.data,
        mrEventsQuery.data,
        jiraCreatedQuery.data,
        issueMeta,
      ),
    [
      tempoQuery.data,
      jiraActivityQuery.data,
      commitsQuery.data,
      mrEventsQuery.data,
      jiraCreatedQuery.data,
      issueMeta,
    ],
  );

  // Stat line figures (D-10)
  const totalSeconds = useMemo(
    () => issueGroups.reduce((sum, g) => sum + g.totalSeconds, 0),
    [issueGroups],
  );
  // Count true non-merge commits from the raw source — sub-items now collapse
  // keyed commits into one "N commits" line per group, so they can't be tallied
  // from the rendered groups.
  const commitCount = useMemo(
    () => (commitsQuery.data ?? []).filter((c) => !isMergeCommit(c)).length,
    [commitsQuery.data],
  );
  // Count raw MR events (comments + approvals) — independent of the per-MR
  // comment collapsing so the stat line still reflects true activity volume.
  const mrEventCount = mrEventsQuery.data?.length ?? 0;

  const hasAnyData =
    issueGroups.length > 0 || standaloneMrGroups.length > 0 || otherCommits.length > 0;

  const storyCount = issueGroups.filter((g) => g.totalSeconds > 0).length;

  const hasStatLine = totalSeconds > 0 || commitCount > 0 || mrEventCount > 0;

  // Determine whether all integrations are effectively disabled / empty
  const allIntegrationsDisabledOrEmpty =
    !tempoEnabled &&
    !jiraActivityQuery.data?.length &&
    !commitsQuery.data?.length &&
    !mrEventsQuery.data?.length &&
    !jiraCreatedQuery.data?.length &&
    !jiraActivityQuery.isLoading &&
    !commitsQuery.isLoading &&
    !mrEventsQuery.isLoading &&
    !jiraCreatedQuery.isLoading;

  return (
    <div>
      {/* Column heading — h2 + date label live INSIDE the trigger so the caret
          trails after the date (in empty space) and never shifts the date right. */}
      <div className="mb-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="group/yhead flex items-baseline gap-2 cursor-pointer text-left">
            <h2 className="text-2xl font-semibold">{getColumnHeading(yesterdayDate)}</h2>
            <p className="text-xs text-muted-foreground">{dateLabel}</p>
            <ChevronDown className="size-4 self-center opacity-0 transition-opacity group-hover/yhead:opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" sideOffset={4}>
            <DropdownMenuRadioGroup
              value={yesterdayDate}
              onValueChange={(v) => onSelectDate(v === resolvedYesterday ? null : v)}
            >
              {dayOptions.map((opt) => (
                <DropdownMenuRadioItem key={opt.date} value={opt.date}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Watching a teammate: show a warning when commits are matched by display name only
          (GitLab account not resolved). Suppressed once the user-search lookup succeeds. */}
      {isWatched && !watchedGitlabResolved && (
        <p className="text-xs text-muted-foreground mb-4">
          Commits matched by display name for {watchedDisplayName ?? 'this person'} — may be
          incomplete.
        </p>
      )}

      {/* D-10 Summary stat line — only when at least one source has data */}
      {hasStatLine && (
        <p className="text-xs text-muted-foreground mb-4">
          {formatDuration(totalSeconds)} logged across {storyCount} stor
          {storyCount === 1 ? 'y' : 'ies'} &middot; {commitCount} commit
          {commitCount === 1 ? '' : 's'} &middot; {mrEventCount} MR event
          {mrEventCount === 1 ? '' : 's'}
        </p>
      )}

      {/* Full-column empty state when ALL sources are empty/disabled */}
      {!hasAnyData &&
        !tempoQuery.isLoading &&
        !jiraActivityQuery.isLoading &&
        !commitsQuery.isLoading &&
        !mrEventsQuery.isLoading &&
        !jiraCreatedQuery.isLoading &&
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
        <div className="flex flex-col">
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
                    subTaskGroups={group.subTaskGroups}
                    onClick={() => (onOpenIssue ?? onIssueClick)(group.issueKey)}
                    onIssueKeyClick={() => onIssueClick(group.issueKey)}
                    onIssueClick={onIssueClick}
                    onMRClick={onMRClick}
                    onOpenIssue={onOpenIssue}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Fallback: MR activity that couldn't be matched to a tracked issue */}
          {standaloneMrGroups.length > 0 && (
            <div className="mb-4 pt-4">
              <StandupSectionHeader
                label="Other Merge Requests"
                count={standaloneMrGroups.length}
              />
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

      {/* ── Created issues section ─────────────────────────────────────── */}
      {jiraCreatedQuery.isError ? (
        <div className="mb-3">
          <ErrorState
            error={jiraCreatedQuery.error}
            onRetry={() => void jiraCreatedQuery.refetch()}
            viewName="Created issues"
          />
        </div>
      ) : jiraCreatedQuery.isLoading && !jiraCreatedQuery.data ? (
        <LoadingSkeletons />
      ) : null}
    </div>
  );
}
