/**
 * StandupNotesPage — /standup-notes route (STAND-01 through STAND-06)
 *
 * Owns the 2-column shell (Yesterday left | Today right), four independent
 * data queries, the schedule-aware yesterdayDate derivation, Refresh-all,
 * and the real Copy-markdown handler.
 *
 * T-62-06: jiraToken / gitlabToken MUST NOT appear in any queryKey.
 * Tokens live only inside the queryFn closure via readSecret().
 *
 * Pitfall 2: yesterdayDate is derived from scheduleData via useMemo so
 * Tempo-enabled users get the correct holiday-skip date.
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  extractJiraKeyFromMessage,
  getScheduleLookbackRange,
  resolveYesterdayDate,
} from '@/lib/standup-date';
import { fetchUserCommits, fetchUserMREvents } from '@/services/gitlab';
import { fetchIssueMeta, fetchYesterdayJiraActivity } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { fetchUserSchedule, fetchWorklogs } from '@/services/tempo';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import StandupPageHeader from './StandupPageHeader';
import TodayColumnPlaceholder from './TodayColumnPlaceholder';
import YesterdayColumn, { generateMarkdown } from './YesterdayColumn';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

/**
 * Formats a YYYY-MM-DD date string as "Weekday, D Month YYYY".
 *
 * Uses explicit array lookups — never toLocaleDateString() — per Phase 62
 * standing rule (TZ-independent date formatting).
 */
function formatDateLabel(dateStr: string): string {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const day = parseInt(dayStr, 10);
  const d = new Date(year, month, day);
  const dayName = DAY_NAMES[d.getDay()];
  const monthName = MONTH_NAMES[month];
  return `${dayName}, ${day} ${monthName} ${year}`;
}

/**
 * Compute the "synced X minutes ago" label from the earliest lastUpdated timestamp
 * across the four queries. Returns null when no query has loaded yet.
 */
function computeSyncedMinutesAgo(timestamps: (Date | undefined)[]): number | null {
  const valid = timestamps.filter((t): t is Date => t != null);
  if (valid.length === 0) return null;
  const earliest = new Date(Math.min(...valid.map((t) => t.getTime())));
  const diffMs = Date.now() - earliest.getTime();
  return Math.floor(diffMs / 60_000);
}

