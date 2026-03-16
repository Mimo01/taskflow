/**
 * Notifications service — delta polling for Jira comment mentions and GitLab MR notes,
 * plus OS desktop notification dispatch via tauri-plugin-notification.
 *
 * All HTTP calls use `apiFetch` (instrumented wrapper around @tauri-apps/plugin-http fetch)
 * to avoid CORS issues in Tauri 2 webview and to capture calls in the debug log.
 *
 * API key links:
 *  - Jira: JQL comment ~ displayName + client-side cursor filtering
 *  - GitLab: Per-MR notes endpoint, client-side cursor + system/own-note filtering
 */
import { apiFetch } from '../lib/apiFetch';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import type { GitLabMR } from './gitlab';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationItem {
  id: string;            // 'jira-comment-{id}' | 'gitlab-note-{id}'
  source: 'jira' | 'gitlab';
  entityTitle: string;   // "PROJ-123: Fix login bug"
  author: string;        // "J.Smith"
  bodyPreview: string;   // first ~80 chars of body
  fullBody: string;
  createdAt: string;     // ISO 8601
  url?: string;              // browser-openable URL for the entity
  notificationType?: 'comment-mention' | 'issue-update' | 'mr-note';
  priority?: string;         // Jira: "High" / "Medium" / "Low" etc.
  labels?: string[];         // Jira: issue label names
  entityState?: string;      // GitLab: "opened" | "merged" | "closed"
}

// ─── Jira Comment Fetcher ─────────────────────────────────────────────────────

/**
 * Fetch Jira notifications newer than lastSeenCursor for the current user.
 *
 * Strategy: Two parallel JQL queries via Promise.allSettled.
 *
 * Query A (issue updates — assignee/reporter/watcher):
 *   Returns recently-updated issues where the user has a stake. Each issue
 *   becomes one NotificationItem with id `jira-issue-{key}-{updated}`.
 *   Skipped when username is null (no identity to filter on).
 *
 * Query B (comment mentions — backwards-compat):
 *   JQL finds issues with comments mentioning the user. Client-side filtering
 *   extracts only comments newer than the cursor and containing [~username] or
 *   @displayName. Each comment becomes one NotificationItem with id
 *   `jira-comment-{commentId}`.
 *   Skipped when both displayName and username are null.
 *
 * Deduplication is handled by the caller (fetchNewNotifications seen Set).
 */
