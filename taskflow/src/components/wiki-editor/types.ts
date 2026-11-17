/*
 * Props contract of the wiki editor. Types only: importable from anywhere without
 * pulling the editor chunk (bundle guard).
 *
 * Phase 99 adds mentions/media, an imperative `insertWiki` handle and the optional
 * `host` contract (issue/project context + upload callbacks); Phase 100 adds drafts and
 * Cmd+Enter/Esc. `value`/`onChange` stay on the wiki string.
 */
import type { JiraAttachment } from '@/services/jira';

export type WikiEditorPreset = 'full' | 'compact';

export interface WikiEditorVerdict {
  load: { kind: 'rich' | 'rich-demoted' | 'failed'; demoted: number[]; reason: string | null };
  save: {
    kind: 'unchanged' | 'saved' | 'failed';
    text: string | null;
    reason: string | null;
    ms: number;
  } | null;
  mode: 'rich' | 'source';
  forced: boolean;
  created: number;
}

/** Context and callbacks a host (issue detail, create flow, ...) hands to the editor. */
export interface WikiEditorHost {
  issueKey?: string | null;
  projectKey?: string | null;
  attachments?: readonly JiraAttachment[];
  /** username to display name, as `useMentionUserMap` returns. */
  userMap?: Readonly<Record<string, string>>;
  /** Create flow: files are staged locally, not uploaded (D-09). */
  staged?: boolean;
  uploadFile?: (file: File) => Promise<JiraAttachment>;
  stageFile?: (file: File) => void;
  deleteAttachment?: (id: string) => Promise<void>;
  isReferencedElsewhere?: (filename: string) => boolean;
  onOpenIssue?: (key: string) => void;
}

/** Imperative handle a host reaches through `ref` (React 19 ref-as-prop). */
export interface WikiEditorHandle {
  focus(opts?: { toEnd?: boolean }): void;
  blur(): void;
  /** Same path as paste/drop: uploads live, or stages when `host.staged`. */
  insertFiles(files: File[]): void;
}

export interface WikiEditorProps {
  value: string;
  onChange: (text: string) => void;
  preset?: WikiEditorPreset;
  maxHeightClass?: string;
  className?: string;
  'aria-label'?: string;
  onVerdict?: (v: WikiEditorVerdict) => void;
  /** Issue/project context and upload callbacks. Phase 100 hosts wire it. */
  host?: WikiEditorHost;
  /** Empty-editor hint; read once at creation. Defaults per preset. */
  placeholder?: string;
  /** Focus the editor (caret at the end) after mount. */
  autoFocus?: boolean;
  /**
   * Cmd/Ctrl+Enter. Not called during IME composition or while a suggestion popover is open.
   * Receives the current wiki text.
   */
  onSubmit?: (text: string) => void;
  /** Esc, after any open popover or bubble menu has consumed its own Esc. */
  onCancel?: () => void;
  ref?: React.Ref<WikiEditorHandle>;
}
