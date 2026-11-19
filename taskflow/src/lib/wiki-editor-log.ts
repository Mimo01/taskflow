/**
 * wiki-editor-log — gated, never-throwing logger for wiki editor events.
 *
 * Imported by the main-bundle WikiEditorLazy, so it must only import the stores — never the
 * editor engine (tiptap / prosemirror / '@/lib/wiki/editor').
 */
import { useSettingsStore } from '../stores/settings.store';
import { useWikiEditorLogStore, type WikiEditorLogEntry } from '../stores/wiki-editor-log.store';

const MAX_MARKUP_CHARS = 20_000;

let nextLogId = 0;
let nextSession = 0;

export function nextEditorSessionId(): number {
  return ++nextSession;
}

function clip(text: string | undefined): string | undefined {
  if (text === undefined || text.length <= MAX_MARKUP_CHARS) return text;
  return `${text.slice(0, MAX_MARKUP_CHARS)}… [truncated ${text.length - MAX_MARKUP_CHARS} chars]`;
}

/**
 * Record one editor event in Developer Tools → Editor. The build thunk is only called when the
 * Developer Tools master switch is on, and any failure inside it is swallowed so logging can
 * never change editor behaviour.
 */
export function logWikiEditor(build: () => Omit<WikiEditorLogEntry, 'id' | 'timestamp'>): void {
  try {
    if (!useSettingsStore.getState().devToolsEnabled) return;
    const entry = build();
    const markup = entry.markup
      ? {
          ...entry.markup,
          ...(entry.markup.original !== undefined && { original: clip(entry.markup.original) }),
          ...(entry.markup.produced !== undefined && { produced: clip(entry.markup.produced) }),
        }
      : undefined;
    useWikiEditorLogStore.getState().append({
      ...entry,
      ...(markup && { markup }),
      id: `wiki-editor-${++nextLogId}`,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Logging must never affect the editor.
  }
}
