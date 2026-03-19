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

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { apiFetch } from '../lib/apiFetch';
import type { NotificationType } from '../stores/notifications.store';
import type { GitLabMR } from './gitlab';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize any ISO 8601 timestamp to UTC (Z-suffix) format.
 *
 * Jira returns timestamps with timezone offsets like "2026-03-18T13:45:00.123+0100"
 * while GitLab always returns UTC "2026-03-18T12:45:00.000Z". Raw string comparison
 * of these is INCORRECT — the Jira local-time digits appear "later" than the GitLab
 * UTC digits even when they represent the same instant. Normalizing to UTC ensures
 * correct cross-source cursor comparisons.
 */
function toUtcIso(ts: string): string {
  const d = new Date(ts);
  // Guard against Invalid Date — return original to avoid silent data loss
  if (Number.isNaN(d.getTime())) return ts;
  return d.toISOString();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationItem {
  id: string; // 'jira-comment-{id}' | 'gitlab-note-{id}'
  source: 'jira' | 'gitlab';
  entityTitle: string; // "PROJ-123: Fix login bug"
  author: string; // "J.Smith"
  authorAvatarUrl?: string; // avatar image URL from Jira/GitLab API
  bodyPreview: string; // first ~80 chars of body
  fullBody: string;
  createdAt: string; // ISO 8601
  url?: string; // browser-openable URL for the entity
  notificationType?: NotificationType;
  entityState?: string; // GitLab: "opened" | "merged" | "closed"
  parentKey?: string; // Jira subtask parent key, e.g. "PROJ-100"
  parentSummary?: string; // Jira subtask parent summary, e.g. "User Login Flow"
  mrProjectId?: number; // GitLab MR project ID — for internal /mr/:projectId/:iid routing
  mrIid?: number; // GitLab MR iid — for internal /mr/:projectId/:iid routing
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

  const since = toUtcIso(
    lastSeenCursor ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  );
  // JQL requires "YYYY-MM-DD HH:mm" format (no seconds, space not T)
  const sinceJql = since.substring(0, 16).replace('T', ' ');
  const base = baseUrl.replace(/\/$/, '');

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Map of Jira changelog field names to display labels for tracked fields.
  // These produce "Label: old \u2192 new" change lines in notification bodies.
  const TRACKED_FIELDS: Record<string, string> = {
    summary: 'Title',
    priority: 'Priority',
    'Story Points': 'Story Points',
    story_points: 'Story Points',
    Sprint: 'Sprint',
    'Fix Version': 'Fix Version',
    'Fix Version/s': 'Fix Version',
    labels: 'Labels',
    Label: 'Labels',
    resolution: 'Resolution',
    issuetype: 'Type',
    Component: 'Component',
    'Component/s': 'Component',
    reporter: 'Reporter',
    duedate: 'Due Date',
    timeoriginalestimate: 'Estimate',
  };

  // ── Query A: issue updates (assignee / reporter / watcher) ──────────────────
  async function fetchIssueUpdates(): Promise<NotificationItem[]> {
    if (!username) return [];

    const jql =
      `project = ${projectKey}` +
      ` AND (assignee = "${username}" OR reporter = "${username}" OR watcher = "${username}")` +
      ` AND updatedDate >= "${sinceJql}"` +
      ` ORDER BY updated DESC`;
    const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,status,assignee,reporter,updated,parent,issuetype&expand=changelog&maxResults=20`;

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
          parent?: { id: string; key: string; fields: { summary: string } };
          issuetype?: { name: string; subtask: boolean };
        };
        changelog?: {
          histories: Array<{
            created: string;
            author: { displayName: string; avatarUrls?: { '48x48'?: string } };
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
      let changeAuthorAvatar: string | undefined;
      const histories = issue.changelog?.histories ?? [];
      for (const history of histories) {
        if (toUtcIso(history.created) <= since) continue;
        for (const item of history.items) {
          if (item.field === 'status') {
            changeLines.push(
              `Status: ${item.fromString ?? '(none)'} \u2192 ${item.toString ?? '(none)'}`,
            );
            changeAuthor = changeAuthor ?? history.author.displayName;
            changeAuthorAvatar = changeAuthorAvatar ?? history.author.avatarUrls?.['48x48'];
          } else if (item.field === 'assignee') {
            changeLines.push(
              `Assignee: ${item.fromString || '(none)'} \u2192 ${item.toString || '(none)'}`,
            );
            changeAuthor = changeAuthor ?? history.author.displayName;
            changeAuthorAvatar = changeAuthorAvatar ?? history.author.avatarUrls?.['48x48'];

            // Emit separate issue-assignment notification when newly assigned to current user
            if (displayName && item.toString === displayName && item.fromString !== displayName) {
              results.push({
                id: `jira-assign-${issue.key}-${history.created}`,
                source: 'jira',
                entityTitle: `${issue.key}: ${issue.fields.summary}`,
                author: history.author.displayName,
                authorAvatarUrl: history.author.avatarUrls?.['48x48'],
                bodyPreview: `Assigned to you by ${history.author.displayName}`,
                fullBody: `Assigned to you by ${history.author.displayName}`,
                createdAt: toUtcIso(history.created),
                url: `${base}/browse/${issue.key}`,
                notificationType: 'issue-assignment',
                entityState: undefined,
                parentKey: issue.fields.parent?.key,
                parentSummary: issue.fields.parent?.fields?.summary,
              });
            }
          } else if (item.field === 'description') {
            changeLines.push(`Description: ${item.fromString ? 'updated' : 'set'}`);
            changeAuthor = changeAuthor ?? history.author.displayName;
            changeAuthorAvatar = changeAuthorAvatar ?? history.author.avatarUrls?.['48x48'];
          } else if (TRACKED_FIELDS[item.field]) {
            const label = TRACKED_FIELDS[item.field];
            changeLines.push(
              `${label}: ${item.fromString ?? '(none)'} \u2192 ${item.toString ?? '(none)'}`,
            );
            changeAuthor = changeAuthor ?? history.author.displayName;
            changeAuthorAvatar = changeAuthorAvatar ?? history.author.avatarUrls?.['48x48'];
          }
        }
      }

      // Skip issues with no detected changelog changes — they're noise
      if (changeLines.length === 0) continue;

      const fallbackAuthor =
        issue.fields.assignee?.displayName ?? issue.fields.reporter?.displayName ?? 'Unknown';

      const bodyPreview = changeLines.join('\n');
      const fullBody = changeLines.join('\n');
      const author = changeAuthor ?? fallbackAuthor;

      results.push({
        id: `jira-issue-${issue.key}-${issue.fields.updated}`,
        source: 'jira',
        entityTitle: `${issue.key}: ${issue.fields.summary}`,
        author,
        authorAvatarUrl: changeAuthorAvatar,
        bodyPreview,
        fullBody,
        createdAt: toUtcIso(issue.fields.updated),
        url: `${base}/browse/${issue.key}`,
        notificationType: 'issue-update',
        entityState: undefined,
        parentKey: issue.fields.parent?.key,
        parentSummary: issue.fields.parent?.fields?.summary,
      });
    }

    return results;
  }

  // ── Query B: comment mentions (original logic) ──────────────────────────────
  async function fetchCommentMentions(): Promise<NotificationItem[]> {
    const mentionTarget = displayName ?? username ?? '';
    const jql = `project = ${projectKey} AND comment ~ "${mentionTarget}" AND updatedDate >= "${sinceJql}" ORDER BY updated DESC`;
    const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,comment,parent,issuetype&maxResults=20`;

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
          comment?: {
            comments: Array<{
              id: string;
              author?: { displayName?: string; avatarUrls?: { '48x48'?: string } };
              body?: string;
              updated: string;
              created: string;
            }>;
          };
          parent?: { id: string; key: string; fields: { summary: string } };
          issuetype?: { name: string; subtask: boolean };
        };
      };

      const comments = issue.fields?.comment?.comments ?? [];
      for (const comment of comments) {
        // Client-side cursor filter
        if (toUtcIso(comment.updated) <= since) continue;

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
          authorAvatarUrl: comment.author?.avatarUrls?.['48x48'],
          bodyPreview: body.substring(0, 80),
          fullBody: body,
          createdAt: toUtcIso(comment.created),
          url: `${base}/browse/${issue.key}`,
          notificationType: 'comment-mention',
          entityState: undefined,
          parentKey: issue.fields.parent?.key,
          parentSummary: issue.fields.parent?.fields?.summary,
        });
      }
    }

    return results;
  }

  // ── Query C: all comments on issues user is involved in ───────────────────
  async function fetchAllComments(): Promise<NotificationItem[]> {
    if (!username) return [];

    const jql =
      `project = ${projectKey}` +
      ` AND (assignee = "${username}" OR reporter = "${username}" OR watcher = "${username}")` +
      ` AND updatedDate >= "${sinceJql}"` +
      ` ORDER BY updated DESC`;
    const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,comment,parent,issuetype&maxResults=20`;

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
          comment?: {
            comments: Array<{
              id: string;
              author?: { displayName?: string; avatarUrls?: { '48x48'?: string } };
              body?: string;
              updated: string;
              created: string;
            }>;
          };
          parent?: { id: string; key: string; fields: { summary: string } };
          issuetype?: { name: string; subtask: boolean };
        };
      };

      const comments = issue.fields?.comment?.comments ?? [];
      for (const comment of comments) {
        if (toUtcIso(comment.updated) <= since) continue;
        // Skip self-authored comments
        if (displayName && comment.author?.displayName === displayName) continue;

        const body: string = comment.body ?? '';
        results.push({
          id: `jira-allcomment-${comment.id}`,
          source: 'jira',
          entityTitle: `${issue.key}: ${issue.fields.summary}`,
          author: comment.author?.displayName ?? 'Unknown',
          authorAvatarUrl: comment.author?.avatarUrls?.['48x48'],
          bodyPreview: body.substring(0, 80),
          fullBody: body,
          createdAt: toUtcIso(comment.created),
          url: `${base}/browse/${issue.key}`,
          notificationType: 'jira-comment',
          entityState: undefined,
          parentKey: issue.fields.parent?.key,
          parentSummary: issue.fields.parent?.fields?.summary,
        });
      }
    }

    return results;
  }

  // ── Query D: due date reminders (issues due within 1 day) ─────────────────
  async function fetchDueDateReminders(): Promise<NotificationItem[]> {
    if (!username) return [];

    const jql =
      `assignee = "${username}" AND duedate >= now() AND duedate <= endOfDay("+1")` +
      ` ORDER BY duedate ASC`;
    const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,duedate,status,parent,issuetype&maxResults=20`;

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
          duedate: string | null;
          status?: { name: string };
          parent?: { id: string; key: string; fields: { summary: string } };
          issuetype?: { name: string; subtask: boolean };
        };
      };

      if (!issue.fields.duedate) continue;

      // Determine relative label
      const dueDate = new Date(issue.fields.duedate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dueLabel = dueDate <= today ? 'Due today' : 'Due tomorrow';

      results.push({
        id: `jira-duedate-${issue.key}`,
        source: 'jira',
        entityTitle: `${issue.key}: ${issue.fields.summary}`,
        author: '',
        authorAvatarUrl: undefined,
        bodyPreview: dueLabel,
        fullBody: `${dueLabel} (${issue.fields.duedate})`,
        createdAt: new Date().toISOString(),
        url: `${base}/browse/${issue.key}`,
        notificationType: 'due-date-reminder',
        entityState: undefined,
        parentKey: issue.fields.parent?.key,
        parentSummary: issue.fields.parent?.fields?.summary,
      });
    }

    return results;
  }

  // Run all queries in parallel; failure of one doesn't break the others
  const settled = await Promise.allSettled([
    fetchIssueUpdates(),
    fetchCommentMentions(),
    fetchAllComments(),
    fetchDueDateReminders(),
  ]);

  const results: NotificationItem[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') results.push(...result.value);
  }

  return results;
}

