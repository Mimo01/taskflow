import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DraftNote } from '@/components/ui/draft-note';
import { Keycap } from '@/components/ui/keycap';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody } from '@/components/ui/tooltip-body';
import type { WikiEditorHandle } from '@/components/wiki-editor/types';
import { WikiEditorLazy } from '@/components/wiki-editor/WikiEditorLazy';
import { useEditorDraft } from '@/hooks/useEditorDraft';
import { draftKey } from '@/lib/draft-keys';
import type { JiraAttachment } from '@/services/jira';
import { postComment } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useComposerFocus } from '@/stores/composer-focus.store';
import { useIssueEditorHost } from './issue-detail/useIssueEditorHost';

interface CommentComposerProps {
  issueKey: string;
  jiraBaseUrl: string;
  attachments?: JiraAttachment[];
  userMap?: Readonly<Record<string, string>>;
  referenceTexts?: readonly string[];
  onOpenIssue?: (key: string) => void;
}

const NO_ATTACHMENTS: JiraAttachment[] = [];
const NO_USERS: Readonly<Record<string, string>> = {};
const NO_TEXTS: readonly string[] = [];

export function CommentComposer({
  issueKey,
  jiraBaseUrl,
  attachments = NO_ATTACHMENTS,
  userMap = NO_USERS,
  referenceTexts = NO_TEXTS,
  onOpenIssue,
}: CommentComposerProps) {
  const queryClient = useQueryClient();
  const draft = useEditorDraft({
    key: draftKey.commentNew(issueKey),
    kind: 'comment-new',
    issueKey,
  });
  const [text, setText] = useState(() => (draft.hydrated ? (draft.draft?.text ?? '') : ''));
  // Draft text is seeded into the editor at most once (or never if the user typed first).
  const seededRef = useRef(draft.hydrated);

  useEffect(() => {
    if (!draft.hydrated || seededRef.current) return;
    seededRef.current = true;
    if (text === '' && draft.draft) setText(draft.draft.text);
  }, [draft.hydrated, draft.draft, text]);

  const host = useIssueEditorHost({ issueKey, attachments, userMap, referenceTexts, onOpenIssue });

  const handleRef = useRef<WikiEditorHandle | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const setEditorHandle = useCallback((handle: WikiEditorHandle | null) => {
    handleRef.current = handle;
    setEditorReady(handle !== null);
  }, []);

  // One-shot "Reply" request from a notification: focus once the lazy editor is ready, then clear.
  const composerFocus = useComposerFocus((s) => s.composerFocus);
  const clearComposerFocus = useComposerFocus((s) => s.clearComposerFocus);
  useEffect(() => {
    if (composerFocus !== issueKey || !editorReady) return;
    handleRef.current?.focus({ toEnd: true });
    clearComposerFocus();
  }, [composerFocus, issueKey, editorReady, clearComposerFocus]);

  const mutation = useMutation({
    mutationFn: async (body: string) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return postComment(jiraBaseUrl, token, issueKey, body);
    },
    onSuccess: () => {
      seededRef.current = true;
      setText('');
      draft.discard();
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      queryClient.invalidateQueries({ queryKey: ['jira-issue-comments', issueKey, jiraBaseUrl] });
      handleRef.current?.focus();
    },
  });

  function handleChange(value: string) {
    seededRef.current = true;
    setText(value);
    if (value === '') draft.discard();
    else draft.schedule(value);
  }

  function send(value: string = text) {
    if (!value.trim() || mutation.isPending) return;
    mutation.mutate(value.trim());
  }

  function handleDiscard() {
    setText('');
    draft.discard();
    handleRef.current?.focus();
  }

  return (
    <div className="space-y-2">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: focusout bubbles to flush the draft */}
      <div onBlur={draft.flush}>
        <WikiEditorLazy
          ref={setEditorHandle}
          value={text}
          onChange={handleChange}
          preset="compact"
          placeholder="Add a comment…"
          aria-label="Add a comment"
          host={host}
          onSubmit={send}
          onCancel={() => handleRef.current?.blur()}
        />
      </div>
      {mutation.isError && (
        <p className="text-xs text-destructive">Failed to post comment — please try again</p>
      )}
      <div className="flex items-center justify-end gap-2">
        <DraftNote
          state={text.trim() ? draft.state : null}
          onDiscard={handleDiscard}
          onUseJira={() => {}}
          className="mr-auto"
        />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="sm"
                disabled={!text.trim() || mutation.isPending}
                onClick={() => send()}
              />
            }
          >
            {mutation.isPending ? 'Saving…' : 'Comment'}
          </TooltipTrigger>
          <TooltipContent>
            <TooltipBody>
              Comment <Keycap>⌘</Keycap>
              <Keycap>↵</Keycap>
            </TooltipBody>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
