import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bold, Code, Italic, List } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { postComment } from '@/services/jira';
import { readSecret } from '@/services/stronghold';

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

export function CommentComposer({ issueKey, jiraBaseUrl }: CommentComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (body: string) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return postComment(jiraBaseUrl, token, issueKey, body);
    },
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
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
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment…"
        className="rounded-t-none min-h-[80px] resize-none"
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