// ─── GitLab Combined Fetcher ─────────────────────────────────────────────────

/**
 * Fetch all GitLab notifications (notes, approvals, pipeline failures) in a
 * single pass with maximum parallelism and minimum API calls.
 *
 * Optimizations over the previous three separate sequential fetchers:
 *  1. Skip MRs whose updated_at <= cursor — no new activity possible, zero calls.
 *  2. For each active MR, fetch notes + (if author) approvals & pipelines in
 *     parallel within a single Promise.all.
 *  3. Process all active MRs concurrently in batches of CONCURRENCY to avoid
 *     GitLab rate-limit throttling.
 *
 * Net effect: 3*N sequential calls -> 1-3 parallel calls * activeMRs (batched).
 */
const GITLAB_CONCURRENCY = 6;

async function fetchAllGitlabNotifications(
  baseUrl: string,
  token: string,
  currentUserId: number,
  mrList: GitLabMR[],
  lastSeenCursor: string | null,
  currentUsername: string | null,
): Promise<NotificationItem[]> {
  const since = toUtcIso(
    lastSeenCursor ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  );
  const base = baseUrl.replace(/\/$/, '');
  const headers = { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' };

  // NOTE: We intentionally do NOT filter by mr.updated_at here. The MR list
  // may come from the React Query cache with stale updated_at values, which
  // would incorrectly skip MRs that have new activity. The per-note cursor
  // check inside processMR handles freshness correctly.

  /** Process a single MR: fetch notes + (if author) approvals & pipelines in parallel. */
  async function processMR(mr: GitLabMR): Promise<NotificationItem[]> {
    const isAuthor = mr.author.id === currentUserId;
    const notesUrl = `${base}/api/v4/projects/${mr.project_id}/merge_requests/${mr.iid}/notes?order_by=created_at&sort=desc&per_page=20`;

    // Build parallel fetch list — always notes; approvals + pipelines only for author's MRs
    const fetches: Promise<Response | null>[] = [
      apiFetch('gitlab', notesUrl, { headers }).catch(() => null),
    ];
    if (isAuthor) {
      fetches.push(
        apiFetch(
          'gitlab',
          `${base}/api/v4/projects/${mr.project_id}/merge_requests/${mr.iid}/approvals`,
          { headers },
        ).catch(() => null),
        apiFetch(
          'gitlab',
          `${base}/api/v4/projects/${mr.project_id}/merge_requests/${mr.iid}/pipelines?per_page=5&sort=desc`,
          { headers },
        ).catch(() => null),
      );
    }

    const [notesRes, approvalsRes, pipelinesRes] = await Promise.all(fetches);
    const items: NotificationItem[] = [];

    // ── Notes ────────────────────────────────────────────────────────────────
    if (notesRes?.ok) {
      const notes = await notesRes.json();
      for (const note of notes) {
        if (note.author?.id === currentUserId) continue;
        if (toUtcIso(note.created_at) <= since) break; // sorted desc — stop at cursor

        const body: string = note.body ?? '';

        if (note.system === true) {
          const parsedBody = parseSystemNote(body);
          if (!parsedBody) continue;

          items.push({
            id: `gitlab-system-${note.id}`,
            source: 'gitlab',
            entityTitle: mr.title,
            author: note.author?.name ?? 'Unknown',
            authorAvatarUrl: note.author?.avatar_url,
            bodyPreview: parsedBody.substring(0, 120),
            fullBody: parsedBody,
            createdAt: toUtcIso(note.created_at),
            url: mr.web_url,
            notificationType: 'mr-note',
            entityState: mr.state,
            mrProjectId: mr.project_id,
            mrIid: mr.iid,
          });
          continue;
        }

        const isMentioned = currentUsername ? body.includes(`@${currentUsername}`) : false;
        items.push({
          id: `gitlab-note-${note.id}`,
          source: 'gitlab',
          entityTitle: mr.title,
          author: note.author?.name ?? 'Unknown',
          authorAvatarUrl: note.author?.avatar_url,
          bodyPreview: body.substring(0, 80),
          fullBody: body,
          createdAt: toUtcIso(note.created_at),
          url: mr.web_url,
          notificationType: isMentioned ? 'gitlab-mention' : 'mr-note',
          entityState: mr.state,
          mrProjectId: mr.project_id,
          mrIid: mr.iid,
        });
      }
    }

    // ── Approvals (author's MRs only) ────────────────────────────────────────
    if (approvalsRes?.ok) {
      const data = await approvalsRes.json();
      const approvedBy: Array<{
        user: { id: number; name: string; username: string; avatar_url?: string };
        approved_at?: string;
      }> = data.approved_by ?? [];

      for (const entry of approvedBy) {
        const approvedAt = toUtcIso(entry.approved_at ?? mr.updated_at);
        if (approvedAt <= since) continue;

        items.push({
          id: `gitlab-approval-${mr.iid}-${entry.user.id}`,
          source: 'gitlab',
          entityTitle: mr.title,
          author: entry.user.name,
          authorAvatarUrl: entry.user.avatar_url,
          bodyPreview: `Approved by ${entry.user.name}`,
          fullBody: `Approved by ${entry.user.name}`,
          createdAt: approvedAt,
          url: mr.web_url,
          notificationType: 'mr-approval',
          entityState: mr.state,
          mrProjectId: mr.project_id,
          mrIid: mr.iid,
        });
      }
    }

    // ── Pipeline failures (author's MRs only) ───────────────────────────────
    if (pipelinesRes?.ok) {
      const pipelines: Array<{
        id: number;
        status: string;
        updated_at: string;
        ref: string;
      }> = await pipelinesRes.json();

      for (const pipeline of pipelines) {
        if (pipeline.status !== 'failed') continue;
        if (toUtcIso(pipeline.updated_at) <= since) continue;

        items.push({
          id: `gitlab-pipeline-${pipeline.id}`,
          source: 'gitlab',
          entityTitle: mr.title,
          author: '',
          authorAvatarUrl: undefined,
          bodyPreview: `Pipeline #${pipeline.id} failed on ${mr.source_branch}`,
          fullBody: `Pipeline #${pipeline.id} failed on ${mr.source_branch}`,
          createdAt: toUtcIso(pipeline.updated_at),
          url: mr.web_url,
          notificationType: 'pipeline-failure',
          entityState: mr.state,
          mrProjectId: mr.project_id,
          mrIid: mr.iid,
        });
      }
    }

    return items;
  }

  // Process MRs in batches to respect rate limits
  const results: NotificationItem[] = [];
  for (let i = 0; i < mrList.length; i += GITLAB_CONCURRENCY) {
    const batch = mrList.slice(i, i + GITLAB_CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(processMR));
    for (const result of settled) {
      if (result.status === 'fulfilled') results.push(...result.value);
    }
  }

  return results;
}

/** Parse a GitLab system note into a human-readable string, or null if non-actionable. */
function parseSystemNote(body: string): string | null {
  if (/^(closed|merged|reopened)/i.test(body)) {
    const action = body.match(/^(\w+)/i)?.[1]?.toLowerCase() ?? '';
    const fromState = action === 'reopened' ? 'closed' : 'opened';
    return `State: ${fromState} \u2192 ${action}`;
  }
  if (/^requested review from/i.test(body)) {
    const names = [...body.matchAll(/@(\w[\w.-]*)/g)].map((m) => m[1]);
    return names.length > 0 ? `Review requested: ${names.join(', ')}` : body;
  }
  if (/^removed review request for/i.test(body)) {
    const names = [...body.matchAll(/@(\w[\w.-]*)/g)].map((m) => m[1]);
    return names.length > 0 ? `Review removed: ${names.join(', ')}` : body;
  }
  if (/^(added|removed) ~"/i.test(body)) {
    const action = /^added/i.test(body) ? 'added' : 'removed';
    const labels = [...body.matchAll(/~"([^"]+)"/g)].map((m) => m[1]);
    return labels.length > 0 ? `Labels ${action}: ${labels.join(', ')}` : body;
  }
  if (/^assigned to/i.test(body)) {
    const names = [...body.matchAll(/@(\w[\w.-]*)/g)].map((m) => m[1]);
    return names.length > 0 ? `Assigned: ${names.join(', ')}` : body;
  }
  if (/^unassigned/i.test(body)) {
    const names = [...body.matchAll(/@(\w[\w.-]*)/g)].map((m) => m[1]);
    return names.length > 0 ? `Unassigned: ${names.join(', ')}` : 'Assignee: removed';
  }
  if (/^changed title from/i.test(body)) {
    const m = body.match(/from \*\*(.+?)\*\* to \*\*(.+?)\*\*/);
    return m ? `Title: ${m[1]} \u2192 ${m[2]}` : body;
  }
  if (/^changed the description/i.test(body)) return 'Description: updated';
  if (/^changed target branch/i.test(body)) {
    const m = body.match(/from `(.+?)` to `(.+?)`/);
    return m ? `Target branch: ${m[1]} \u2192 ${m[2]}` : body;
  }
  if (/^changed milestone to/i.test(body)) {
    const m = body.match(/to %(.+)/);
    return m ? `Milestone: ${m[1]}` : body;
  }
  if (/^removed milestone/i.test(body)) return 'Milestone: removed';
  if (/^marked.*(draft|ready)/i.test(body)) {
    const isDraft = /draft/i.test(body);
    return `Status: ${isDraft ? 'ready \u2192 draft' : 'draft \u2192 ready'}`;
  }
  if (/^enabled an automatic merge/i.test(body) || /^merge when pipeline succeeds/i.test(body))
    return 'Auto-merge: enabled';
  if (/^canceled an automatic merge/i.test(body)) return 'Auto-merge: canceled';
  return null;
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
    gitlabUsername: string | null;
    mrList: GitLabMR[];
    lastSeenJiraCursor: string | null;
    lastSeenGitlabCursor: string | null;
  },
): Promise<NotificationItem[]> {
  const tasks: Promise<NotificationItem[]>[] = [];

  // Jira task — uses Jira-specific cursor
  if (jiraBaseUrl && tokens.jira && opts.activeJiraProject) {
    tasks.push(
      fetchNewJiraComments(
        jiraBaseUrl,
        tokens.jira,
        opts.activeJiraProject,
        opts.jiraUserDisplayName,
        opts.jiraUsername,
        opts.lastSeenJiraCursor,
      ),
    );
  }

  // GitLab task — single combined fetcher with internal parallelism
  if (gitlabBaseUrl && tokens.gitlab && opts.gitlabUserId !== null && opts.mrList.length > 0) {
    tasks.push(
      fetchAllGitlabNotifications(
        gitlabBaseUrl,
        tokens.gitlab,
        opts.gitlabUserId,
        opts.mrList,
        opts.lastSeenGitlabCursor,
        opts.gitlabUsername,
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
