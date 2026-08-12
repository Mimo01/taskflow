/**
 * IssueDetailView — Shared full-detail body for both the full-page route and
 * the peek panel (Plan 03). Accepts a layout prop:
 *   - 'two-column': left content + right resizable sidebar (IssueDetailPage usage)
 *   - 'single-column': sidebar fields stacked above content (PeekPanel usage, D-06)
 *
 * All queries, mutations, and handlers are lifted from IssueDetailPage so that
 * peek and full-page share the same TanStack Query cache (RESEARCH Pitfall 4).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreVertical } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useMentionUserMap } from '@/hooks/useMentionUserMap';
import { useResizable } from '@/hooks/useResizable';
import type { JiraComment, JiraIssue, TimelineFilter } from '@/services/jira';
import {
  deleteComment,
  fetchComments,
  fetchEnrichedSubtasks,
  fetchEpicStories,
  fetchIssueChangelog,
  fetchIssueDetail,
  fetchJiraIssueByKey,
  updateComment,
} from '@/services/jira';
import { parseDuration } from '@/services/jira/duration';
import type { JiraWorklog } from '@/services/jira/types';
import { deleteWorklog, fetchFullWorklogs, updateWorklog } from '@/services/jira/worklogs';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { usePinnedTabsStore } from '@/stores/pinned-tabs.store';
import { useRecentItemsStore } from '@/stores/recent-items.store';
import { useSettingsStore } from '@/stores/settings.store';
import { CommentComposer } from './CommentComposer';
import type { EditInitialValues } from './CreateEditIssueModal';
import { IssueDetailContent, relativeTime } from './IssueDetailContent';
import { IssueDetailSidebar } from './IssueDetailSidebar';
import { ActivityTimeline } from './issue-detail/ActivityTimeline';
import { AioTestRunsSection } from './issue-detail/AioTestRunsSection';
import { CommentsSkeleton } from './issue-detail/CommentsSkeleton';
import { LinkedIssuesSection } from './issue-detail/LinkedIssuesSection';
import { MergeRequestsSection } from './issue-detail/MergeRequestsSection';
import { useLinkedMRs } from './issue-detail/useLinkedMRs';
import { WorklogProgressBar } from './issue-detail/WorklogProgressBar';
import type { AttachmentMap, UserMap } from './WikiRenderer';
import { WikiRenderer } from './WikiRenderer';

export interface IssueDetailViewProps {
  issueKey: string;
  layout: 'two-column' | 'single-column';
  onOpenIssue?: (key: string) => void;
  onEdit?: (vals: EditInitialValues) => void;
  onClone?: (vals: EditInitialValues) => void;
  onAddSubtask?: (parentKey: string) => void;
  isPinned?: boolean;
  onTogglePin?: (key: string) => void;
}

export function IssueDetailView({
  issueKey,
  layout,
  onOpenIssue,
  onEdit,
  onClone,
  onAddSubtask,
  isPinned: isPinnedProp,
  onTogglePin: onTogglePinProp,
}: IssueDetailViewProps) {
  // Perf instrumentation — record start time on mount
  useEffect(() => {
    performance.mark('issue-detail-start');
  }, []);

  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('comment');

  // Auth + settings
  const { jiraBaseUrl, jiraConnected } = useAuthStore();
  const jiraUserDisplayName = useAuthStore((s) => s.jiraUserDisplayName);
  const {
    epicLinkFieldKey,
    epicNameFieldKey,
    sprintFieldKey,
    storyPointsFieldKey,
    epicColorFieldKey,
  } = useSettingsStore();
  const issueDetailPanelWidth = useSettingsStore((s) => s.issueDetailPanelWidth);
  const setIssueDetailPanelWidth = useSettingsStore((s) => s.setIssueDetailPanelWidth);

  // Pinned state — accept as props (for PeekPanel/IssueDetailPage callers), or read store
  // internally if not provided. Props take precedence so callers can control the state.
  const isPinnedFromStore = usePinnedTabsStore((s) =>
    issueKey ? s.pinnedKeys.includes(issueKey) : false,
  );
  const togglePinFromStore = usePinnedTabsStore((s) => s.togglePin);
  const isPinned = isPinnedProp !== undefined ? isPinnedProp : isPinnedFromStore;
  const onTogglePin = onTogglePinProp ?? togglePinFromStore;

  // Recent items
  const pushRecentItem = useRecentItemsStore((s) => s.pushItem);

  // MR data for single-column bottom slot — deduped with IssueDetailSidebar's call
  // (same query key ['gitlab-project-mrs', ...]) so no extra network request.
  const mr = useLinkedMRs(issueKey);

  // Fetch issue detail — same query key as IssueDetailPage (cache-sharing, RESEARCH Pitfall 4)
  const { data: issue, isLoading } = useQuery({
    queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) throw new Error('No credentials');
      return fetchIssueDetail(jiraBaseUrl, token, issueKey ?? '', {
        epicLinkFieldKey,
        epicNameFieldKey,
        sprintFieldKey,
        storyPointsFieldKey,
        epicColorFieldKey,
      });
    },
    staleTime: 30_000,
    enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected,
  });

  const isEpic = issue?.fields.issuetype.name === 'Epic';

  const { data: epicStories } = useQuery<JiraIssue[]>({
    queryKey: ['jira-epic-stories', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) return [];
      return fetchEpicStories(jiraBaseUrl, token, issueKey ?? '', '', storyPointsFieldKey);
    },
    staleTime: 30_000,
    enabled: isEpic && !!jiraBaseUrl && !!jiraConnected,
  });

  // ─── Three independent section queries ───────────────────────────────────────

  // Comments query
  const commentsQuery = useQuery({
    queryKey: ['jira-issue-comments', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) throw new Error('No credentials');
      return fetchComments(jiraBaseUrl, token, issueKey ?? '');
    },
    staleTime: 30_000,
    enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected,
  });

  // Stable signature of the current subtask set — included in the enrichment cache key
  // so a changed subtask list produces a fresh cache entry (WR-04).
  const subtaskSignature = (issue?.fields.subtasks ?? []).map((s) => s.key).join(',');

  // Subtask enrichment query
  const subtaskEnrichmentQuery = useQuery({
    queryKey: ['jira-subtask-enrichment', issueKey, jiraBaseUrl, subtaskSignature],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) return [];
      const subtasks = issue?.fields.subtasks ?? [];
      if (subtasks.length === 0) return [];
      return fetchEnrichedSubtasks(
        jiraBaseUrl,
        token,
        subtasks as Parameters<typeof fetchEnrichedSubtasks>[2],
      );
    },
    staleTime: 30_000,
    enabled:
      !!issueKey && !!jiraBaseUrl && !!jiraConnected && (issue?.fields.subtasks?.length ?? 0) > 0,
  });

  // Parent enrichment query — for subtasks, fetch the parent's full row data
  // (summary, status, assignee, issuetype) so the Parent section can match the
  // Subtasks section rows. The base issue.fields.parent omits assignee.
  const parentKey = issue?.fields.issuetype.subtask ? (issue.fields.parent?.key ?? null) : null;
  const parentQuery = useQuery<JiraIssue | null>({
    queryKey: ['jira-parent-detail', parentKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !parentKey) return null;
      return fetchJiraIssueByKey(jiraBaseUrl, token, parentKey);
    },
    staleTime: 30_000,
    enabled: !!parentKey && !!jiraBaseUrl && !!jiraConnected,
  });

  // Changelog query — feeds ActivityTimeline
  const changelogQuery = useQuery({
    queryKey: ['jira-issue-changelog', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) throw new Error('No credentials');
      return fetchIssueChangelog(jiraBaseUrl, token, issueKey ?? '');
    },
    staleTime: 30_000,
    enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected,
  });

  // Delayed loading gates — suppress skeleton flash on fast loads (200ms gate)
  const showCommentsSkeleton = useDelayedLoading(commentsQuery.isPending);
  const showSubtasksSkeleton = useDelayedLoading(subtaskEnrichmentQuery.isPending);
  const showChangelogSkeleton = useDelayedLoading(changelogQuery.isPending);

  // Track recent item when issue data is available
  useEffect(() => {
    if (issueKey && issue) {
      pushRecentItem({
        type: 'jira',
        id: issueKey,
        title: issue.fields.summary,
        issueType: issue.fields.issuetype?.name,
      });
    }
  }, [issueKey, issue?.fields.summary, issue?.fields.issuetype?.name, issue, pushRecentItem]);

  // TTFMP — fires once when base issue first resolves (header paint)
  const ttfmpFiredRef = useRef(false);
  useEffect(() => {
    if (issue && !ttfmpFiredRef.current) {
      ttfmpFiredRef.current = true;
      performance.mark('issue-detail-header-paint');
      performance.measure('TTFMP', 'issue-detail-start', 'issue-detail-header-paint');
    }
  }, [issue]);

  // TTI — fires once when all sections have resolved.
  // The subtask enrichment query is `enabled: false` for issues with no subtasks; in
  // TanStack Query v5 a disabled query with no cached data reports `isPending: true`
  // indefinitely, so gating TTI on `!subtaskEnrichmentQuery.isPending` would never fire
  // for the (majority) zero-subtask issues. Treat "no subtasks" as already settled.
  const subtasksSettled =
    (issue?.fields.subtasks?.length ?? 0) === 0 || !subtaskEnrichmentQuery.isPending;
  const ttiFiredRef = useRef(false);
  useEffect(() => {
    if (
      issue &&
      !commentsQuery.isPending &&
      !changelogQuery.isPending &&
      subtasksSettled &&
      !ttiFiredRef.current
    ) {
      ttiFiredRef.current = true;
      performance.mark('issue-detail-fully-loaded');
      try {
        performance.measure('TTI', 'issue-detail-start', 'issue-detail-fully-loaded');
      } catch {
        // performance.measure may throw if start mark is missing (e.g. HMR)
      }
    }
  }, [issue, commentsQuery.isPending, changelogQuery.isPending, subtasksSettled]);

  // Comment data — sourced from independent commentsQuery
  const comments: JiraComment[] = commentsQuery.data ?? [];

  // Build attachment filename -> URL map for resolving !image.png! references
  const attachmentMap: AttachmentMap = {};
  for (const att of issue?.fields.attachment ?? []) {
    attachmentMap[att.filename] = att.content;
  }

  const Assignee = issue?.fields.assignee;
  const Reporter = issue?.fields.reporter;
  const initialUserMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (Assignee) map[Assignee.name] = Assignee.displayName;
    if (Reporter) {
      if (Reporter.name) map[Reporter.name] = Reporter.displayName;
      map[Reporter.displayName] = Reporter.displayName;
    }
    for (const c of comments) {
      if (c.author?.displayName) {
        const authorObj = c.author as { displayName: string; name?: string };
        if (authorObj.name) map[authorObj.name] = authorObj.displayName;
        map[authorObj.displayName] = authorObj.displayName;
      }
    }
    return map;
  }, [Assignee, Reporter, comments]);

  const commentTexts = useMemo(() => comments.map((c) => c.body), [comments]);
  const userMap = useMentionUserMap(initialUserMap, commentTexts, jiraBaseUrl ?? '');

  // ─── Comment edit/delete mutations ──────────────────────────────────────────
  const queryClient = useQueryClient();
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const editMutation = useMutation({
    mutationFn: async ({ commentId, body }: { commentId: string; body: string }) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return updateComment(jiraBaseUrl ?? '', token, issueKey ?? '', commentId, body);
    },
    onSuccess: () => {
      setEditingCommentId(null);
      setEditText('');
      setEditError(null);
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      queryClient.invalidateQueries({ queryKey: ['jira-issue-comments', issueKey, jiraBaseUrl] });
    },
    onError: (err: Error) => {
      setEditError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return deleteComment(jiraBaseUrl ?? '', token, issueKey ?? '', commentId);
    },
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      queryClient.invalidateQueries({ queryKey: ['jira-issue-comments', issueKey, jiraBaseUrl] });
    },
    onError: (err: Error) => {
      setDeleteError(err.message);
    },
  });

  const editMutateRef = useRef(editMutation.mutate);
  editMutateRef.current = editMutation.mutate;
  const deleteMutateRef = useRef(deleteMutation.mutate);
  deleteMutateRef.current = deleteMutation.mutate;
  const editTextRef = useRef(editText);
  editTextRef.current = editText;

  // Drag-to-resize for right panel (two-column only).
  const containerRef = useRef<HTMLDivElement>(null);
  // Measure the container width after mount so the initial panel width reflects the real
  // available space rather than the 952px magic fallback (WR-03: reading a ref in useMemo
  // always sees null on first render). State is set in useLayoutEffect (synchronous before
  // paint) so there is no visible flash on the first frame.
  const [measuredInitialWidth, setMeasuredInitialWidth] = useState<number | null>(null);
  useEffect(() => {
    if (measuredInitialWidth === null && containerRef.current) {
      setMeasuredInitialWidth(Math.round(containerRef.current.offsetWidth * 0.42));
    }
  });
  const initialPanelWidth = issueDetailPanelWidth ?? measuredInitialWidth ?? Math.round(952 * 0.42);
  const { width, isDragging, handleMouseDown } = useResizable({
    initialWidth: initialPanelWidth,
    min: 240,
    max: () => (containerRef.current?.offsetWidth ?? 800) * 0.5,
    onCommit: setIssueDetailPanelWidth,
    direction: 'left',
  });
  const [handleHovered, setHandleHovered] = useState(false);

  const handleEdit = (comment: JiraComment) => {
    setEditingCommentId(comment.id);
    setEditText(comment.body);
    setEditError(null);
  };

  const handleDelete = (comment: JiraComment) => {
    if (!window.confirm('Delete this comment? This cannot be undone.')) return;
    setDeleteError(null);
    deleteMutateRef.current(comment.id);
  };

  const handleSaveEdit = (commentId: string) => {
    const text = editTextRef.current.trim();
    if (!text) return;
    editMutateRef.current({ commentId, body: text });
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditText('');
    setEditError(null);
  };

  // ─── Worklog data + CRUD ──────────────────────────────────────────────────────
  const worklogsQuery = useQuery({
    queryKey: ['jira-worklogs', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) return [];
      return fetchFullWorklogs(jiraBaseUrl, token, issueKey ?? '');
    },
    staleTime: 30_000,
    enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected,
  });
  const worklogs = worklogsQuery.data ?? [];

  const [editingWorklogId, setEditingWorklogId] = useState<string | null>(null);
  const [editDuration, setEditDuration] = useState('');
  const [editWorklogComment, setEditWorklogComment] = useState('');
  const [worklogEditError, setWorklogEditError] = useState<string | null>(null);

  const worklogEditMutation = useMutation({
    mutationFn: async ({
      worklogId,
      timeSpentSeconds,
      started,
      comment,
    }: {
      worklogId: string;
      timeSpentSeconds: number;
      started: string;
      comment?: string;
    }) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return updateWorklog(jiraBaseUrl ?? '', token, issueKey ?? '', worklogId, {
        timeSpentSeconds,
        started,
        comment,
      });
    },
    onSuccess: () => {
      setEditingWorklogId(null);
      setEditDuration('');
      setEditWorklogComment('');
      setWorklogEditError(null);
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      queryClient.invalidateQueries({ queryKey: ['jira-worklogs', issueKey, jiraBaseUrl] });
      // Worklogs are merged into the same activity feed as changelog entries (WR-02).
      queryClient.invalidateQueries({ queryKey: ['jira-issue-changelog', issueKey, jiraBaseUrl] });
    },
    onError: (err: Error) => setWorklogEditError(err.message),
  });

  const worklogDeleteMutation = useMutation({
    mutationFn: async (worklogId: string) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return deleteWorklog(jiraBaseUrl ?? '', token, issueKey ?? '', worklogId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      queryClient.invalidateQueries({ queryKey: ['jira-worklogs', issueKey, jiraBaseUrl] });
      // Refresh timeline so deleted-worklog history doesn't linger (WR-02).
      queryClient.invalidateQueries({ queryKey: ['jira-issue-changelog', issueKey, jiraBaseUrl] });
    },
  });

  const handleWorklogEdit = (worklog: JiraWorklog) => {
    setEditingWorklogId(worklog.id);
    setEditDuration(worklog.timeSpent);
    setEditWorklogComment(worklog.comment ?? '');
    setWorklogEditError(null);
  };

  const handleWorklogDelete = (worklog: JiraWorklog) => {
    if (!window.confirm('Delete worklog: Remove this time entry? This cannot be undone.')) return;
    worklogDeleteMutation.mutate(worklog.id);
  };

  const handleWorklogEditSave = (worklogId: string) => {
    const parsed = parseDuration(editDuration);
    if (!parsed) {
      setWorklogEditError("Couldn't parse duration");
      return;
    }
    const original = worklogs.find((w) => w.id === worklogId);
    worklogEditMutation.mutate({
      worklogId,
      timeSpentSeconds: parsed.seconds,
      // Jira worklog API requires a "+0000" offset suffix, not the "Z" shorthand.
      // Build the UTC timestamp explicitly: toISOString() always returns UTC, so we
      // replace the trailing "Z" with "+0000". This is safe ONLY because toISOString()
      // is guaranteed UTC — do NOT use this pattern with local-time formatters, which
      // would silently shift the value by the local offset.
      started: original?.started ?? new Date().toISOString().replace(/Z$/, '+0000'),
      comment: editWorklogComment || undefined,
    });
  };

  const handleWorklogEditCancel = () => {
    setEditingWorklogId(null);
    setEditDuration('');
    setEditWorklogComment('');
    setWorklogEditError(null);
  };

  // ─── Shared content blocks ────────────────────────────────────────────────────

  const issueDetailContentNode = issue && (
    <IssueDetailContent
      issue={issue}
      issueKey={issueKey}
      jiraBaseUrl={jiraBaseUrl ?? ''}
      comments={comments}
      onOpenIssue={onOpenIssue}
      onEdit={onEdit}
      onClone={onClone}
      onAddSubtask={onAddSubtask}
      storyPointsFieldKey={storyPointsFieldKey}
      sprintFieldKey={sprintFieldKey}
      epicLinkFieldKey={epicLinkFieldKey}
      epicStories={epicStories}
      isPinned={isPinned}
      onTogglePin={onTogglePin}
      enrichedSubtasks={subtaskEnrichmentQuery.data as never}
      enrichedParent={parentQuery.data ?? undefined}
      showSubtasksSkeleton={showSubtasksSkeleton}
      subtaskError={subtaskEnrichmentQuery.isError ? (subtaskEnrichmentQuery.error as Error) : null}
      onSubtaskRetry={() =>
        void queryClient.invalidateQueries({
          queryKey: ['jira-subtask-enrichment', issueKey, jiraBaseUrl],
        })
      }
    />
  );

  // Single-column (peek) uses tighter horizontal padding than two-column. The activity
  // feed and its sticky composer break-out margin must track the same value to stay aligned.
  const activityPadX = layout === 'single-column' ? 'px-4' : 'px-6';
  const activityNegMx = layout === 'single-column' ? '-mx-4' : '-mx-6';

  const activitySectionNode = issue && (
    <div className={activityPadX}>
      <AioTestRunsSection
        issueKey={issueKey}
        jiraBaseUrl={jiraBaseUrl ?? ''}
        jiraIssueId={issue.id}
        description={issue.fields.description}
      />

      {commentsQuery.isError && (
        <div className="p-4">
          <ErrorState
            error={commentsQuery.error}
            onRetry={() =>
              void queryClient.invalidateQueries({
                queryKey: ['jira-issue-comments', issueKey, jiraBaseUrl],
              })
            }
            viewName="comments"
          />
        </div>
      )}
      {changelogQuery.isError && (
        <div className="p-4">
          <ErrorState
            error={changelogQuery.error}
            onRetry={() =>
              void queryClient.invalidateQueries({
                queryKey: ['jira-issue-changelog', issueKey, jiraBaseUrl],
              })
            }
            viewName="activity"
          />
        </div>
      )}
      {worklogsQuery.isError && (
        <div className="p-4">
          <ErrorState
            error={worklogsQuery.error}
            onRetry={() =>
              void queryClient.invalidateQueries({
                queryKey: ['jira-worklogs', issueKey, jiraBaseUrl],
              })
            }
            viewName="worklogs"
          />
        </div>
      )}
      {timelineFilter === 'worklog' && issue && (
        <WorklogProgressBar issue={issue} subtasks={subtaskEnrichmentQuery.data} />
      )}

      {showCommentsSkeleton && !commentsQuery.isError ? (
        <CommentsSkeleton />
      ) : (
        <ActivityTimeline
          comments={commentsQuery.isError ? [] : comments}
          changelog={
            changelogQuery.isError ? [] : showChangelogSkeleton ? undefined : changelogQuery.data
          }
          worklogs={worklogs}
          issueKey={issueKey}
          jiraBaseUrl={jiraBaseUrl ?? ''}
          jiraUserDisplayName={jiraUserDisplayName}
          attachmentMap={attachmentMap}
          userMap={userMap}
          editingCommentId={editingCommentId}
          editText={editText}
          onEditStart={handleEdit}
          onEditChange={setEditText}
          onEditSave={handleSaveEdit}
          onEditCancel={handleCancelEdit}
          onDelete={handleDelete}
          editError={editError}
          deleteError={deleteError}
          deletingCommentId={deleteMutation.variables ?? null}
          editPending={editMutation.isPending}
          CommentCard={CommentCard}
          onFilterChange={setTimelineFilter}
          editingWorklogId={editingWorklogId}
          editDuration={editDuration}
          editWorklogComment={editWorklogComment}
          onWorklogEditStart={handleWorklogEdit}
          onWorklogEditDurationChange={setEditDuration}
          onWorklogEditCommentChange={setEditWorklogComment}
          onWorklogEditSave={handleWorklogEditSave}
          onWorklogEditCancel={handleWorklogEditCancel}
          onWorklogDelete={handleWorklogDelete}
          worklogEditPending={worklogEditMutation.isPending}
          worklogEditError={worklogEditError}
        />
      )}

      {(timelineFilter === 'comment' || timelineFilter === 'all') && (
        <div
          className={`sticky bottom-0 border-t py-3 ${activityNegMx} ${activityPadX} bg-background`}
        >
          <CommentComposer issueKey={issueKey} jiraBaseUrl={jiraBaseUrl ?? ''} />
        </div>
      )}
    </div>
  );

  const sidebarNode = issue && (
    <IssueDetailSidebar
      issue={issue}
      issueKey={issueKey}
      jiraBaseUrl={jiraBaseUrl ?? ''}
      storyPointsFieldKey={storyPointsFieldKey}
      epicLinkFieldKey={epicLinkFieldKey}
      epicNameFieldKey={epicNameFieldKey}
      sprintFieldKey={sprintFieldKey}
      onOpenIssue={onOpenIssue}
      omitLinkedIssues={layout === 'single-column'}
      omitMergeRequests={layout === 'single-column'}
    />
  );

  // ─── Skeleton / error states ──────────────────────────────────────────────────

  if (!issue) {
    if (isLoading) {
      return <IssueDetailSkeleton />;
    }
    return (
      <div className="p-6">
        <ErrorState
          error={new Error('Failed to load issue')}
          onRetry={() =>
            void queryClient.invalidateQueries({
              queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl],
            })
          }
          viewName="issue"
        />
      </div>
    );
  }

  // ─── Layout: two-column ───────────────────────────────────────────────────────

  if (layout === 'two-column') {
    return (
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Left column: scrollable content */}
        <div className="flex-1 overflow-auto min-w-0">
          <div className="p-6">{issueDetailContentNode}</div>
          {activitySectionNode}
        </div>

        {/* Right sidebar */}
        <div
          className={`relative border-l overflow-auto p-4 shrink-0${isDragging ? '' : ' transition-all duration-200'}`}
          style={{ width }}
        >
          <div
            aria-hidden="true"
            onMouseDown={handleMouseDown}
            onMouseEnter={() => setHandleHovered(true)}
            onMouseLeave={() => setHandleHovered(false)}
            style={{ borderColor: isDragging || handleHovered ? 'var(--ring)' : undefined }}
            className="absolute left-0 top-0 h-full w-3 cursor-ew-resize z-20 border-l border-border transition-colors duration-100"
          />
          {sidebarNode}
        </div>
      </div>
    );
  }

  // ─── Layout: single-column (D-06) ────────────────────────────────────────────
  // Sidebar fields first, then content. No resize handle — outer width is owned by PeekPanel.

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Sidebar fields block */}
      <div className="px-4 py-4 border-b">{sidebarNode}</div>

      {/* Content block: description, subtasks, then Linked Issues + Merge Requests
          (omitted from the sidebar above). Shares px-4 with the sidebar and the
          activity feed below so the whole panel reads as one column. */}
      <div className="px-4 py-4 space-y-4">
        {issueDetailContentNode}
        {issue && (
          <LinkedIssuesSection issuelinks={issue.fields.issuelinks} onOpenIssue={onOpenIssue} />
        )}
        <MergeRequestsSection
          linkedMRs={mr.linkedMRs}
          mrsLoading={mr.mrsLoading}
          gitlabConnected={mr.gitlabConnected}
          gitlabBaseUrl={mr.gitlabBaseUrl}
        />
      </div>

      {/* Activity feed is a direct child (like two-column) so its own px-6 aligns with
          the blocks above and the sticky composer's -mx-6 reaches the panel edge. */}
      {activitySectionNode}
    </div>
  );
}

