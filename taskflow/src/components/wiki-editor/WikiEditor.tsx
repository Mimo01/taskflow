/**
 * WikiEditor — shared controlled WYSIWYG + Source-toggle editor component.
 *
 * Props: value (Jira wiki markup) / onChange (emits Jira wiki markup).
 * Internally converts Jira→TipTap on load and TipTap→Jira on save.
 *
 * D-source-authority: Source-view text is authoritative while the user is in
 * Source mode. A dirty ref tracks whether the WYSIWYG doc was actually edited
 * since last load — a no-op open+save must NOT rewrite the markup (Pitfall 2).
 *
 * T-saz-01 note: TipTap's schema only keeps registered nodes/marks on paste;
 * unknown tags (including <script>) are dropped before they reach the doc.
 * The saved output is Jira wiki text, re-sanitized by WikiRenderer on render.
 * Do NOT weaken the rehype-sanitize allowlist in WikiRenderer.
 */

import { EditorContent, useEditor } from '@tiptap/react';
import {
  Bold,
  Code,
  FileCode,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createMentionExtension } from './extensions/mentionConfig';
import type { AttachmentMap, UserMap } from './jiraToTiptap';
import { jiraToTiptap } from './jiraToTiptap';
import { serializeToJiraWiki } from './jiraWikiSerializer';
import { SourceView } from './SourceView';
import { buildExtensions } from './wikiEditorExtensions';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WikiEditorProps {
  /** Canonical Jira wiki markup value */
  value: string;
  /** Emits Jira wiki markup on change */
  onChange: (v: string) => void;
  /** Toolbar density and min-height */
  variant?: 'description' | 'comment' | 'inline';
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number;
  /** Optional: wire @mention autocomplete */
  mention?: {
    projectKey: string;
    jiraBaseUrl: string;
  };
  /** Attachment filename→URL map for image resolution on load */
  attachments?: AttachmentMap;
  /** Username/accountId→displayName map for mention labels on load */
  users?: UserMap;
  autoFocus?: boolean;
  /** Fired on Cmd/Ctrl+Enter (comment/inline variants) */
  onSubmit?: () => void;
  submitOnEnter?: boolean;
  /** Show the Source/WYSIWYG toggle button (default true) */
  showSourceToggle?: boolean;
  id?: string;
}

// ---------------------------------------------------------------------------
// Variant defaults
// ---------------------------------------------------------------------------

