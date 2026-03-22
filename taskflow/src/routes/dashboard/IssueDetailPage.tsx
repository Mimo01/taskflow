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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { JiraComment, JiraIssue, TimelineFilter } from '@/services/jira';
import { deleteComment, fetchEpicStories, fetchIssueDetail, updateComment } from '@/services/jira';
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
import type { AttachmentMap, UserMap } from './WikiRenderer';
import { WikiRenderer } from './WikiRenderer';
import { ActivityTimeline } from './issue-detail/ActivityTimeline';

export default function IssueDetailPage() {
  const { key: issueKey } = useParams<{ key: string }>();
  const navigate = useNavigate();

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
      return fetchIssueDetail(jiraBaseUrl, token, issueKey!, {
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
      return fetchEpicStories(jiraBaseUrl, token, issueKey!, '', storyPointsFieldKey);
    },
    staleTime: 30_000,
    enabled: isEpic && !!jiraBaseUrl && !!jiraConnected,
  });

  // Track recent item when issue data is available
  useEffect(() => {
    if (issueKey && issue) {
      pushRecentItem({ type: 'jira', id: issueKey, title: issue.fields.summary });
    }
  }, [issueKey, issue?.fields.summary, issue, pushRecentItem]);

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

  // Comment data
  const comments: JiraComment[] = issue?.fields.comment?.comments ?? [];

  // Build attachment filename -> URL map for resolving !image.png! references
  const attachmentMap = useMemo<AttachmentMap>(() => {
    const map: AttachmentMap = {};
    for (const att of issue?.fields.attachment ?? []) {
      map[att.filename] = att.content;
    }
    return map;
  }, [issue?.fields.attachment]);

  // Build user lookup map from available issue data
  const userMap = useMemo<UserMap>(() => {
    const map: UserMap = {};
    const assignee = issue?.fields.assignee;
    const reporter = issue?.fields.reporter;
    if (assignee) {
      map[assignee.name] = assignee.displayName;
    }
    if (reporter) {
      if (reporter.name) map[reporter.name] = reporter.displayName;
      map[reporter.displayName] = reporter.displayName;
    }
    for (const c of comments) {
      if (c.author?.displayName) {
        const authorObj = c.author as { displayName: string; name?: string };
        if (authorObj.name) map[authorObj.name] = authorObj.displayName;
        map[authorObj.displayName] = authorObj.displayName;
      }
    }
    return map;
  }, [issue?.fields.assignee, issue?.fields.reporter, comments]);

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
      return updateComment(jiraBaseUrl!, token, issueKey!, commentId, body);
    },
    onSuccess: () => {
      setEditingCommentId(null);
      setEditText('');
      setEditError(null);
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
    },
    onError: (err: Error) => {
      setEditError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return deleteComment(jiraBaseUrl!, token, issueKey!, commentId);
    },
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
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

  const handleEdit = useCallback((comment: JiraComment) => {
    setEditingCommentId(comment.id);
    setEditText(comment.body);
    setEditError(null);
  }, []);

  const handleDelete = useCallback((comment: JiraComment) => {
    if (!window.confirm('Delete this comment? This cannot be undone.')) return;
    setDeleteError(null);
    deleteMutateRef.current(comment.id);
  }, []);

  const handleSaveEdit = useCallback((commentId: string) => {
    const text = editTextRef.current.trim();
    if (!text) return;
    editMutateRef.current({ commentId, body: text });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingCommentId(null);
    setEditText('');
    setEditError(null);
  }, []);

  // ─── Worklog data + CRUD ──────────────────────────────────────────────────────
  const { data: worklogs = [] } = useQuery({
    queryKey: ['jira-worklogs', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) return [];
      return fetchFullWorklogs(jiraBaseUrl, token, issueKey!);
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
      return updateWorklog(jiraBaseUrl!, token, issueKey!, worklogId, {
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
    },
    onError: (err: Error) => setWorklogEditError(err.message),
  });

  const worklogDeleteMutation = useMutation({
    mutationFn: async (worklogId: string) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return deleteWorklog(jiraBaseUrl!, token, issueKey!, worklogId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      queryClient.invalidateQueries({ queryKey: ['jira-worklogs', issueKey, jiraBaseUrl] });
    },
  });

  const handleWorklogEdit = useCallback((worklog: JiraWorklog) => {
    setEditingWorklogId(worklog.id);
    setEditDuration(worklog.timeSpent);
    setEditWorklogComment(worklog.comment ?? '');
    setWorklogEditError(null);
  }, []);

  const handleWorklogDelete = useCallback(
    (worklog: JiraWorklog) => {
      if (!window.confirm('Delete worklog: Remove this time entry? This cannot be undone.')) return;
      worklogDeleteMutation.mutate(worklog.id);
    },
    [worklogDeleteMutation],
  );

  const handleWorklogEditSave = useCallback(
    (worklogId: string) => {
      const parsed = parseDuration(editDuration);
      if (!parsed) {
        setWorklogEditError("Couldn't parse duration");
        return;
      }
      const original = worklogs.find((w) => w.id === worklogId);
      worklogEditMutation.mutate({
        worklogId,
        timeSpentSeconds: parsed.seconds,
        started: original?.started ?? new Date().toISOString(),
        comment: editWorklogComment || undefined,
      });
    },
    [editDuration, editWorklogComment, worklogs, worklogEditMutation],
  );

  const handleWorklogEditCancel = useCallback(() => {
    setEditingWorklogId(null);
    setEditDuration('');
    setEditWorklogComment('');
    setWorklogEditError(null);
  }, []);

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

      {/* Issue detail body */}
      {isLoading || !issue ? (
        <IssueDetailSkeleton />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left column: scrollable content */}
          <div className="flex-1 overflow-auto">
            <div className="p-6">
              <IssueDetailContent
                issue={issue}
                issueKey={issueKey}
                jiraBaseUrl={jiraBaseUrl!}
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
              />
            </div>

            {/* Activity timeline + comment composer */}
            <div className="px-6">
              <ActivityTimeline
                comments={comments}
                changelog={issue.changelog?.histories ?? []}
                worklogs={worklogs}
                issueKey={issueKey}
                jiraBaseUrl={jiraBaseUrl!}
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

              {(timelineFilter === 'comment' || timelineFilter === 'all') && (
                <div className="sticky bottom-0 border-t py-3 -mx-6 px-6 bg-background">
                  <CommentComposer issueKey={issueKey} jiraBaseUrl={jiraBaseUrl!} />
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="w-[42%] border-l overflow-auto p-4 shrink-0">
            <IssueDetailSidebar
              issue={issue}
              issueKey={issueKey}
              jiraBaseUrl={jiraBaseUrl!}
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

const CommentCard = memo(function CommentCard({
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
        <span className="text-muted-foreground" title={new Date(comment.created).toLocaleString()}>{relativeTime(comment.created)}</span>
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
});

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
      <div className="w-[42%] space-y-3">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
    </div>
  );
}