export default function StandupNotesPage() {
  const {
    jiraBaseUrl,
    gitlabBaseUrl,
    activeJiraProject,
    activeGitlabProject,
    jiraUsername,
    jiraUserKey,
    gitlabUserId,
    gitlabUsername,
  } = useAuthStore();

  // IN-01: fine-grained selector — never destructure the whole settings store
  const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);

  // Issue navigation (full-page detail + breadcrumb trail) from the app shell.
  const { onIssueClick } = useOutletContext<{ onIssueClick: (key: string) => void }>();

  // ─ Token loading (Pattern 2) ─────────────────────────────────────────────
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const [gitlabToken, setGitlabToken] = useState<string | null>(null);

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => setJiraToken(t))
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  useEffect(() => {
    if (gitlabBaseUrl) {
      readSecret('gitlab-pat')
        .then((t) => setGitlabToken(t))
        .catch(() => setGitlabToken(null));
    }
  }, [gitlabBaseUrl]);

  // ─ Tempo schedule query (runs first; drives yesterdayDate) ───────────────
  // T-62-06: jiraToken NOT in queryKey
  const { data: scheduleData } = useQuery({
    queryKey: ['standup', 'schedule', jiraBaseUrl, jiraUserKey ?? ''],
    queryFn: () =>
      fetchUserSchedule(
        jiraBaseUrl!,
        jiraToken!,
        getScheduleLookbackRange().from,
        getScheduleLookbackRange().to,
        jiraUserKey!,
      ),
    enabled: !!jiraBaseUrl && !!jiraToken && !!jiraUserKey && tempoEnabled,
    staleTime: 24 * 60 * 60 * 1000,
  });

  // ─ Yesterday date (Pitfall 2: memo on scheduleData) ─────────────────────
  const yesterdayDate = useMemo(
    () => resolveYesterdayDate(scheduleData ?? undefined),
    [scheduleData],
  );
  const dateLabel = useMemo(() => formatDateLabel(yesterdayDate), [yesterdayDate]);

  // ─ Four independent data queries (Pattern 3) ────────────────────────────
  // T-62-06: tokens NEVER in queryKey — they are read inside queryFn only.

  const tempoQuery = useQuery({
    queryKey: ['standup', 'tempo', jiraBaseUrl, yesterdayDate, jiraUsername ?? ''],
    queryFn: () =>
      fetchWorklogs(jiraBaseUrl!, jiraToken!, [jiraUsername!], yesterdayDate, yesterdayDate),
    enabled: !!jiraBaseUrl && !!jiraToken && tempoEnabled && !!jiraUsername && !!yesterdayDate,
    staleTime: 5 * 60 * 1000,
  });

  const jiraActivityQuery = useQuery({
    queryKey: [
      'standup',
      'jira',
      jiraBaseUrl,
      activeJiraProject,
      yesterdayDate,
      jiraUsername ?? '',
    ],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No Jira token');
      return fetchYesterdayJiraActivity(
        jiraBaseUrl!,
        token,
        activeJiraProject!,
        yesterdayDate,
        jiraUsername!,
      );
    },
    enabled:
      !!jiraBaseUrl && !!jiraToken && !!activeJiraProject && !!jiraUsername && !!yesterdayDate,
    staleTime: 5 * 60 * 1000,
  });

  const commitsQuery = useQuery({
    queryKey: [
      'standup',
      'commits',
      gitlabBaseUrl,
      activeGitlabProject,
      yesterdayDate,
      gitlabUsername ?? '',
    ],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token) throw new Error('No GitLab token');
      return fetchUserCommits(
        gitlabBaseUrl!,
        token,
        activeGitlabProject!,
        yesterdayDate,
        gitlabUsername!,
      );
    },
    enabled:
      !!gitlabBaseUrl &&
      !!gitlabToken &&
      !!activeGitlabProject &&
      !!gitlabUsername &&
      !!yesterdayDate,
    staleTime: 5 * 60 * 1000,
  });

  const mrEventsQuery = useQuery({
    queryKey: ['standup', 'mr-events', gitlabBaseUrl, gitlabUserId, yesterdayDate],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token) throw new Error('No GitLab token');
      return fetchUserMREvents(gitlabBaseUrl!, token, gitlabUserId!, yesterdayDate);
    },
    enabled: !!gitlabBaseUrl && !!gitlabToken && !!gitlabUserId && !!yesterdayDate,
    staleTime: 5 * 60 * 1000,
  });

  // ─ Issue type resolution ─────────────────────────────────────────────────
  // Issues that surface only via commits or MR activity carry a Jira key but no
  // type metadata, so their icons would fall back to the default. Resolve the
  // type for every referenced key in one batch so all groups render correctly.
  const referencedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const w of tempoQuery.data ?? []) keys.add(w.issue.key);
    for (const a of jiraActivityQuery.data ?? []) keys.add(a.issueKey);
    for (const c of commitsQuery.data ?? []) {
      const k = extractJiraKeyFromMessage(c.message) ?? extractJiraKeyFromMessage(c.title);
      if (k) keys.add(k);
    }
    for (const e of mrEventsQuery.data ?? []) {
      const k = extractJiraKeyFromMessage(e.target_title);
      if (k) keys.add(k);
    }
    return [...keys].sort();
  }, [tempoQuery.data, jiraActivityQuery.data, commitsQuery.data, mrEventsQuery.data]);

  const issueMetaQuery = useQuery({
    queryKey: ['standup', 'issue-meta', jiraBaseUrl, referencedKeys],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No Jira token');
      return fetchIssueMeta(jiraBaseUrl!, token, referencedKeys);
    },
    enabled: !!jiraBaseUrl && !!jiraToken && referencedKeys.length > 0,
    staleTime: 60 * 60 * 1000,
  });

  // ─ Refresh-all (stale data stays visible during refetch — no skeleton flash) ─
  function handleRefresh() {
    void tempoQuery.refetch();
    void jiraActivityQuery.refetch();
    void commitsQuery.refetch();
    void mrEventsQuery.refetch();
  }

  // ─ "synced Xm ago" — earliest dataUpdatedAt across all four loaded queries ─
  const syncedMinutesAgo = useMemo(() => {
    return computeSyncedMinutesAgo([
      tempoQuery.dataUpdatedAt ? new Date(tempoQuery.dataUpdatedAt) : undefined,
      jiraActivityQuery.dataUpdatedAt ? new Date(jiraActivityQuery.dataUpdatedAt) : undefined,
      commitsQuery.dataUpdatedAt ? new Date(commitsQuery.dataUpdatedAt) : undefined,
      mrEventsQuery.dataUpdatedAt ? new Date(mrEventsQuery.dataUpdatedAt) : undefined,
    ]);
  }, [
    tempoQuery.dataUpdatedAt,
    jiraActivityQuery.dataUpdatedAt,
    commitsQuery.dataUpdatedAt,
    mrEventsQuery.dataUpdatedAt,
  ]);

  // ─ Copy markdown ──────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);

  function handleCopyMarkdown() {
    // Build the markdown from the YesterdayColumn's current group state.
    // generateMarkdown is exported from YesterdayColumn and used here.
    const text = generateMarkdown(
      {
        tempoData: tempoQuery.data,
        jiraData: jiraActivityQuery.data,
        commitsData: commitsQuery.data,
        mrEventsData: mrEventsQuery.data,
        issueMeta: issueMetaQuery.data,
      },
      yesterdayDate,
    );
    navigator.clipboard.writeText(text).catch(() => {
      // Silent fallback — clipboard unavailable (unlikely in Tauri webview).
    });
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  return (
    <div className="flex flex-col h-full">
      <StandupPageHeader
        dateLabel={dateLabel}
        syncedMinutesAgo={syncedMinutesAgo}
        onRefresh={handleRefresh}
        onCopyMarkdown={handleCopyMarkdown}
        copied={copied}
      />

      {/* Two-column body: Yesterday (left) | Today (right) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left column — Yesterday recap (50%) */}
        <div className="w-1/2 overflow-auto border-r border-border px-6 py-4">
          <YesterdayColumn
            tempoEnabled={tempoEnabled}
            yesterdayDate={yesterdayDate}
            dateLabel={dateLabel}
            tempoQuery={tempoQuery}
            jiraActivityQuery={jiraActivityQuery}
            commitsQuery={commitsQuery}
            mrEventsQuery={mrEventsQuery}
            issueMeta={issueMetaQuery.data ?? {}}
            onIssueClick={onIssueClick}
          />
        </div>

        {/* Right column — Today placeholder (50%) */}
        <div className="w-1/2 overflow-auto">
          <TodayColumnPlaceholder />
        </div>
      </div>
    </div>
  );
}
