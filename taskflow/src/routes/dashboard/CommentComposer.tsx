/**
 * CommentComposer — comment entry using the shared <WikiEditor>.
 *
 * Replaces the old textarea+toolbar+MentionPopover implementation with the
 * unified WYSIWYG editor. Mention autocomplete is wired inside WikiEditor via
 * the mention prop (same fetchAssignableUsers data source as before).
 *
 * The "Comment" button and mutation are UNCHANGED — only the input surface
 * is replaced. postComment still receives Jira wiki markup from onChange.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { WikiEditor } from '@/components/wiki-editor';
import { postComment } from '@/services/jira';
import { readSecret } from '@/services/stronghold';

interface CommentComposerProps {
  issueKey: string;
  jiraBaseUrl: string;
}

export function CommentComposer({ issueKey, jiraBaseUrl }: CommentComposerProps) {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();

  const projectKey = issueKey.split('-')[0];

  const mutation = useMutation({
    mutationFn: async (body: string) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return postComment(jiraBaseUrl, token, issueKey, body);
    },
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      queryClient.invalidateQueries({ queryKey: ['jira-issue-comments', issueKey, jiraBaseUrl] });
    },
  });

  return (
    <div className="space-y-2">
      <WikiEditor
        value={text}
        onChange={setText}
        variant="comment"
        placeholder="Add a comment…"
        mention={{ projectKey, jiraBaseUrl }}
        onSubmit={() => {
          if (text.trim()) mutation.mutate(text.trim());
        }}
        showSourceToggle
      />
      {mutation.isError && (
        <p className="text-xs text-destructive">Failed to post comment — please try again</p>
      )}
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!text.trim() || mutation.isPending}
          onClick={() => mutation.mutate(text.trim())}
        >
          {mutation.isPending ? 'Saving…' : 'Comment'}
        </Button>
      </div>
    </div>
  );
}