async function fetchNewJiraComments(
  baseUrl: string,
  token: string,
  projectKey: string,
  displayName: string | null,
  username: string | null,
  lastSeenCursor: string | null,
): Promise<NotificationItem[]> {
  if (!displayName && !username) return [];

  const since = lastSeenCursor ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // JQL requires "YYYY-MM-DD HH:mm" format (no seconds, space not T)
  const sinceJql = since.substring(0, 16).replace('T', ' ');
  const base = baseUrl.replace(/\/$/, '');

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // ── Query A: issue updates (assignee / reporter / watcher) ──────────────────
  async function fetchIssueUpdates(): Promise<NotificationItem[]> {
    if (!username) return [];

    const jql =
      `project = ${projectKey}` +
      ` AND (assignee = "${username}" OR reporter = "${username}" OR watcher = "${username}")` +
      ` AND updatedDate >= "${sinceJql}"` +
      ` ORDER BY updated DESC`;
    const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,status,assignee,reporter,updated,priority,labels&expand=changelog&maxResults=20`;

    let response: Response;
    try {
      response = await apiFetch('jira', url, { headers });
    } catch {
      return [];
    }
    if (!response.ok) return [];

    const data = await response.json();
    const issues: unknown[] = data.issues ?? [];
    const results: NotificationItem[] = [];

    for (const rawIssue of issues) {
      const issue = rawIssue as {
        key: string;
        fields: {
          summary: string;
          status?: { name: string };
          assignee?: { displayName: string } | null;
          reporter?: { displayName: string } | null;
          updated: string;
          priority?: { name: string } | null;
          labels?: string[];
        };
        changelog?: {
          histories: Array<{
            created: string;
            author: { displayName: string };
            items: Array<{
              field: string;
              fromString: string | null;
              toString: string | null;
            }>;
          }>;
        };
      };

      // Extract changelog entries within the polling window
      const changeLines: string[] = [];
      let changeAuthor: string | undefined;
      const histories = issue.changelog?.histories ?? [];
      for (const history of histories) {
        if (history.created <= since) continue;
        for (const item of history.items) {
          if (item.field === 'status') {
            changeLines.push(`Status: ${item.fromString ?? '(none)'} \u2192 ${item.toString ?? '(none)'}`);
            changeAuthor = changeAuthor ?? history.author.displayName;
          } else if (item.field === 'assignee') {
            changeLines.push(`Assignee: ${item.fromString || '(none)'} \u2192 ${item.toString || '(none)'}`);
            changeAuthor = changeAuthor ?? history.author.displayName;
          }
        }
      }

      const statusName = issue.fields.status?.name ?? 'Unknown';
      const fallbackAuthor =
        issue.fields.assignee?.displayName ??
        issue.fields.reporter?.displayName ??
        'Unknown';

      const bodyPreview = changeLines.length > 0
        ? changeLines.join(' | ').substring(0, 120)
        : `Status: ${statusName}`;
      const fullBody = changeLines.length > 0
        ? changeLines.join('\n')
        : `Status: ${statusName}`;
      const author = changeAuthor ?? fallbackAuthor;

      results.push({
        id: `jira-issue-${issue.key}-${issue.fields.updated}`,
        source: 'jira',
        entityTitle: `${issue.key}: ${issue.fields.summary}`,
        author,
        bodyPreview,
        fullBody,
        createdAt: issue.fields.updated,
        url: `${base}/browse/${issue.key}`,
        notificationType: 'issue-update',
        priority: issue.fields.priority?.name,
        labels: issue.fields.labels ?? [],
        entityState: undefined,
      });
    }

    return results;
  }

  // ── Query B: comment mentions (original logic) ──────────────────────────────
  async function fetchCommentMentions(): Promise<NotificationItem[]> {
    const mentionTarget = displayName ?? username ?? '';
    const jql = `project = ${projectKey} AND comment ~ "${mentionTarget}" AND updatedDate >= "${sinceJql}" ORDER BY updated DESC`;
    const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,comment&maxResults=20`;

    let response: Response;
    try {
      response = await apiFetch('jira', url, { headers });
    } catch {
      return [];
    }
    if (!response.ok) return [];

    const data = await response.json();
    const issues: unknown[] = data.issues ?? [];
    const results: NotificationItem[] = [];

    for (const rawIssue of issues) {
      const issue = rawIssue as {
        key: string;
        fields: {
          summary: string;
          comment?: { comments: Array<{
            id: string;
            author?: { displayName?: string };
            body?: string;
            updated: string;
            created: string;
          }> };
        };
      };

      const comments = issue.fields?.comment?.comments ?? [];
      for (const comment of comments) {
        // Client-side cursor filter
        if (comment.updated <= since) continue;

        // Must mention the current user (Jira uses [~username] or @displayName)
        const body: string = comment.body ?? '';
        const mentionedByUsername = username && body.includes(`[~${username}]`);
        const mentionedByDisplayName = displayName && body.includes(`@${displayName}`);
        if (!mentionedByUsername && !mentionedByDisplayName) continue;

        results.push({
          id: `jira-comment-${comment.id}`,
          source: 'jira',
          entityTitle: `${issue.key}: ${issue.fields.summary}`,
          author: comment.author?.displayName ?? 'Unknown',
          bodyPreview: body.substring(0, 80),
          fullBody: body,
          createdAt: comment.created,
          url: `${base}/browse/${issue.key}`,
          notificationType: 'comment-mention',
          priority: undefined,
          labels: undefined,
          entityState: undefined,
        });
      }
    }

    return results;
  }

  // Run both queries in parallel; failure of one doesn't break the other
  const [issueResult, commentResult] = await Promise.allSettled([
    fetchIssueUpdates(),
    fetchCommentMentions(),
  ]);

  const results: NotificationItem[] = [];
  if (issueResult.status === 'fulfilled') results.push(...issueResult.value);
  if (commentResult.status === 'fulfilled') results.push(...commentResult.value);

  return results;
}

// ─── GitLab Note Fetcher ──────────────────────────────────────────────────────

/**
 * Fetch GitLab MR notes newer than lastSeenCursor, excluding system notes
 * and notes authored by the current user.
 */
