/*
 * Shared textarea stub of WikiEditorLazy for host-logic tests (fast, no TipTap).
 *
 * Usage:
 *   vi.mock('@/components/wiki-editor/WikiEditorLazy', async () =>
 *     (await import('@/test/wiki-editor-stub')).wikiEditorLazyMock);
 *
 * Hosts must import the editor as `import { WikiEditorLazy } from
 * '@/components/wiki-editor/WikiEditorLazy'` so the mock path matches.
 */
import { useImperativeHandle, useRef } from 'react';
import type { WikiEditorHandle, WikiEditorProps } from '@/components/wiki-editor/types';

/** Props the stub received on its latest render, for asserting preset/host/placeholder. */
export const lastStubProps: { current: WikiEditorProps | null } = { current: null };

export function WikiEditorLazyStub(props: WikiEditorProps) {
  const { value, onChange, placeholder, onSubmit, onCancel, host, ref } = props;
  lastStubProps.current = props;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(
    ref,
    (): WikiEditorHandle => ({
      focus: (opts) => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        if (opts?.toEnd) el.setSelectionRange(el.value.length, el.value.length);
      },
      blur: () => textareaRef.current?.blur(),
      insertFiles: (files) => {
        for (const file of files) {
          if (host?.staged && host.stageFile) host.stageFile(file);
          else void host?.uploadFile?.(file);
        }
      },
    }),
  );

  return (
    <textarea
      ref={textareaRef}
      aria-label={props['aria-label'] ?? 'Wiki editor'}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          if (onSubmit) e.stopPropagation(); // the real editor consumes handled Cmd+Enter
          onSubmit?.(e.currentTarget.value);
        } else if (e.key === 'Escape' && onCancel) {
          e.preventDefault();
          onCancel();
        }
      }}
    />
  );
}

export const wikiEditorLazyMock = { WikiEditorLazy: WikiEditorLazyStub };
