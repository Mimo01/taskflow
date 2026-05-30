import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bold, Code, Italic, List } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { postComment } from '@/services/jira';
import type { JiraAssignableUser } from '@/services/jira/types';
import { readSecret } from '@/services/stronghold';
import { MentionPopover, type MentionPopoverHandle } from './MentionPopover';

interface CommentComposerProps {
  issueKey: string;
  jiraBaseUrl: string;
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

export function CommentComposer({ issueKey, jiraBaseUrl }: CommentComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionPopoverRef = useRef<MentionPopoverHandle>(null);
  const queryClient = useQueryClient();

  // @mention state
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionPosition, setMentionPosition] = useState({ bottom: 0, left: 0 });

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

  // Derive active option id for aria-activedescendant
  const activeDescendant = mentionActive ? `mention-option-0` : undefined;

  return (
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
      </div>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
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
          />
        )}
      </div>
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
