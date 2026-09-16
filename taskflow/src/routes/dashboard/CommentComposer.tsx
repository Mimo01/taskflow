import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bold, Code, Italic, List, Paperclip } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { attachmentRef } from '@/lib/attachment-markup';
import type { JiraAttachment } from '@/services/jira';
import { postComment } from '@/services/jira';
import { uploadAttachment } from '@/services/jira/attachments';
import type { JiraAssignableUser } from '@/services/jira/types';
import { readSecret } from '@/services/stronghold';
import { AttachmentPickerModal } from './issue-detail/AttachmentPickerModal';
import { MentionPopover, type MentionPopoverHandle } from './MentionPopover';
import { WikiRenderer } from './WikiRenderer';

interface CommentComposerProps {
  issueKey: string;
  jiraBaseUrl: string;
  attachments?: JiraAttachment[];
}

function applyMarkup(textarea: HTMLTextAreaElement, prefix: string, suffix: string) {
  const { selectionStart, selectionEnd, value } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const newValue = `${before}${prefix}${selected}${suffix}${after}`;
  const cursorPos = selectionStart + prefix.length + selected.length + suffix.length;
  return { newValue, cursorPos };
}

/**
 * Measure cursor pixel position inside a textarea using a mirror div.
 * Returns `bottom` (distance from bottom of the relative wrapper to the
 * cursor line) and `left`, so the popover opens above the text being typed.
 */
function getCursorPixelPosition(
  textarea: HTMLTextAreaElement,
  cursorIndex: number,
): { bottom: number; left: number } {
  const mirror = document.createElement('div');
  const style = getComputedStyle(textarea);

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.width = style.width;
  mirror.style.font = style.font;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.lineHeight = style.lineHeight;

  const textBefore = textarea.value.substring(0, cursorIndex);
  mirror.textContent = textBefore;
  const marker = document.createElement('span');
  marker.textContent = '|';
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();

  const cursorTopInTextarea = markerRect.top - mirrorRect.top - textarea.scrollTop;
  const position = {
    bottom: textarea.offsetHeight - cursorTopInTextarea + 4,
    left: Math.min(markerRect.left - mirrorRect.left, textarea.offsetWidth - 220),
  };
  document.body.removeChild(mirror);
  return position;
}

