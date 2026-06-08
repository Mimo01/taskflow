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

import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  extractJiraKeyFromMessage,
  getScheduleLookbackRange,
  resolveYesterdayDate,
} from '@/lib/standup-date';
import type { GitLabMR, ParticipatedMR } from '@/services/gitlab';
import {
  fetchGitLabUsers,
  fetchUserCommits,
  fetchUserMREvents,
  validateGitLab,
} from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import {
  fetchIssueMeta,
  fetchYesterdayCreatedIssues,
  fetchYesterdayJiraActivity,
} from '@/services/jira';
import type { JiraAssignableUser } from '@/services/jira/types';
import { readSecret } from '@/services/stronghold';
import { fetchUserSchedule, fetchWorklogs } from '@/services/tempo';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { resolveEffectiveIdentity } from './effectiveIdentity';
import StandupPageHeader from './StandupPageHeader';
import TodayColumn, { generateTodayMarkdown, todayQueryKeys } from './TodayColumn';
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
  // Guard malformed/empty input (e.g. yesterdayDate before schedule resolves) so
  // we render the raw string instead of "undefined, NaN undefined NaN".
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return dateStr;
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
    gitlabName,
    gitlabEmail,
    setGitlabName,
    setGitlabEmail,
  } = useAuthStore();

  // IN-01: fine-grained selectors — never destructure the whole settings store
  const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);
  const storyPointsFieldKey = useSettingsStore((s) => s.storyPointsFieldKey);

  // Phase 68 rule: fine-grained selector for display name
  const jiraUserDisplayName = useAuthStore((s) => s.jiraUserDisplayName);
  const jiraUserAvatarUrl = useAuthStore((s) => s.jiraUserAvatarUrl);

  // ─ Watched person (transient — reset on every mount, never persisted) ─────
  // null = the logged-in user (default, unchanged behavior).
  const [watchedUser, setWatchedUser] = useState<JiraAssignableUser | null>(null);

  // Effective identity threaded through every page query key + props. For a
  // watched person this forces gitlabUserId/Username/Email to null so the
  // GitLab-ID-keyed sections disable instead of showing my own MRs (Pitfall 3).
  const id = useMemo(
    () =>
      resolveEffectiveIdentity(
        {
          jiraUsername,
          jiraUserKey,
          jiraUserDisplayName,
          gitlabUserId,
          gitlabUsername,
          gitlabName,
          gitlabEmail,
        },
        watchedUser,
      ),
    [
      jiraUsername,
      jiraUserKey,
      jiraUserDisplayName,
      gitlabUserId,
      gitlabUsername,
      gitlabName,
      gitlabEmail,
      watchedUser,
    ],
  );

  const queryClient = useQueryClient();

  // TZ-safe today date (same logic as TodayColumn — Phase 62 standing rule)
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Issue + MR navigation from the app shell.
  const { onIssueClick, onOpenIssue, onMRClick } = useOutletContext<{
    onIssueClick: (key: string) => void;
    onOpenIssue: (key: string) => void;
    onMRClick: (projectIdAndIid: string) => void;
  }>();

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

  // When watching another person, resolve their full GitLab identity via a user
  // search so commit and MR matching uses all three vectors (id, username, email)
  // instead of just a display-name equality guess.
  // Pitfall 3 guard is preserved: if the lookup returns no results, resolvedId
  // still has null GitLab fields — we never fall back to the logged-in user's identity.
  const watchedGitlabUserQuery = useQuery({
    queryKey: [
      'standup',
      'gitlab-user-search',
      gitlabBaseUrl,
      id.jiraUserDisplayName ?? '',
    ],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token) throw new Error('No GitLab token');
      return fetchGitLabUsers(gitlabBaseUrl ?? '', token, id.jiraUserDisplayName ?? '');
    },
    enabled: id.isWatched && !!id.jiraUserDisplayName && !!gitlabBaseUrl && !!gitlabToken,
    staleTime: 24 * 60 * 60 * 1000,
  });

  // All GitLab accounts to use for commit matching.
  // Prefers exact display-name matches (catches multiple accounts belonging to the same
  // person). Falls back to all search results when no exact match exists — any GitLab
  // result is more precise than matching by Jira display name alone. Returns null only
  // when the search returns nothing at all.
  const resolvedGitlabUsers = useMemo(() => {
    if (!id.isWatched) return null;
    const results = watchedGitlabUserQuery.data;
    if (!results || results.length === 0) return null;
    const displayName = (id.jiraUserDisplayName ?? '').toLowerCase();
    const exact = results.filter((u) => u.name.toLowerCase() === displayName);
    return exact.length > 0 ? exact : results;
  }, [id.isWatched, id.jiraUserDisplayName, watchedGitlabUserQuery.data]);

  // Best-match single account — used for mrEventsQuery (needs a numeric user id)
  // and as the resolved identity for the "not matched" hint.
  const resolvedId = useMemo(() => {
    if (!id.isWatched) return id;
    const results = watchedGitlabUserQuery.data;
    if (!results || results.length === 0) return id;
    const displayName = (id.jiraUserDisplayName ?? '').toLowerCase();
    const match = results.find((u) => u.name.toLowerCase() === displayName) ?? results[0];
    return {
      ...id,
      gitlabUserId: match.id,
      gitlabUsername: match.username,
      gitlabName: match.name,
      gitlabEmail: match.email,
    };
  }, [id, watchedGitlabUserQuery.data]);

  // Stable key for the commits query that changes whenever the set of resolved accounts changes.
  const resolvedAccountsKey = useMemo(
    () => resolvedGitlabUsers?.map((u) => u.username).sort().join(',') ?? '',
    [resolvedGitlabUsers],
  );

  // Backfill gitlabName/gitlabEmail for users who connected before these were
  // persisted. Commit author matching needs the display name and email (git
  // author_name/author_email), which the login username does not provide. Self-heal
  // once per mount instead of forcing a settings re-save. Ref-guarded because
  // gitlabEmail can legitimately be null (scope/visibility) — without the guard the
  // missing-email condition would re-trigger validation on every render.
  const gitlabBackfilledRef = useRef(false);
  useEffect(() => {
    if (gitlabBackfilledRef.current) return;
    if (gitlabBaseUrl && gitlabToken && (!gitlabName || !gitlabEmail)) {
      gitlabBackfilledRef.current = true;
      validateGitLab(gitlabBaseUrl, gitlabToken)
        .then((user) => {
          if (user.name) setGitlabName(user.name);
          if (user.email) setGitlabEmail(user.email);
        })
        .catch(() => {
          gitlabBackfilledRef.current = false; // allow retry on a later mount
        });
    }
  }, [gitlabBaseUrl, gitlabToken, gitlabName, gitlabEmail, setGitlabName, setGitlabEmail]);

  // ─ Tempo schedule query (runs first; drives yesterdayDate) ───────────────
  // T-62-06: jiraToken NOT in queryKey
  const { data: scheduleData } = useQuery({
    queryKey: ['standup', 'schedule', jiraBaseUrl, id.jiraUserKey ?? ''],
    queryFn: () => {
      // Resolve the lookback window once and reuse from/to.
      const { from, to } = getScheduleLookbackRange();
      return fetchUserSchedule(jiraBaseUrl ?? '', jiraToken ?? '', from, to, id.jiraUserKey ?? '');
    },
    enabled: !!jiraBaseUrl && !!jiraToken && !!id.jiraUserKey && tempoEnabled,
    staleTime: 24 * 60 * 60 * 1000,
  });

  // ─ Yesterday date (Pitfall 2: memo on scheduleData) ─────────────────────
  // dateOverride: window-session only (React state, never persisted).
  // Selecting a day sets the override; selecting the resolved default clears it.
  const [dateOverride, setDateOverride] = useState<string | null>(null);
  const resolvedYesterday = useMemo(
    () => resolveYesterdayDate(scheduleData ?? undefined),
    [scheduleData],
  );
  const yesterdayDate = dateOverride ?? resolvedYesterday;
  const dateLabel = useMemo(() => formatDateLabel(yesterdayDate), [yesterdayDate]);
  const todayLabel = useMemo(() => formatDateLabel(todayStr), [todayStr]);

  // ─ Four independent data queries (Pattern 3) ────────────────────────────
  // T-62-06: tokens NEVER in queryKey — they are read inside queryFn only.

  const tempoQuery = useQuery({
    queryKey: ['standup', 'tempo', jiraBaseUrl, yesterdayDate, id.jiraUsername ?? ''],
    queryFn: () =>
      fetchWorklogs(
        jiraBaseUrl ?? '',
        jiraToken ?? '',
        [id.jiraUsername ?? ''],
        yesterdayDate,
        yesterdayDate,
      ),
    enabled: !!jiraBaseUrl && !!jiraToken && tempoEnabled && !!id.jiraUsername && !!yesterdayDate,
    staleTime: 5 * 60 * 1000,
  });

  const jiraActivityQuery = useQuery({
    queryKey: [
      'standup',
      'jira',
      jiraBaseUrl,
      activeJiraProject,
      yesterdayDate,
      id.jiraUsername ?? '',
    ],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No Jira token');
      return fetchYesterdayJiraActivity(
        jiraBaseUrl ?? '',
        token,
        activeJiraProject ?? '',
        yesterdayDate,
        id.jiraUsername ?? '',
      );
    },
    enabled:
      !!jiraBaseUrl && !!jiraToken && !!activeJiraProject && !!id.jiraUsername && !!yesterdayDate,
    staleTime: 5 * 60 * 1000,
  });

  const jiraCreatedQuery = useQuery({
    queryKey: [
      'standup',
      'jira-created',
      jiraBaseUrl,
      activeJiraProject,
      yesterdayDate,
      id.jiraUsername ?? '',
    ],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No Jira token');
      return fetchYesterdayCreatedIssues(
        jiraBaseUrl ?? '',
        token,
        activeJiraProject ?? '',
        yesterdayDate,
        id.jiraUsername ?? '',
      );
    },
    enabled:
      !!jiraBaseUrl && !!jiraToken && !!activeJiraProject && !!id.jiraUsername && !!yesterdayDate,
    staleTime: 5 * 60 * 1000,
  });

  const commitsQuery = useQuery({
    queryKey: [
      'standup',
      'commits',
      gitlabBaseUrl,
      activeGitlabProject,
      yesterdayDate,
      // For a watched person this covers all resolved accounts; for self it's the single identity.
      resolvedAccountsKey || resolvedId.gitlabUsername || resolvedId.gitlabName || '',
    ],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token) throw new Error('No GitLab token');
      // When all accounts are resolved, pass arrays so every account is matched.
      // For the self-user case (not watched) resolvedGitlabUsers is null — use single values.
      const usernames = resolvedGitlabUsers
        ? resolvedGitlabUsers.map((u) => u.username)
        : [resolvedId.gitlabUsername ?? ''];
      // Always include the Jira display name alongside GitLab profile names — someone's
      // git config may match their Jira name but not their GitLab profile name exactly.
      const names = resolvedGitlabUsers
        ? [...resolvedGitlabUsers.map((u) => u.name), id.jiraUserDisplayName].filter(
            (n): n is string => !!n,
          )
        : [resolvedId.gitlabName ?? ''];
      const emails = resolvedGitlabUsers
        ? resolvedGitlabUsers.map((u) => u.email)
        : [resolvedId.gitlabEmail];
      return fetchUserCommits(
        gitlabBaseUrl ?? '',
        token,
        activeGitlabProject ?? 0,
        yesterdayDate,
        usernames,
        names,
        emails,
      );
    },
    enabled:
      !!gitlabBaseUrl &&
      !!gitlabToken &&
      !!activeGitlabProject &&
      !!yesterdayDate &&
      (!!resolvedId.gitlabUsername || !!resolvedId.gitlabName),
    staleTime: 5 * 60 * 1000,
  });

  const mrEventsQuery = useQuery({
    queryKey: ['standup', 'mr-events', gitlabBaseUrl, resolvedId.gitlabUserId, yesterdayDate],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token) throw new Error('No GitLab token');
      return fetchUserMREvents(
        gitlabBaseUrl ?? '',
        token,
        resolvedId.gitlabUserId ?? 0,
        yesterdayDate,
      );
    },
    // resolvedId.gitlabUserId is null until the GitLab user lookup resolves — this
    // disables until we have a real id (Pitfall 3: never fall back to logged-in user).
    enabled: !!gitlabBaseUrl && !!gitlabToken && !!resolvedId.gitlabUserId && !!yesterdayDate,
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
    for (const c of jiraCreatedQuery.data ?? []) keys.add(c.issueKey);
    for (const c of commitsQuery.data ?? []) {
      const k = extractJiraKeyFromMessage(c.message) ?? extractJiraKeyFromMessage(c.title);
      if (k) keys.add(k);
    }
    for (const e of mrEventsQuery.data ?? []) {
      const k = extractJiraKeyFromMessage(e.target_title);
      if (k) keys.add(k);
    }
    return [...keys].sort();
  }, [
    tempoQuery.data,
    jiraActivityQuery.data,
    jiraCreatedQuery.data,
    commitsQuery.data,
    mrEventsQuery.data,
  ]);

  const issueMetaQuery = useQuery({
    queryKey: ['standup', 'issue-meta', jiraBaseUrl, referencedKeys],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No Jira token');
      return fetchIssueMeta(jiraBaseUrl ?? '', token, referencedKeys);
    },
    enabled: !!jiraBaseUrl && !!jiraToken && referencedKeys.length > 0,
    staleTime: 60 * 60 * 1000,
  });

  // ─ Refresh-all ────────────────────────────────────────────────────────────
  // Invalidates all active standup queries (both yesterday and today columns) plus
  // the sprint query owned by TodayColumn which uses the 'jira-issues' prefix.
  // Using invalidateQueries rather than individual .refetch() calls ensures
  // TodayColumn's internally-owned queries are also triggered.
  function handleRefresh() {
    void queryClient.refetchQueries({ queryKey: ['standup'], type: 'active' });
    void queryClient.refetchQueries({
      queryKey: ['jira-issues', 'sprint-board-today-full'],
      type: 'active',
    });
  }

  // Spinner/disable feedback while a refresh is in flight (both standup + today sprint queries)
  const standupFetching = useIsFetching({ queryKey: ['standup'] });
  const sprintFetching = useIsFetching({ queryKey: ['jira-issues', 'sprint-board-today-full'] });
  const isRefreshing = standupFetching + sprintFetching > 0;

  // ─ "synced Xm ago" — earliest dataUpdatedAt across all five loaded queries ─
  const syncedMinutesAgo = useMemo(() => {
    return computeSyncedMinutesAgo([
      tempoQuery.dataUpdatedAt ? new Date(tempoQuery.dataUpdatedAt) : undefined,
      jiraActivityQuery.dataUpdatedAt ? new Date(jiraActivityQuery.dataUpdatedAt) : undefined,
      jiraCreatedQuery.dataUpdatedAt ? new Date(jiraCreatedQuery.dataUpdatedAt) : undefined,
      commitsQuery.dataUpdatedAt ? new Date(commitsQuery.dataUpdatedAt) : undefined,
      mrEventsQuery.dataUpdatedAt ? new Date(mrEventsQuery.dataUpdatedAt) : undefined,
    ]);
  }, [
    tempoQuery.dataUpdatedAt,
    jiraActivityQuery.dataUpdatedAt,
    jiraCreatedQuery.dataUpdatedAt,
    commitsQuery.dataUpdatedAt,
    mrEventsQuery.dataUpdatedAt,
  ]);

  // ─ Copy markdown ──────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  function handleCopyMarkdown() {
    const yesterdayText = generateMarkdown(
      {
        tempoData: tempoQuery.data,
        jiraData: jiraActivityQuery.data,
        commitsData: commitsQuery.data,
        mrEventsData: mrEventsQuery.data,
        createdData: jiraCreatedQuery.data,
        issueMeta: issueMetaQuery.data,
      },
      yesterdayDate,
    );

    // Read today's data from TanStack Query cache (populated by TodayColumn's queries).
    const todayText = generateTodayMarkdown(
      {
        sprintData: queryClient.getQueryData<JiraIssue[]>(
          todayQueryKeys.sprint(activeJiraProject, storyPointsFieldKey),
        ),
        reviewerMrsData: queryClient.getQueryData<GitLabMR[]>(
          todayQueryKeys.reviewerMrs(gitlabBaseUrl, id.gitlabUserId),
        ),
        participatingMrsData: queryClient.getQueryData<ParticipatedMR[]>(
          todayQueryKeys.participatingMrs(gitlabBaseUrl, id.gitlabUserId),
        ),
        jiraUserDisplayName: id.jiraUserDisplayName,
      },
      todayStr,
    );

    // Only flash "Copied!" once the write actually resolves — a rejected clipboard
    // (unavailable in the webview) must not show a false success.
    navigator.clipboard
      .writeText(`${yesterdayText}\n\n${todayText}`)
      .then(() => {
        setCopied(true);
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => {
          setCopied(false);
          copiedTimer.current = null;
        }, 2000);
      })
      .catch(() => {
        // Clipboard unavailable — leave the button in its idle state.
      });
  }

  return (
    <div className="flex flex-col h-full">
      <StandupPageHeader
        dateLabel={todayLabel}
        syncedMinutesAgo={syncedMinutesAgo}
        onRefresh={handleRefresh}
        onCopyMarkdown={handleCopyMarkdown}
        copied={copied}
        isRefreshing={isRefreshing}
        watchedUser={watchedUser}
        meDisplayName={jiraUserDisplayName ?? 'Me'}
        meAvatarUrl={jiraUserAvatarUrl}
        jiraBaseUrl={jiraBaseUrl ?? ''}
        projectKey={activeJiraProject}
        onSelectWatched={setWatchedUser}
      />

      {/* Two-column body: Yesterday (left) | Today (right) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left column — Yesterday recap (50%) */}
        <div className="w-1/2 overflow-auto border-r border-border px-6 py-4">
          <YesterdayColumn
            tempoEnabled={tempoEnabled}
            yesterdayDate={yesterdayDate}
            dateLabel={dateLabel}
            resolvedYesterday={resolvedYesterday}
            onSelectDate={(date: string | null) => setDateOverride(date)}
            tempoQuery={tempoQuery}
            jiraActivityQuery={jiraActivityQuery}
            commitsQuery={commitsQuery}
            mrEventsQuery={mrEventsQuery}
            jiraCreatedQuery={jiraCreatedQuery}
            issueMeta={issueMetaQuery.data ?? {}}
            onIssueClick={onIssueClick}
            onOpenIssue={onOpenIssue}
            onMRClick={onMRClick}
            isWatched={id.isWatched}
            watchedDisplayName={id.jiraUserDisplayName}
            watchedGitlabResolved={id.isWatched && resolvedId.gitlabUserId !== null}
          />
        </div>

        {/* Right column — Today (50%) */}
        <div className="w-1/2 overflow-auto">
          <TodayColumn
            onIssueClick={onIssueClick}
            onOpenIssue={onOpenIssue}
            onMRClick={onMRClick}
            watchedGitlabUserId={resolvedId.gitlabUserId}
            watchedDisplayName={id.jiraUserDisplayName}
            isWatched={id.isWatched}
          />
        </div>
      </div>
    </div>
  );
}