const VARIANT_MIN_HEIGHT: Record<string, number> = {
  description: 120,
  comment: 80,
  inline: 64,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WikiEditor({
  value,
  onChange,
  variant = 'comment',
  placeholder,
  disabled = false,
  minHeight,
  mention,
  attachments,
  users,
  autoFocus = false,
  onSubmit,
  submitOnEnter = false,
  showSourceToggle = true,
  id,
}: WikiEditorProps) {
  const resolvedMinHeight = minHeight ?? VARIANT_MIN_HEIGHT[variant] ?? 80;

  // Source mode toggle
  const [isSource, setIsSource] = useState(false);

  // Source text — kept in sync with value when not dirty
  const [sourceText, setSourceText] = useState(value);

  // Track whether the source textarea was edited
  const sourceDirtyRef = useRef(false);

  // Track whether the WYSIWYG editor was edited since last load
  const wysiwygDirtyRef = useRef(false);

  // The last value prop we loaded into the editor (for controlled-sync, Pitfall 5)
  const lastLoadedValueRef = useRef(value);

  // Build extension set — memoised so the array reference is stable across renders.
  // Keyed on the two mention config primitives; re-running when they change is fine
  // (it will recreate the editor) but re-running on every render would cause TipTap
  // to destroy and recreate the editor on every parent state change (CR-02).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const extensions = useMemo(
    () =>
      buildExtensions(
        mention
          ? {
              mention: createMentionExtension({
                projectKey: mention.projectKey,
                jiraBaseUrl: mention.jiraBaseUrl,
              }),
            }
          : {},
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mention?.projectKey, mention?.jiraBaseUrl],
  );

  // Build initial TipTap JSON content — intentionally only on mount.
  // Later value changes are applied through the sync effect below (Pitfall 5).
  // Re-computing on every render would also churn the editor (CR-02).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialContent = useMemo(
    () => jiraToTiptap(value, { attachments, users }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor(
    {
      extensions,
      content: initialContent,
      // Note: editable is NOT in the dependency array — we update it via a
      // separate effect using editor.setEditable() to avoid full editor
      // recreation on disabled toggle (WR-05).
      editable: !disabled,
      autofocus: autoFocus,
      onUpdate({ editor: ed }) {
        // Mark WYSIWYG as dirty on first real content change
        wysiwygDirtyRef.current = true;
        const serialized = serializeToJiraWiki(ed.state.doc.toJSON?.() ?? ed.getJSON());
        onChange(serialized);
      },
      editorProps: {
        handleKeyDown(_view, event) {
          // Cmd/Ctrl+Enter → submit
          if (
            (submitOnEnter || onSubmit) &&
            event.key === 'Enter' &&
            (event.metaKey || event.ctrlKey)
          ) {
            onSubmit?.();
            return true;
          }
          return false;
        },
      },
    },
    // Empty dep array: editor is created once. Extensions stability (CR-02) + setEditable
    // effect below (WR-05) keep the editor correct without recreation on prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // WR-05: Update editability without recreating the editor.
  // useEditor([disabled]) would destroy+recreate the editor on every disabled toggle,
  // losing any unsaved content typed between the last onChange and the flip.
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  // Sync external value changes (Pitfall 5: only update when value differs from last serialized)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (value === lastLoadedValueRef.current) return;
    // External value changed — reload
    lastLoadedValueRef.current = value;
    wysiwygDirtyRef.current = false;
    const json = jiraToTiptap(value, { attachments, users });
    editor.commands.setContent(json);
    // Also sync the source text if we're not in source mode
    if (!isSource) {
      setSourceText(value);
      sourceDirtyRef.current = false;
    }
  }, [value, editor, attachments, users, isSource]);

  // ---------------------------------------------------------------------------
  // Source ↔ WYSIWYG toggle
  // ---------------------------------------------------------------------------

  const handleToggleToSource = useCallback(() => {
    // D-source-authority: if WYSIWYG was not edited, show original value (no rewrite)
    if (!wysiwygDirtyRef.current) {
      setSourceText(value);
    } else if (editor && !editor.isDestroyed) {
      // Serialize current WYSIWYG doc to Jira wiki
      const serialized = serializeToJiraWiki(editor.getJSON());
      setSourceText(serialized);
    }
    sourceDirtyRef.current = false;
    setIsSource(true);
  }, [editor, value]);

  const handleToggleToWysiwyg = useCallback(() => {
    setIsSource(false);
    if (!sourceDirtyRef.current && sourceText === value) {
      // True no-op: source was not edited AND external value didn't change while
      // we were in source mode — nothing to reload. (WR-04)
      return;
    }
    // Either source was edited, or the external value changed while source was open
    // (e.g. optimistic rollback). Use the edited source if dirty, else the latest value.
    const textToLoad = sourceDirtyRef.current ? sourceText : value;
    const json = jiraToTiptap(textToLoad, { attachments, users });
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(json);
    }
    lastLoadedValueRef.current = textToLoad;
    wysiwygDirtyRef.current = false;
    // Don't call onChange here — source edits already emit via handleSourceChange
  }, [editor, sourceText, value, attachments, users]);

  const handleSourceChange = useCallback(
    (text: string) => {
      setSourceText(text);
      sourceDirtyRef.current = true;
      onChange(text);
    },
    [onChange],
  );

  // ---------------------------------------------------------------------------
  // Toolbar commands
  // ---------------------------------------------------------------------------

  function cmd(fn: () => void) {
    return () => {
      fn();
      editor?.commands.focus();
    };
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="wiki-editor rounded-md border border-input bg-background" id={id}>
      {/* Toolbar — only in WYSIWYG mode */}
      {!isSource && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-1.5 py-1 bg-muted/30">
          <ToolbarButton
            title="Bold (Ctrl+B)"
            onClick={cmd(() => editor?.chain().focus().toggleBold().run())}
            disabled={disabled || !editor}
          >
            <Bold className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Italic (Ctrl+I)"
            onClick={cmd(() => editor?.chain().focus().toggleItalic().run())}
            disabled={disabled || !editor}
          >
            <Italic className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Strikethrough"
            onClick={cmd(() => editor?.chain().focus().toggleStrike().run())}
            disabled={disabled || !editor}
          >
            <Strikethrough className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Inline code"
            onClick={cmd(() => editor?.chain().focus().toggleCode().run())}
            disabled={disabled || !editor}
          >
            <Code className="size-3.5" />
          </ToolbarButton>
          <div className="h-4 w-px bg-border mx-0.5" />
          <ToolbarButton
            title="Bullet list"
            onClick={cmd(() => editor?.chain().focus().toggleBulletList().run())}
            disabled={disabled || !editor}
          >
            <List className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Numbered list"
            onClick={cmd(() => editor?.chain().focus().toggleOrderedList().run())}
            disabled={disabled || !editor}
          >
            <ListOrdered className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Blockquote"
            onClick={cmd(() => editor?.chain().focus().toggleBlockquote().run())}
            disabled={disabled || !editor}
          >
            <Quote className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Code block"
            onClick={cmd(() => editor?.chain().focus().toggleCodeBlock().run())}
            disabled={disabled || !editor}
          >
            <FileCode className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Horizontal rule"
            onClick={cmd(() => editor?.chain().focus().setHorizontalRule().run())}
            disabled={disabled || !editor}
          >
            <Minus className="size-3.5" />
          </ToolbarButton>

          {/* Source toggle — right-aligned */}
          {showSourceToggle && (
            <div className="ml-auto">
              <button
                type="button"
                onClick={handleToggleToSource}
                className="rounded px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                title="Switch to Source (raw Jira wiki markup)"
              >
                Source
              </button>
            </div>
          )}
        </div>
      )}

      {/* Source mode toolbar — just the toggle back */}
      {isSource && showSourceToggle && (
        <div className="flex items-center justify-end border-b border-input px-1.5 py-1 bg-muted/30">
          <button
            type="button"
            onClick={handleToggleToWysiwyg}
            className="rounded px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Switch back to rich text editor"
          >
            Visual
          </button>
        </div>
      )}

      {/* Editor area */}
      <div className="px-3 py-2" style={{ minHeight: resolvedMinHeight }}>
        {isSource ? (
          <SourceView
            value={sourceText}
            onChange={handleSourceChange}
            disabled={disabled}
            placeholder={placeholder}
            minHeight={resolvedMinHeight}
          />
        ) : (
          <EditorContent
            editor={editor}
            className="prose prose-sm dark:prose-invert max-w-none min-h-[inherit] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[inherit] [&_.ProseMirror>:first-child]:mt-0 [&_.ProseMirror>:last-child]:mb-0"
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar button helper
// ---------------------------------------------------------------------------

function ToolbarButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded p-1 hover:bg-accent disabled:opacity-40 transition-colors"
    >
      {children}
    </button>
  );
}
