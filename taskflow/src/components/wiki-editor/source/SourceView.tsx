import { useEffect, useImperativeHandle, useRef } from 'react';
import { cn } from '@/lib/utils';
import { WikiRenderer } from '@/routes/dashboard/WikiRenderer';
import { applyInsert } from './source-edits';

export interface SourceHandle {
  insert(before: string, after?: string): void;
  focus(): void;
}

export interface SourceViewProps {
  value: string;
  onChange: (text: string) => void;
  previewVisible: boolean;
  ref?: React.Ref<SourceHandle>;
  minHeightClass: string;
  maxHeightClass: string;
  'aria-label'?: string;
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

  return (
    <div className={cn('flex overflow-y-auto', minHeightClass, maxHeightClass)}>
      <textarea
        ref={textareaRef}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className={cn(
          'min-w-[240px] w-full flex-1 resize-none bg-background p-4 font-mono text-sm outline-none',
          minHeightClass,
        )}
      />
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
