/**
 * InlineComment — Rich inline comment list with WikiRenderer, edit/delete for
 * own comments, and WikiEditor as both the composer and inline edit surface.
 *
 * The old textarea+toolbar+applyMarkup implementation is replaced by <WikiEditor>.
 * Comment list, edit/delete menu, and mutations are UNCHANGED.
 * userMap is passed to WikiEditor as users= for mention display resolution.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreVertical } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { WikiEditor } from '@/components/wiki-editor';
import { useMentionUserMap } from '@/hooks/useMentionUserMap';
import type { JiraComment } from '@/services/jira';
import { deleteComment, updateComment } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { relativeTime } from './IssueDetailContent';
import { WikiRenderer } from './WikiRenderer';

interface InlineCommentProps {
  issueKey: string;
  jiraBaseUrl: string;
  isOpen: boolean;
  onCancel: () => void;
  onSubmit: (comment: string) => void;
  isSubmitting: boolean;
  error?: string;
  existingComments?: JiraComment[];
  isLoadingComments?: boolean;
}

export default function InlineComment({
  issueKey,
  jiraBaseUrl,
  isOpen,
  onCancel,
  onSubmit,
  isSubmitting,
  error,
  existingComments,
  isLoadingComments,
}: InlineCommentProps) {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();
  const jiraUserDisplayName = useAuthStore((s) => s.jiraUserDisplayName);
  const commentSortOrder = useSettingsStore((s) => s.commentSortOrder);

  const projectKey = issueKey.split('-')[0];

  const sortedComments = !existingComments
    ? undefined
    : commentSortOrder === 'newest'
      ? [...existingComments].reverse()
      : existingComments;

  const initialUserMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of existingComments ?? []) {
      const author = c.author as { displayName: string; name?: string };
      if (author.name) map[author.name] = author.displayName;
      map[author.displayName] = author.displayName;
    }
    return map;
  }, [existingComments]);

  const commentTexts = useMemo(
    () => (existingComments ?? []).map((c) => c.body),
    [existingComments],
  );

  const userMap = useMentionUserMap(initialUserMap, commentTexts, jiraBaseUrl);

  // Edit state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setText('');
      setEditingCommentId(null);
      setEditText('');
      setOpenMenuId(null);
    }
  }, [isOpen]);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId]);

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async ({ commentId, body }: { commentId: string; body: string }) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return updateComment(jiraBaseUrl, token, issueKey, commentId, body);
    },
    onSuccess: () => {
      setEditingCommentId(null);
      setEditText('');
      queryClient.invalidateQueries({ queryKey: ['jira-comments', issueKey] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return deleteComment(jiraBaseUrl, token, issueKey, commentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-comments', issueKey] });
    },
  });

  if (!isOpen) return null;

  function handleCancel() {
    setText('');
    onCancel();
  }

  function handleSubmit() {
    if (text.trim()) {
      onSubmit(text.trim());
    }
  }

  function handleEditStart(comment: JiraComment) {
    setEditingCommentId(comment.id);
    setEditText(comment.body);
    setOpenMenuId(null);
  }

  function handleEditSave(commentId: string) {
    const trimmed = editText.trim();
    if (!trimmed) return;
    editMutation.mutate({ commentId, body: trimmed });
  }

  function handleEditCancel() {
    setEditingCommentId(null);
    setEditText('');
  }

  function handleDelete(comment: JiraComment) {
    setOpenMenuId(null);
    if (!window.confirm('Delete this comment? This cannot be undone.')) return;
    deleteMutation.mutate(comment.id);
  }

  return (
    <div className="px-3 pb-2 flex flex-col gap-1.5">
      {isLoadingComments && (
        <p className="text-xs text-muted-foreground py-1">Loading comments...</p>
      )}
      {!isLoadingComments && sortedComments && sortedComments.length > 0 && (
        <div className="flex flex-col gap-2 mb-2 max-h-64 overflow-y-auto">
          {sortedComments.map((c) => {
            const isOwn = c.author.displayName === jiraUserDisplayName;
            const isEditing = editingCommentId === c.id;

            return (
              <div key={c.id} className="rounded-lg border bg-card p-3 space-y-2">
                {/* Header */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-sm">{c.author.displayName}</span>
                  <span className="text-muted-foreground">{relativeTime(c.created)}</span>
                  {c.updated !== c.created && (
                    <span className="text-muted-foreground italic">(edited)</span>
                  )}

                  {/* 3-dot menu for own comments */}
                  {isOwn && !isEditing && (
                    <div className="ml-auto relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                        className="p-1 rounded hover:bg-accent"
                        aria-label="Comment actions"
                      >
                        <MoreVertical className="size-4" />
                      </button>
                      {openMenuId === c.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-0 top-8 z-50 bg-popover border rounded-md shadow-md py-1 min-w-[100px]"
                        >
                          <button
                            type="button"
                            onClick={() => handleEditStart(c)}
                            className="px-3 py-1.5 text-sm hover:bg-accent cursor-pointer w-full text-left"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            className="px-3 py-1.5 text-sm hover:bg-accent cursor-pointer w-full text-left text-destructive"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Body */}
                {isEditing ? (
                  <div className="space-y-2">
                    <WikiEditor
                      value={editText}
                      onChange={setEditText}
                      variant="comment"
                      users={userMap}
                      mention={{ projectKey, jiraBaseUrl }}
                      showSourceToggle
                    />
                    {editMutation.isError && (
                      <p className="text-xs text-destructive">
                        {(editMutation.error as Error).message}
                      </p>
                    )}
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEditCancel}
                        disabled={editMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleEditSave(c.id)}
                        disabled={!editText.trim() || editMutation.isPending}
                      >
                        {editMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <WikiRenderer wikiText={c.body} attachments={{}} users={userMap} />
                )}

                {/* Delete error */}
                {deleteMutation.isError && deleteMutation.variables === c.id && (
                  <p className="text-xs text-destructive">
                    {(deleteMutation.error as Error).message}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Composer — WikiEditor replaces textarea+toolbar */}
      <WikiEditor
        value={text}
        onChange={setText}
        variant="inline"
        placeholder="Add a comment..."
        mention={{ projectKey, jiraBaseUrl }}
        users={userMap}
        submitOnEnter
        onSubmit={handleSubmit}
        showSourceToggle
      />

      {error && <p className="text-xs text-destructive">Failed to add comment -- try again</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || text.trim().length === 0}
          className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded px-3 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