export function CommentComposer({ issueKey, jiraBaseUrl, attachments = [] }: CommentComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionPopoverRef = useRef<MentionPopoverHandle>(null);
  const queryClient = useQueryClient();

  // @mention state
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionPosition, setMentionPosition] = useState({ bottom: 0, left: 0 });
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);

  // Attachment picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingName, setUploadingName] = useState<string | null>(null);

  const projectKey = issueKey.split('-')[0];

  const attachmentMap = Object.fromEntries(attachments.map((a) => [a.filename, a.content]));

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

  function insertRef(ref: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { newValue, cursorPos } = applyMarkup(textarea, ref, '');
    setText(newValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  }

  // Upload-on-paste/drop: mirrors AttachmentsSection.tsx:48-64's mutationFn
  // verbatim so both surfaces share the exact readSecret -> uploadAttachment path.
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No Jira credentials');
      return uploadAttachment(jiraBaseUrl, token, issueKey, file);
    },
    onSuccess: (created) => {
      setUploadingName(null);
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      const att = created[0];
      if (att) insertRef(attachmentRef(att));
    },
    onError: () => {
      setUploadError(`Failed to upload ${uploadingName ?? 'file'}. Check file size and try again.`);
      setUploadingName(null);
    },
  });

  function handleMarkup(prefix: string, suffix: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { newValue, cursorPos } = applyMarkup(textarea, prefix, suffix);
    setText(newValue);
    // Restore focus and cursor after state update
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  }

  function handleAttachmentSelect(att: JiraAttachment) {
    insertRef(attachmentRef(att));
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const file = e.clipboardData.files?.[0];
    if (file) {
      e.preventDefault();
      setUploadError(null);
      setUploadingName(file.name);
      uploadMutation.mutate(file);
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLTextAreaElement>) {
    // Required for `onDrop` to fire at all (HTML5 DnD spec) — dropEffect
    // hints the browser this target accepts a file drop.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    const file = e.dataTransfer.files?.[0];
    if (file) {
      e.preventDefault();
      // Stop the section-level drop handler on AttachmentsSection (see
      // AttachmentsSection.tsx:122) from also handling this drop and double-uploading.
      e.stopPropagation();
      setUploadError(null);
      setUploadingName(file.name);
      uploadMutation.mutate(file);
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newText = e.target.value;
    setText(newText);

    const textarea = e.target;
    const cursorPos = textarea.selectionStart;

    if (mentionActive) {
      const queryText = newText.slice(mentionStart + 1, cursorPos);
      if (queryText.includes(' ') || cursorPos <= mentionStart) {
        setMentionActive(false);
      } else {
        setMentionQuery(queryText);
      }
    } else {
      const charBefore = cursorPos > 0 ? newText[cursorPos - 1] : '';
      const charBeforeAt = cursorPos > 1 ? newText[cursorPos - 2] : ' ';
      if (
        charBefore === '@' &&
        (charBeforeAt === ' ' || charBeforeAt === '\n' || cursorPos === 1)
      ) {
        setMentionActive(true);
        setMentionStart(cursorPos - 1);
        setMentionQuery('');
        const pos = getCursorPixelPosition(textarea, cursorPos - 1);
        setMentionPosition(pos);
      }
    }
  }

  function handleMentionSelect(user: JiraAssignableUser) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const before = text.slice(0, mentionStart);
    const after = text.slice(textarea.selectionStart);
    const mention = `[~${user.name}]`;
    const newText = `${before}${mention}${after}`;
    const cursorPos = mentionStart + mention.length;

    setText(newText);
    setMentionActive(false);
    setMentionQuery('');
    setMentionStart(-1);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionActive) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionActive(false);
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        mentionPopoverRef.current?.handleKeyDown(e.key);
        return;
      }
    }
  }

  // Stable callback so MentionPopover's notify effect doesn't refire each render.
  const handleMentionActiveChange = useCallback((index: number) => {
    setMentionActiveIndex(index);
  }, []);

  // Derive active option id for aria-activedescendant — tracks the option the
  // MentionPopover currently highlights so screen readers announce the right one (WR-03).
  const activeDescendant = mentionActive ? `mention-option-${mentionActiveIndex}` : undefined;

  return (
    <div className="space-y-2">
      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="edit">
          <div className="space-y-2">
            {/* Toolbar */}
            <div className="flex items-center gap-1 border rounded-t-md px-2 py-1 bg-muted/30">
              <button
                type="button"
                onClick={() => handleMarkup('*', '*')}
                title="Bold"
                className="p-1 rounded hover:bg-accent"
              >
                <Bold className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleMarkup('_', '_')}
                title="Italic"
                className="p-1 rounded hover:bg-accent"
              >
                <Italic className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleMarkup('{code}', '{code}')}
                title="Code block"
                className="p-1 rounded hover:bg-accent"
              >
                <Code className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleMarkup('* ', '')}
                title="Bullet list"
                className="p-1 rounded hover:bg-accent"
              >
                <List className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                title="Insert attachment"
                className="p-1 rounded hover:bg-accent"
              >
                <Paperclip className="size-3.5" />
              </button>
            </div>
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                placeholder="Add a comment…"
                className="rounded-t-none min-h-[80px] resize-none"
                aria-activedescendant={activeDescendant}
              />
              {mentionActive && (
                <MentionPopover
                  ref={mentionPopoverRef}
                  query={mentionQuery}
                  projectKey={projectKey}
                  jiraBaseUrl={jiraBaseUrl}
                  position={mentionPosition}
                  onSelect={handleMentionSelect}
                  onDismiss={() => setMentionActive(false)}
                  onActiveChange={handleMentionActiveChange}
                />
              )}
            </div>
            {uploadingName && uploadMutation.isPending && (
              <p className="text-xs text-muted-foreground">{uploadingName} uploading…</p>
            )}
            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
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
        </TabsContent>
        <TabsContent value="preview">
          {text ? (
            <WikiRenderer wikiText={text} attachments={attachmentMap} className="min-h-[80px]" />
          ) : (
            <p className="min-h-[80px] text-sm text-muted-foreground">Nothing to preview</p>
          )}
        </TabsContent>
      </Tabs>
      <AttachmentPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        attachments={attachments}
        onSelect={handleAttachmentSelect}
      />
    </div>
  );
}
