/**
 * WorklogEntry -- Two-line timeline entry for worklog items.
 *
 * Shows author, duration badge, relative timestamp, and optional comment.
 * 3-dot menu (Edit/Delete) appears only for the current user's entries.
 * Inline edit mode swaps duration and comment with editable fields.
 */
import { MoreVertical } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { JiraWorklog } from '@/services/jira/types';
import { relativeTime } from '../IssueDetailContent';
import { DurationInput } from './DurationInput';

interface WorklogEntryProps {
  worklog: JiraWorklog;
  isOwn: boolean;
  jiraBaseUrl: string;
  onEdit: (worklog: JiraWorklog) => void;
  onDelete: (worklog: JiraWorklog) => void;
  isEditing: boolean;
  editDuration: string;
  editComment: string;
  onEditDurationChange: (value: string) => void;
  onEditCommentChange: (value: string) => void;
  onEditSave: (worklogId: string) => void;
  onEditCancel: () => void;
  editPending: boolean;
  editError: string | null;
}

export function WorklogEntry({
  worklog,
  isOwn,
  onEdit,
  onDelete,
  isEditing,
  editDuration,
  editComment,
  onEditDurationChange,
  onEditCommentChange,
  onEditSave,
  onEditCancel,
  editPending,
  editError,
}: WorklogEntryProps) {
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

  const initials = worklog.author.displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      {/* Header line */}
      <div className="flex items-center gap-2 text-xs">
        {/* Avatar */}
        {worklog.author.avatarUrls?.['48x48'] ? (
          <img
            src={worklog.author.avatarUrls['48x48']}
            alt={worklog.author.displayName}
            className="size-5 rounded-full"
          />
        ) : (
          <span className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
            {initials}
          </span>
        )}
        <span className="font-semibold text-sm">{worklog.author.displayName}</span>
        {!isEditing && <Badge variant="secondary">{worklog.timeSpent}</Badge>}
        <span
          className="text-xs text-muted-foreground"
          title={new Date(worklog.started).toLocaleString()}
        >
          {relativeTime(worklog.started)}
        </span>

        {/* 3-dot menu for own entries */}
        {isOwn && !isEditing && (
          <div className="ml-auto relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded hover:bg-accent"
              aria-label="Worklog actions"
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
                    onEdit(worklog);
                  }}
                  className="px-3 py-1.5 text-sm hover:bg-accent cursor-pointer w-full text-left"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(worklog);
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

      {/* Body: comment or edit mode */}
      {isEditing ? (
        <div className="space-y-2">
          <DurationInput value={editDuration} onChange={onEditDurationChange} />
          <Input
            value={editComment}
            onChange={(e) => onEditCommentChange(e.target.value)}
            placeholder="Work description (optional)"
            className="h-8 text-xs"
          />
          {editError && <p className="text-xs text-destructive">{editError}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onEditCancel} disabled={editPending}>
              Discard Changes
            </Button>
            <Button size="sm" onClick={() => onEditSave(worklog.id)} disabled={editPending}>
              {editPending ? 'Saving...' : 'Update Entry'}
            </Button>
          </div>
        </div>
      ) : worklog.comment ? (
        <p className="text-sm text-muted-foreground">{worklog.comment}</p>
      ) : null}
    </div>
  );
}