async function fetchNewGitlabNotes(
  baseUrl: string,
  token: string,
  currentUserId: number,
  mrList: GitLabMR[],
  lastSeenCursor: string | null,
): Promise<NotificationItem[]> {
  const since = lastSeenCursor ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const results: NotificationItem[] = [];

  for (const mr of mrList) {
    const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${mr.project_id}/merge_requests/${mr.iid}/notes?order_by=created_at&sort=desc&per_page=20`;

    let response: Response;
    try {
      response = await apiFetch('gitlab', url, {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      });
    } catch {
      continue;
    }

    if (!response.ok) continue;

    const notes = await response.json();

    for (const note of notes) {
      if (note.author?.id === currentUserId) continue; // skip own notes
      if (note.created_at <= since) break;             // notes sorted desc — stop at cursor

      const body: string = note.body ?? '';

      if (note.system === true) {
        // Parse actionable system notes instead of skipping all
        let parsedBody: string | null = null;

        if (/^(closed|merged|reopened)/i.test(body)) {
          // State change — infer previous state from action
          const action = body.match(/^(\w+)/i)?.[1]?.toLowerCase() ?? '';
          let fromState = 'opened';
          if (action === 'reopened') fromState = 'closed';
          parsedBody = `State: ${fromState} \u2192 ${action}`;
        } else if (/^requested review from/i.test(body) || /^removed review request/i.test(body)) {
          parsedBody = body;
        } else if (/^(added|removed) ~"/i.test(body)) {
          parsedBody = body;
        }

        if (!parsedBody) continue; // non-actionable system note — skip

        results.push({
          id: `gitlab-system-${note.id}`,
          source: 'gitlab',
          entityTitle: mr.title,
          author: note.author?.name ?? 'Unknown',
          bodyPreview: parsedBody.substring(0, 120),
          fullBody: parsedBody,
          createdAt: note.created_at,
          url: mr.web_url,
          notificationType: 'mr-note',
          priority: undefined,
          labels: undefined,
          entityState: mr.state,
        });
        continue;
      }

      results.push({
        id: `gitlab-note-${note.id}`,
        source: 'gitlab',
        entityTitle: mr.title,
        author: note.author?.name ?? 'Unknown',
        bodyPreview: body.substring(0, 80),
        fullBody: body,
        createdAt: note.created_at,
        url: mr.web_url,
        notificationType: 'mr-note',
        priority: undefined,
        labels: undefined,
        entityState: mr.state,
      });
    }
  }

  return results;
}

// ─── Combined Fetcher ─────────────────────────────────────────────────────────

/**
 * Fetch new notifications from Jira (comment mentions) and GitLab (MR notes).
 *
 * Calls both sources in parallel using Promise.allSettled. Merges, deduplicates,
 * and sorts results chronologically newest-first.
 */
export async function fetchNewNotifications(
  jiraBaseUrl: string | null,
  gitlabBaseUrl: string | null,
  tokens: { jira: string | null; gitlab: string | null },
  opts: {
    activeJiraProject: string | null;
    jiraUserDisplayName: string | null;
    jiraUsername: string | null;
    gitlabUserId: number | null;
    mrList: GitLabMR[];
    lastSeenCursor: string | null;
  },
): Promise<NotificationItem[]> {
  const tasks: Promise<NotificationItem[]>[] = [];

  // Jira task
  if (jiraBaseUrl && tokens.jira && opts.activeJiraProject) {
    tasks.push(
      fetchNewJiraComments(
        jiraBaseUrl,
        tokens.jira,
        opts.activeJiraProject,
        opts.jiraUserDisplayName,
        opts.jiraUsername,
        opts.lastSeenCursor,
      ),
    );
  }

  // GitLab task
  if (gitlabBaseUrl && tokens.gitlab && opts.gitlabUserId !== null && opts.mrList.length > 0) {
    tasks.push(
      fetchNewGitlabNotes(
        gitlabBaseUrl,
        tokens.gitlab,
        opts.gitlabUserId,
        opts.mrList,
        opts.lastSeenCursor,
      ),
    );
  }

  const settled = await Promise.allSettled(tasks);
  const all: NotificationItem[] = [];

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      all.push(...result.value);
    }
  }

  // Deduplicate by id
  const seen = new Set<string>();
  const deduped: NotificationItem[] = [];
  for (const item of all) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      deduped.push(item);
    }
  }

  // Sort newest-first by createdAt (ISO 8601 strings sort lexicographically)
  deduped.sort((a, b) => (a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0));

  return deduped;
}

// ─── OS Notification Dispatch ─────────────────────────────────────────────────

/**
 * Attempt to dispatch an OS desktop notification.
 *
 * Full permission flow:
 *  1. Check if permission already granted
 *  2. If not, request permission from the user
 *  3. If granted (or already was), send the notification
 *  4. Returns 'sent' | 'denied' | 'error'
 */
export async function tryDispatchOsNotification(
  title: string,
  body: string,
): Promise<'sent' | 'denied' | 'error'> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const state = await requestPermission();
      granted = state === 'granted';
    }
    if (!granted) return 'denied';
    await sendNotification({ title, body });
    return 'sent';
  } catch {
    return 'error';
  }
}