// ─── Comment Card (memoized to prevent re-renders on sibling menu/edit state) ──

interface CommentCardProps {
  comment: JiraComment;
  isOwn: boolean;
  isEditing: boolean;
  editText: string;
  editError: string | null;
  deleteError: string | null;
  deletingCommentId: string | null;
  editPending: boolean;
  onEdit: (comment: JiraComment) => void;
  onDelete: (comment: JiraComment) => void;
  onSaveEdit: (commentId: string) => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
  attachmentMap: AttachmentMap;
  userMap: UserMap;
}

function CommentCard({
  comment,
  isOwn,
  isEditing,
  editText,
  editError,
  deleteError,
  deletingCommentId,
  editPending,
  onEdit,
  onDelete,
  onSaveEdit,
  onCancelEdit,
  onEditTextChange,
  attachmentMap,
  userMap,
}: CommentCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  return (
    <div className="rounded-lg border bg-card p-3 density-compact:p-2 density-comfortable:p-4 space-y-2 density-compact:space-y-1 density-comfortable:space-y-3">
      {/* Card header */}
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium text-sm">{comment.author.displayName}</span>
        <span className="text-muted-foreground" title={new Date(comment.created).toLocaleString()}>
          {relativeTime(comment.created)}
        </span>
        {comment.updated !== comment.created && (
          <span className="text-muted-foreground italic">(edited)</span>
        )}

        {/* 3-dot menu for own comments */}
        {isOwn && !isEditing && (
          <div className="ml-auto relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded hover:bg-accent"
              aria-label="Comment actions"
            >
              <MoreVertical className="size-4" />
            </button>
            {showMenu && (
              <div
                ref={menuRef}
                className="absolute right-0 top-8 z-50 bg-popover border rounded-md shadow-md py-1 min-w-[100px]"
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(comment);
                  }}
                  className="px-3 py-1.5 text-sm hover:bg-accent cursor-pointer w-full text-left"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(comment);
                  }}
                  className="px-3 py-1.5 text-sm hover:bg-accent cursor-pointer w-full text-left text-destructive"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card body */}
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            className="min-h-[80px] resize-none"
          />
          {editError && <p className="text-xs text-destructive">{editError}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onCancelEdit} disabled={editPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => onSaveEdit(comment.id)}
              disabled={!editText.trim() || editPending}
            >
              {editPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <WikiRenderer wikiText={comment.body} attachments={attachmentMap} users={userMap} />
      )}

      {/* Delete error inline */}
      {deleteError && deletingCommentId === comment.id && (
        <p className="text-xs text-destructive">{deleteError}</p>
      )}
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function IssueDetailSkeleton() {
  return (
    <div data-testid="issue-detail-skeleton" className="flex h-full p-6 gap-6">
      <div className="flex-1 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="shrink-0 space-y-3" style={{ width: '42%' }}>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
    </div>
  );
}
