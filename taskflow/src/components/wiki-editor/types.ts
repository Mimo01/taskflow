/*
 * Props contract of the wiki editor. Types only: importable from anywhere without
 * pulling the editor chunk (bundle guard).
 *
 * Phase 99 adds mentions/media and an imperative `insertWiki` handle; Phase 100 adds
 * drafts and Cmd+Enter/Esc. `value`/`onChange` stay on the wiki string.
 */
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

export interface WikiEditorProps {
  value: string;
  onChange: (text: string) => void;
  preset?: WikiEditorPreset;
  maxHeightClass?: string;
  className?: string;
  'aria-label'?: string;
  onVerdict?: (v: WikiEditorVerdict) => void;
}
