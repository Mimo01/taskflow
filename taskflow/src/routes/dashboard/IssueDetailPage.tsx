/**
 * IssueDetailPage -- Full-page route-based issue detail view at /issue/:key.
 *
 * Replaces the old IssueDetailSheet (75vw slide-out panel) with a proper
 * route component that fills the main content area. Back arrow + breadcrumb
 * navigation shows the origin page and provides one-click return.
 *
 * Reads issueKey from route params. Origin page info comes via
 * location.state.from (set by handleIssueClick in main.tsx).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
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
  fetchEnrichedSubtasks,
  fetchEpicStories,
  fetchIssueDetail,
  updateComment,
} from '@/services/jira';
import { fetchIssueChangelog } from '@/services/jira/changelog';
import { fetchComments } from '@/services/jira/comments';
import { parseDuration } from '@/services/jira/duration';
import type { JiraWorklog } from '@/services/jira/types';
import { deleteWorklog, fetchFullWorklogs, updateWorklog } from '@/services/jira/worklogs';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
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
import type { AttachmentMap, UserMap } from './WikiRenderer';
import { WikiRenderer } from './WikiRenderer';

export default function IssueDetailPage() {
  const { key: issueKey } = useParams<{ key: string }>();
  const navigate = useNavigate();

  // Perf instrumentation — record start time on mount
  useEffect(() => {
    performance.mark('issue-detail-start');
  }, []);

  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('comment');
  const trail = useBreadcrumbStore((s) => s.trail);
  const breadcrumbPop = useBreadcrumbStore((s) => s.pop);

  const { onIssueClick, openEdit, openClone, openAddSubtask } = useOutletContext<{
    onIssueClick: (key: string) => void;
    openEdit: (vals: EditInitialValues) => void;
    openClone: (vals: EditInitialValues) => void;
    openAddSubtask: (parentKey: string) => void;
  }>();

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

  // Pinned state
  const isPinned = usePinnedTabsStore((s) => (issueKey ? s.pinnedKeys.includes(issueKey) : false));
  const togglePin = usePinnedTabsStore((s) => s.togglePin);

  // Recent items
  const pushRecentItem = useRecentItemsStore((s) => s.pushItem);

  // Fetch issue detail
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

  // Comments query — replaces issue?.fields.comment?.comments derivation
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
  // so a changed subtask list (add/remove/reorder) produces a fresh cache entry instead
  // of reusing enrichment keyed only on issueKey within the 30s staleTime (WR-04).
  const subtaskSignature = (issue?.fields.subtasks ?? []).map((s) => s.key).join(',');

  // Subtask enrichment query — only fires when base data has subtasks
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
      pushRecentItem({ type: 'jira', id: issueKey, title: issue.fields.summary });
    }
  }, [issueKey, issue?.fields.summary, issue, pushRecentItem]);

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
        console.table(performance.getEntriesByType('measure'));
      } catch {
        // performance.measure may throw if start mark is missing (e.g. HMR)
      }
    }
  }, [issue, commentsQuery.isPending, changelogQuery.isPending, subtasksSettled]);

  const handleBack = () => {
    if (trail.length > 0) {
      // Pop the last entry and navigate to it
      const target = trail[trail.length - 1];
      breadcrumbPop();
      navigate(target.path, { replace: true });
    } else {
      // No trail — go to a sensible default
      navigate('/dashboard');
    }
  };

  // Comment data — sourced from independent commentsQuery (not base issue response)
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

  // ─── Comment edit/delete mutations (lifted from old CommentThread) ──────────
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

  // Drag-to-resize for right panel.
  // initialPanelWidth is memoized on issueDetailPanelWidth only — containerRef.current
  // is intentionally excluded because it changes between renders (null pre-mount, then the
  // actual DOM width) and must not re-trigger the sync effect inside useResizable on
  // unrelated re-renders such as pin/unpin clicks.
  const containerRef = useRef<HTMLDivElement>(null);
  const initialPanelWidth = useMemo(
    () => issueDetailPanelWidth ?? Math.round((containerRef.current?.offsetWidth ?? 952) * 0.42),
    [issueDetailPanelWidth],
  );
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
  const { data: worklogs = [] } = useQuery({
    queryKey: ['jira-worklogs', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) return [];
      return fetchFullWorklogs(jiraBaseUrl, token, issueKey ?? '');
    },
    staleTime: 30_000,
    enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected,
  });

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
      // Worklogs are merged into the same activity feed as changelog entries, so a
      // worklog edit must also refresh the changelog-backed timeline history (WR-02).
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
      // Worklogs feed the same activity timeline as changelog entries; refresh it
      // so deleted-worklog history doesn't linger as stale changelog data (WR-02).
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
      // Jira worklog API requires "+0000" offset, not "Z" suffix
      started: original?.started ?? new Date().toISOString().replace('Z', '+0000'),
      comment: editWorklogComment || undefined,
    });
  };

  const handleWorklogEditCancel = () => {
    setEditingWorklogId(null);
    setEditDuration('');
    setEditWorklogComment('');
    setWorklogEditError(null);
  };

  if (!issueKey) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back + breadcrumb header — only shown when there's a trail */}
      {trail.length > 0 && (
        <div className="px-6 py-3 border-b flex items-center gap-2 text-sm flex-shrink-0">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted"
            aria-label="Go back"
          >
            <ArrowLeft className="size-4" />
          </button>
          {trail.map((entry, i) => (
            <span key={entry.path} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              <button
                type="button"
                onClick={() => {
                  useBreadcrumbStore.setState({ trail: trail.slice(0, i) });
                  navigate(entry.path, { replace: true });
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                {entry.label}
              </button>
            </span>
          ))}
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{issueKey}</span>
        </div>
      )}

      {/* Issue detail body — only base-fetch failure blanks the panel (D-08) */}
      {!issue ? (
        isLoading ? (
          <IssueDetailSkeleton />
        ) : (
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
        )
      ) : (
        <div ref={containerRef} className="flex flex-1 overflow-hidden">
          {/* Left column: scrollable content */}
          <div className="flex-1 overflow-auto min-w-0">
            <div className="p-6">
              <IssueDetailContent
                issue={issue}
                issueKey={issueKey}
                jiraBaseUrl={jiraBaseUrl ?? ''}
                comments={comments}
                onOpenIssue={onIssueClick}
                onEdit={openEdit}
                onClone={openClone}
                onAddSubtask={openAddSubtask}
                storyPointsFieldKey={storyPointsFieldKey}
                sprintFieldKey={sprintFieldKey}
                epicLinkFieldKey={epicLinkFieldKey}
                epicStories={epicStories}
                isPinned={isPinned}
                onTogglePin={togglePin}
                enrichedSubtasks={subtaskEnrichmentQuery.data as never}
                showSubtasksSkeleton={showSubtasksSkeleton}
                subtaskError={
                  subtaskEnrichmentQuery.isError ? (subtaskEnrichmentQuery.error as Error) : null
                }
                onSubtaskRetry={() =>
                  void queryClient.invalidateQueries({
                    queryKey: ['jira-subtask-enrichment', issueKey, jiraBaseUrl],
                  })
                }
              />
            </div>

            {/* Activity timeline + comment composer */}
            <div className="px-6">
              {/* AIO Test Runs — above comments per user preference; loads in parallel, gated by aioEnabled (D-15) */}
              <AioTestRunsSection
                issueKey={issueKey}
                jiraBaseUrl={jiraBaseUrl ?? ''}
                jiraIssueId={issue.id}
                description={issue.fields.description}
              />

              {/* Per-section error isolation: comment and changelog failures render as
                  inline non-blocking banners. The merged ActivityTimeline still renders the
                  surviving sections (e.g. a comments failure must NOT hide changelog/worklogs). */}
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
              {/* Mutually exclusive: while comments are still pending (and not errored)
                  show only the CommentsSkeleton. Otherwise render the merged timeline.
                  Rendering both at once produced a confusing "skeleton + No activity yet"
                  flash when changelog/worklog had already settled (WR-01). */}
              {showCommentsSkeleton && !commentsQuery.isError ? (
                <CommentsSkeleton />
              ) : (
                <ActivityTimeline
                  comments={commentsQuery.isError ? [] : comments}
                  changelog={
                    changelogQuery.isError
                      ? []
                      : showChangelogSkeleton
                        ? undefined
                        : changelogQuery.data
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
                <div className="sticky bottom-0 border-t py-3 -mx-6 px-6 bg-background">
                  <CommentComposer issueKey={issueKey} jiraBaseUrl={jiraBaseUrl ?? ''} />
                </div>
              )}
            </div>
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
            <IssueDetailSidebar
              issue={issue}
              issueKey={issueKey}
              jiraBaseUrl={jiraBaseUrl ?? ''}
              storyPointsFieldKey={storyPointsFieldKey}
              epicLinkFieldKey={epicLinkFieldKey}
              epicNameFieldKey={epicNameFieldKey}
              sprintFieldKey={sprintFieldKey}
              onOpenIssue={onIssueClick}
            />
          </div>
        </div>
      )}
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
    <div className="rounded-lg border bg-card p-3 space-y-2">
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
