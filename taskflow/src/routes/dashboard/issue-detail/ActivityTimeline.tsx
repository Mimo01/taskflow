/**
 * ActivityTimeline -- unified activity feed merging comments, changelog entries,
 * and worklog entries.
 *
 * Uses mergeTimeline / filterTimeline / countByType from the jira-changelog
 * service for data processing.
 */
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChangelogHistory, JiraComment, TimelineFilter } from '@/services/jira';
import { countByType, filterTimeline, mergeTimeline } from '@/services/jira';
import type { JiraWorklog } from '@/services/jira/types';
import { useSettingsStore } from '@/stores/settings.store';
import type { AttachmentMap, UserMap } from '../WikiRenderer';
import { ChangelogEntry } from './ChangelogEntry';
import { TimelineFilterChips } from './TimelineFilterChips';
import { WorklogEntry } from './WorklogEntry';

interface ActivityTimelineProps {
  comments: JiraComment[];
  changelog: ChangelogHistory[] | undefined;
  worklogs: JiraWorklog[];
  issueKey: string;
  jiraBaseUrl: string;
  jiraUserDisplayName: string | null;
  attachmentMap: AttachmentMap;
  userMap: UserMap;
  /** Comment edit/delete wiring -- passed through to CommentCard */
  editingCommentId: string | null;
  editText: string;
  onEditStart: (comment: JiraComment) => void;
  onEditChange: (text: string) => void;
  onEditSave: (commentId: string) => void;
  onEditCancel: () => void;
  onDelete: (comment: JiraComment) => void;
  editError: string | null;
  deleteError: string | null;
  deletingCommentId: string | null;
  editPending: boolean;
  /** Callback when filter changes -- parent can use to show/hide CommentComposer */
  onFilterChange?: (filter: TimelineFilter) => void;
  /** The CommentCard component to render comments -- injected from IssueDetailPage */
  CommentCard: React.ComponentType<{
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
  }>;
  /** Worklog edit/delete wiring */
  editingWorklogId: string | null;
  editDuration: string;
  editWorklogComment: string;
  onWorklogEditStart: (worklog: JiraWorklog) => void;
  onWorklogEditDurationChange: (value: string) => void;
  onWorklogEditCommentChange: (value: string) => void;
  onWorklogEditSave: (worklogId: string) => void;
  onWorklogEditCancel: () => void;
  onWorklogDelete: (worklog: JiraWorklog) => void;
  worklogEditPending: boolean;
  worklogEditError: string | null;
}

export function ActivityTimeline({
  comments,
  changelog,
  worklogs,
  jiraBaseUrl,
  jiraUserDisplayName,
  attachmentMap,
  userMap,
  editingCommentId,
  editText,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDelete,
  editError,
  deleteError,
  deletingCommentId,
  editPending,
  onFilterChange: onFilterChangeProp,
  CommentCard,
  editingWorklogId,
  editDuration,
  editWorklogComment,
  onWorklogEditStart,
  onWorklogEditDurationChange,
  onWorklogEditCommentChange,
  onWorklogEditSave,
  onWorklogEditCancel,
  onWorklogDelete,
  worklogEditPending,
  worklogEditError,
}: ActivityTimelineProps) {
  const commentSortOrder = useSettingsStore((s) => s.commentSortOrder);
  const [filter, setFilterState] = useState<TimelineFilter>('comment');
  const setFilter = (f: TimelineFilter) => {
    setFilterState(f);
    onFilterChangeProp?.(f);
  };

  // Loading state: if changelog is undefined (not yet fetched), show skeleton
  if (changelog === undefined) {
    return (
      <section className="mt-6 pb-4 space-y-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </section>
    );
  }

  const allEntries = mergeTimeline(comments, changelog, worklogs);

  // mergeTimeline returns newest-first. If user wants oldest-first, reverse.
  const sortedEntries = commentSortOrder === 'oldest' ? [...allEntries].reverse() : allEntries;

  const counts = countByType(allEntries);
  const visibleEntries = filterTimeline(sortedEntries, filter);

  const noActivity = allEntries.length === 0;
  const filteredEmpty = !noActivity && visibleEntries.length === 0;

  function filterLabel(f: TimelineFilter): string {
    if (f === 'change') return 'changes';
    if (f === 'worklog') return 'worklogs';
    return 'comments';
  }

  return (
    <section className="mt-6 pb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">Activity</h3>
        {!noActivity && (
          <TimelineFilterChips counts={counts} active={filter} onFilterChange={setFilter} />
        )}
      </div>

      {noActivity ? (
        <div className="text-center py-8">
          <p className="text-sm font-medium text-muted-foreground">No activity yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Comments and field changes will appear here as the issue is updated.
          </p>
        </div>
      ) : filteredEmpty ? (
        <div className="text-center py-8">
          <p className="text-sm font-medium text-muted-foreground">
            No {filterLabel(filter)} found
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            This issue has no {filterLabel(filter)} recorded.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {visibleEntries.map((entry) => {
            if (entry.type === 'change') {
              return (
                <li key={`change-${entry.data.id}`}>
                  <ChangelogEntry history={entry.data} />
                </li>
              );
            }

            if (entry.type === 'worklog') {
              const worklog = entry.data;
              const isOwn = worklog.author.displayName === jiraUserDisplayName;
              const isEditing = editingWorklogId === worklog.id;
              return (
                <li key={`worklog-${worklog.id}`}>
                  <WorklogEntry
                    worklog={worklog}
                    isOwn={isOwn}
                    jiraBaseUrl={jiraBaseUrl}
                    onEdit={onWorklogEditStart}
                    onDelete={onWorklogDelete}
                    isEditing={isEditing}
                    editDuration={isEditing ? editDuration : ''}
                    editComment={isEditing ? editWorklogComment : ''}
                    onEditDurationChange={onWorklogEditDurationChange}
                    onEditCommentChange={onWorklogEditCommentChange}
                    onEditSave={onWorklogEditSave}
                    onEditCancel={onWorklogEditCancel}
                    editPending={isEditing ? worklogEditPending : false}
                    editError={isEditing ? worklogEditError : null}
                  />
                </li>
              );
            }

            // entry.type === 'comment'
            const comment = entry.data;
            const isOwn = comment.author.displayName === jiraUserDisplayName;
            const isEditing = editingCommentId === comment.id;

            return (
              <li key={`comment-${comment.id}`}>
                <CommentCard
                  comment={comment}
                  isOwn={isOwn}
                  isEditing={isEditing}
                  editText={isEditing ? editText : ''}
                  editError={isEditing ? editError : null}
                  deleteError={deletingCommentId === comment.id ? deleteError : null}
                  deletingCommentId={deletingCommentId}
                  editPending={isEditing ? editPending : false}
                  onEdit={onEditStart}
                  onDelete={onDelete}
                  onSaveEdit={onEditSave}
                  onCancelEdit={onEditCancel}
                  onEditTextChange={onEditChange}
                  attachmentMap={attachmentMap}
                  userMap={userMap}
                />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
