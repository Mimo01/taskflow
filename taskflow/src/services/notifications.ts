/**
 * Notifications service — delta polling for Jira comment mentions and GitLab MR notes,
 * plus OS desktop notification dispatch via tauri-plugin-notification.
 *
 * All HTTP calls use `fetch` from `@tauri-apps/plugin-http` (not global fetch)
 * to avoid CORS issues in Tauri 2 webview.
 *
 * API key links:
 *  - Jira: JQL comment ~ displayName + client-side cursor filtering
 *  - GitLab: Per-MR notes endpoint, client-side cursor + system/own-note filtering
 */
import { fetch } from '@tauri-apps/plugin-http';
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
}

// ─── Jira Comment Fetcher ─────────────────────────────────────────────────────

/**
 * Fetch Jira comment mentions newer than lastSeenCursor for the current user.
 *
 * Strategy: JQL finds issues commented on recently where currentUser is mentioned,
 * then client-side filtering extracts only comments newer than the cursor that
 * contain the user's display name or username (Jira @mention formats).
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

  const mentionTarget = displayName ?? username ?? '';
  const jql = `project = ${projectKey} AND comment ~ "${mentionTarget}" AND updatedDate >= "${sinceJql}" ORDER BY updated DESC`;
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,comment&maxResults=20`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    return [];
  }

  if (!response.ok) return [];

  const data = await response.json();
  const issues = data.issues ?? [];
  const results: NotificationItem[] = [];

  for (const issue of issues) {
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
      });
    }
  }

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
      response = await fetch(url, {
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
      if (note.system === true) continue;              // skip system notes
      if (note.author?.id === currentUserId) continue; // skip own notes
      if (note.created_at <= since) break;             // notes sorted desc — stop at cursor

      const body: string = note.body ?? '';
      results.push({
        id: `gitlab-note-${note.id}`,
        source: 'gitlab',
        entityTitle: mr.title,
        author: note.author?.name ?? 'Unknown',
        bodyPreview: body.substring(0, 80),
        fullBody: body,
        createdAt: note.created_at,
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
