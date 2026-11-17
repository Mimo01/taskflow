import type { Editor } from '@tiptap/core';
import { useEffect, useImperativeHandle, useRef } from 'react';
import { cn } from '@/lib/utils';
import { WikiRenderer } from '@/routes/dashboard/WikiRenderer';
import { SourceSuggest } from './SourceSuggest';
import { applyInsert } from './source-edits';

export interface SourceHandle {
  insert(before: string, after?: string): void;
  focus(): void;
  focusAt(offset: number): void;
}

export interface SourceViewProps {
  value: string;
  onChange: (text: string) => void;
  previewVisible: boolean;
  ref?: React.Ref<SourceHandle>;
  minHeightClass: string;
  maxHeightClass: string;
  'aria-label'?: string;
  /** Enables @mention / :emoticon autocomplete. */
  editor?: Editor;
  /** Paste/drop files; return true when handled. */
  onFiles?: (files: File[]) => boolean;
}

/** Source mode: monospace textarea with a live WikiRenderer preview on the right. */
export function SourceView({
  value,
  onChange,
  previewVisible,
  ref,
  minHeightClass,
  maxHeightClass,
  'aria-label': ariaLabel,
  editor,
  onFiles,
}: SourceViewProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resize whenever the text changes
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  useImperativeHandle(ref, () => ({
    focus() {
      textareaRef.current?.focus();
    },
    focusAt(offset) {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const at = Math.max(0, Math.min(offset, el.value.length));
      el.setSelectionRange(at, at);
    },
    insert(before, after = '') {
      const el = textareaRef.current;
      if (!el) {
        onChange(value ? `${value}\n${before}${after}` : `${before}${after}`);
        return;
      }
      const next = applyInsert(value, el.selectionStart, el.selectionEnd, before, after);
      onChange(next.value);
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = next.selStart;
        el.selectionEnd = next.selEnd;
      });
    },
  }));

  const replaceRange = (from: number, to: number, text: string) => {
    const el = textareaRef.current;
    onChange(value.slice(0, from) + text + value.slice(to));
    if (!el) return;
    const caret = from + text.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const filesOf = (list: FileList | undefined | null) => Array.from(list ?? []);

  return (
    <div className={cn('flex overflow-y-auto', minHeightClass, maxHeightClass)}>
      <textarea
        ref={textareaRef}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        onPaste={(e) => {
          const files = filesOf(e.clipboardData?.files);
          if (files.length > 0 && onFiles?.(files)) e.preventDefault();
        }}
        onDragOver={(e) => {
          if (onFiles && Array.from(e.dataTransfer?.types ?? []).includes('Files')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDrop={(e) => {
          const files = filesOf(e.dataTransfer?.files);
          if (files.length > 0 && onFiles?.(files)) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className={cn(
          'min-w-[240px] w-full flex-1 resize-none bg-background p-4 font-mono text-sm outline-none',
          minHeightClass,
        )}
      />
      {editor ? (
        <SourceSuggest
          editor={editor}
          textareaRef={textareaRef}
          value={value}
          onReplace={replaceRange}
        />
      ) : null}
      <div
        className={cn(
          'min-w-0 flex-1 border-l border-border p-4',
          previewVisible ? '' : 'hidden',
          '@max-[35rem]:hidden',
        )}
      >
        <div className="mb-2 text-xs text-muted-foreground">Preview</div>
        {value ? (
          <WikiRenderer wikiText={value} />
        ) : (
          <p className="text-sm text-muted-foreground">Nothing to preview</p>
        )}
      </div>
    </div>
  );
}
