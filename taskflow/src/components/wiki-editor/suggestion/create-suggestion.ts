import { type Editor, Extension, type Range } from '@tiptap/core';
import { type EditorState, PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, {
  exitSuggestion,
  type findSuggestionMatch,
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from '@tiptap/suggestion';
import {
  SuggestionPopover,
  type SuggestionPopoverHandle,
  type SuggestionPopoverProps,
  type SuggestionRow,
} from './SuggestionPopover';

export type { SuggestionRow } from './SuggestionPopover';

export interface SuggestionSpec {
  name: string;
  char: string;
  allowedPrefixes?: string[] | null;
  startOfLine?: boolean;
  allowSpaces?: boolean;
  debounce?: number;
  /** Visible rows before the popover scrolls (mentions/keys 8, emoticons 6, slash 10). */
  maxRows: number;
  emptyText?: string;
  findSuggestionMatch?: typeof findSuggestionMatch;
  allow?(props: { editor: Editor; state: EditorState; range: Range }): boolean;
  items(args: {
    query: string;
    editor: Editor;
    signal?: AbortSignal;
  }): Promise<SuggestionRow[]> | SuggestionRow[];
  command(args: { editor: Editor; range: Range; row: SuggestionRow }): void;
  /** Close silently when a non-empty query matches nothing (slash, emoticon). */
  closeOnEmpty?: boolean;
}

/** Plugin keys of every suggestion created by the factory (read only from event handlers). */
const SUGGESTION_KEYS: PluginKey[] = [];

/** Triggers never open inside code, raw markup, mono or link text. */
function insideProtectedContext(state: EditorState, range: Range): boolean {
  const fromPos = state.doc.resolve(range.from);
  for (let d = fromPos.depth; d >= 0; d--) {
    const name = fromPos.node(d).type.name;
    if (name === 'codeBlock' || name === 'rawBlock' || name === 'rawInline') return true;
  }
  const toPos = state.doc.resolve(range.to);
  const marks = state.storedMarks ?? toPos.marks();
  return marks.some((m) => m.type.name === 'mono' || m.type.name === 'link');
}

function popoverContainer(editor: Editor): HTMLElement {
  return (editor.view.dom.closest('[role="dialog"]') as HTMLElement | null) ?? document.body;
}

export function createSuggestionExtension(spec: SuggestionSpec) {
  const pluginKey = new PluginKey(spec.name);
  SUGGESTION_KEYS.push(pluginKey);
  const listboxId = `wiki-suggestion-${spec.name}`;

  return Extension.create({
    name: spec.name,
    addProseMirrorPlugins() {
      return [
        Suggestion<SuggestionRow, SuggestionRow>({
          editor: this.editor,
          pluginKey,
          char: spec.char,
          allowSpaces: spec.allowSpaces ?? false,
          allowedPrefixes: spec.allowedPrefixes === undefined ? [' '] : spec.allowedPrefixes,
          startOfLine: spec.startOfLine ?? false,
          debounce: spec.debounce ?? 0,
          dismissOnOutsideClick: true,
          findSuggestionMatch: spec.findSuggestionMatch,
          allow: (props) =>
            !insideProtectedContext(props.state, props.range) &&
            (spec.allow ? spec.allow(props) : true),
          items: ({ query, editor, signal }) => spec.items({ query, editor, signal }),
          command: ({ editor, range, props }) => spec.command({ editor, range, row: props }),
          render: () => {
            let renderer: ReactRenderer<SuggestionPopoverHandle, SuggestionPopoverProps> | null =
              null;
            let unmount: (() => void) | null = null;
            let latest: SuggestionProps<SuggestionRow, SuggestionRow> | null = null;

            const popoverProps = (
              props: SuggestionProps<SuggestionRow, SuggestionRow>,
            ): SuggestionPopoverProps => ({
              rows: props.items,
              loading: props.loading,
              query: props.query,
              emptyText: spec.emptyText,
              maxRows: spec.maxRows,
              listboxId,
              onSelect: (row) => latest?.command(row),
              onActiveChange: (id) => {
                const dom = props.editor.view?.dom;
                if (!dom) return;
                if (id) dom.setAttribute('aria-activedescendant', id);
                else dom.removeAttribute('aria-activedescendant');
              },
            });

            const clearAria = (editor: Editor) => {
              const dom = editor.view?.dom;
              dom?.removeAttribute('aria-activedescendant');
              dom?.removeAttribute('aria-controls');
            };

            return {
              onStart(props) {
                latest = props;
                const r = new ReactRenderer<SuggestionPopoverHandle, SuggestionPopoverProps>(
                  SuggestionPopover,
                  { props: popoverProps(props), editor: props.editor },
                );
                renderer = r;
                r.element.setAttribute('data-suggestion', '');
                popoverContainer(props.editor).appendChild(r.element);
                unmount = props.mount(r.element);
                props.editor.view.dom.setAttribute('aria-controls', listboxId);
              },
              onUpdate(props) {
                latest = props;
                renderer?.updateProps(popoverProps(props));
                if (
                  spec.closeOnEmpty &&
                  !props.loading &&
                  props.query.length > 0 &&
                  props.items.length === 0
                ) {
                  const view = props.editor.view;
                  queueMicrotask(() => {
                    if (!props.editor.isDestroyed) exitSuggestion(view, pluginKey);
                  });
                }
              },
              onKeyDown({ view, event }: SuggestionKeyDownProps) {
                if (event.key === 'Escape') {
                  // Consume it so an enclosing dialog's document listener never sees it (D-20).
                  event.stopPropagation();
                  event.preventDefault();
                  return true;
                }
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                  exitSuggestion(view, pluginKey);
                  return false;
                }
                return renderer?.ref?.onKeyDown(event) ?? false;
              },
              onExit(props) {
                unmount?.();
                unmount = null;
                renderer?.element.remove();
                renderer?.destroy();
                renderer = null;
                latest = null;
                clearAria(props.editor);
              },
            };
          },
        }),
      ];
    },
  });
}

/** Close every open suggestion popover (mode toggle, external doc reset). */
export function exitAllSuggestions(editor: Editor): void {
  if (editor.isDestroyed) return;
  let view: Editor['view'];
  try {
    view = editor.view;
  } catch {
    return;
  }
  if (!view) return;
  for (const key of SUGGESTION_KEYS) {
    if (key.getState(view.state)?.active) exitSuggestion(view, key);
  }
}

export function isAnySuggestionActive(state: EditorState): boolean {
  return SUGGESTION_KEYS.some((key) => key.getState(state)?.active === true);
}
