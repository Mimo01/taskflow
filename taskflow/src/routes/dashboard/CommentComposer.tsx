import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { WikiEditorHandle } from '@/components/wiki-editor/types';
import { preloadWikiEditor, WikiEditorLazy } from '@/components/wiki-editor/WikiEditorLazy';
import { useEditorDraft } from '@/hooks/useEditorDraft';
import { draftKey } from '@/lib/draft-keys';
import type { JiraAttachment } from '@/services/jira';
import { postComment } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useComposerFocus } from '@/stores/composer-focus.store';
import { CommentActionRow } from './comment-editor/CommentActionRow';
import { COMMENT_EDITOR_MAX_HEIGHT } from './comment-editor/comment-editor-sizing';
import { useExpandOnFocus } from './comment-editor/useExpandOnFocus';
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

  // The first expand should not show the skeleton: see preloadWikiEditor.
  useEffect(() => {
    preloadWikiEditor().catch(() => {});
  }, []);

  // The rich editor can't convert the latest edit; `text` is the last good text, so no send.
  const [saveBlocked, setSaveBlocked] = useState(false);
  const handleRef = useRef<WikiEditorHandle | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const setEditorHandle = useCallback((handle: WikiEditorHandle | null) => {
    handleRef.current = handle;
    setEditorReady(handle !== null);
  }, []);

  const expand = useExpandOnFocus({ hasContent: text.trim() !== '', onBlur: draft.flush });
  const { wantsFocus, focusHandled, expand: expandComposer } = expand;

  // One-shot "Reply" request from a notification: expand, then focus once the lazy editor is ready.
  const composerFocus = useComposerFocus((s) => s.composerFocus);
  const clearComposerFocus = useComposerFocus((s) => s.clearComposerFocus);
  useEffect(() => {
    if (composerFocus !== issueKey) return;
    expandComposer();
    clearComposerFocus();
  }, [composerFocus, issueKey, expandComposer, clearComposerFocus]);
  useEffect(() => {
    if (!wantsFocus || !editorReady) return;
    handleRef.current?.focus({ toEnd: true });
    focusHandled();
  }, [wantsFocus, editorReady, focusHandled]);

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
    if (!value.trim() || mutation.isPending || saveBlocked) return;
    mutation.mutate(value.trim());
  }

  function handleDiscard() {
    setText('');
    draft.discard();
    handleRef.current?.focus();
  }

  return (
    <div className="space-y-2" {...expand.wrapperProps}>
      <div>
        {expand.expanded ? (
          <WikiEditorLazy
            ref={setEditorHandle}
            value={text}
            onChange={handleChange}
            preset="compact"
            placeholder="Add a comment…"
            aria-label="Add a comment"
            host={host}
            maxHeightClass={COMMENT_EDITOR_MAX_HEIGHT}
            onSubmit={send}
            onSaveBlockedChange={setSaveBlocked}
            onCancel={() => handleRef.current?.blur()}
          />
        ) : (
          <Input
            readOnly
            placeholder="Add a comment…"
            aria-label="Add a comment"
            className="h-8 cursor-text"
            onFocus={expand.expand}
            onClick={expand.expand}
          />
        )}
      </div>
      {expand.expanded && (
        <>
          {mutation.isError && (
            <p className="text-xs text-destructive">Failed to post comment — please try again</p>
          )}
          <CommentActionRow
            draftState={text.trim() ? draft.state : null}
            onDiscard={handleDiscard}
            onUseJira={() => {}}
            onAttachFiles={(files) => handleRef.current?.insertFiles(files)}
            attachDisabled={mutation.isPending}
            primaryLabel="Comment"
            pendingLabel="Posting…"
            pending={mutation.isPending}
            primaryDisabled={!text.trim() || saveBlocked}
            onPrimary={() => send()}
          />
        </>
      )}
    </div>
  );
}
