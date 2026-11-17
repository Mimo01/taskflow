import { QueryClientContext } from '@tanstack/react-query';
import { Selection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import { useContext, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { loadWiki, type WikiLoad } from '@/lib/wiki/editor';
import { useSettingsStore } from '@/stores/settings.store';
import {
  canLoadRich,
  evaluateSave,
  initialMode,
  replaceDoc,
  resetDoc,
  richToSource,
  sourceToRich,
  WIKI_TOGGLE_META,
} from './editor-session';
import { EDITOR_ATTRIBUTES, EDITOR_RULE_OPTIONS } from './extensions';
import { EDIT_IN_SOURCE_EVENT } from './nodeviews/events';
import { richExtensions } from './rich-extensions';
import { type SourceHandle, SourceView } from './source/SourceView';
import { exitAllSuggestions } from './suggestion/create-suggestion';
import { TableToolbar } from './toolbar/TableToolbar';
import { Toolbar } from './toolbar/Toolbar';
import type { WikiEditorProps, WikiEditorVerdict } from './types';

type RichLoad = Extract<WikiLoad, { doc: unknown }>;
type Mode = 'rich' | 'source';

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };
const FORCED_NOTICE =
  "This text uses formatting the rich editor can't keep safely, so it opens in source.";
const NO_TOGGLE_TEXT = Symbol('no-toggle-text');
const RICH_RECHECK_MS = 250;

const HEIGHTS = {
  full: { min: 'min-h-[160px]', max: 'max-h-[480px]' },
  compact: { min: 'min-h-[96px]', max: 'max-h-[280px]' },
} as const;

function loadSummary(load: WikiLoad): WikiEditorVerdict['load'] {
  return {
    kind: load.kind,
    demoted: load.kind === 'rich-demoted' ? load.demoted : [],
    reason: load.kind === 'failed' ? load.reason : null,
  };
}

export default function WikiEditor({
  value,
  onChange,
  preset = 'full',
  maxHeightClass,
  className,
  'aria-label': ariaLabel,
  onVerdict,
  host,
}: WikiEditorProps) {
  const [initial] = useState(() => {
    const load = loadWiki(value);
    const preference = useSettingsStore.getState().wikiEditorMode;
    return { load, ...initialMode(load, preference) };
  });

  const [mode, setMode] = useState<Mode>(initial.mode);
  const [forced, setForced] = useState(initial.forced);
  const [richAllowed, setRichAllowed] = useState(false);
  const [sourceText, setSourceText] = useState(value);
  const [notice, setNotice] = useState<string | null>(initial.forced ? FORCED_NOTICE : null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);

  const frameRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<SourceHandle>(null);
  const loadedRef = useRef<RichLoad | null>(initial.load.kind === 'failed' ? null : initial.load);
  const lastEmittedRef = useRef(value);
  const textAtToggleRef = useRef<string | symbol>(
    initial.load.kind === 'failed' ? NO_TOGGLE_TEXT : value,
  );
  const createdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verdictRef = useRef<{ load: WikiEditorVerdict['load']; save: WikiEditorVerdict['save'] }>({
    load: loadSummary(initial.load),
    save: null,
  });
  const stateRef = useRef({ mode, forced });
  const pendingFocusRef = useRef<{ mode: Mode; resetCaret: boolean } | null>(null);
  const cbRef = useRef({ onChange, onVerdict });

  useEffect(() => {
    cbRef.current = { onChange, onVerdict };
    stateRef.current = { mode, forced };
  });

  const queryClient = useContext(QueryClientContext);

  const report = () => {
    cbRef.current.onVerdict?.({
      ...verdictRef.current,
      mode: stateRef.current.mode,
      forced: stateRef.current.forced,
      created: createdRef.current,
    });
  };

  const editor = useEditor({
    extensions: richExtensions,
    content: initial.load.kind === 'failed' ? EMPTY_DOC : initial.load.doc,
    immediatelyRender: true,
    editable: mode === 'rich',
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { ...EDITOR_ATTRIBUTES[preset] } },
    ...EDITOR_RULE_OPTIONS,
    onCreate: () => {
      createdRef.current += 1;
      report();
    },
    onUpdate: ({ editor: e, transaction }) => {
      if (transaction.getMeta(WIKI_TOGGLE_META)) return;
      // The hidden rich doc (source mode) must never emit.
      if (!e.isEditable) return;
      const load = loadedRef.current;
      if (!load) return;
      const t0 = performance.now();
      const res = evaluateSave(load, e.state.doc, lastEmittedRef.current);
      const ms = performance.now() - t0;
      if (res.kind === 'failed') {
        setSaveError(res.error);
      } else {
        setSaveError(null);
        if (res.emit !== null) {
          lastEmittedRef.current = res.emit;
          cbRef.current.onChange(res.emit);
        }
      }
      verdictRef.current = {
        ...verdictRef.current,
        save: {
          kind: res.kind,
          text: res.emit,
          reason: res.error,
          ms,
        },
      };
      report();
    },
  });

  // Push host + queryClient into per-editor storage so module-scope extensions and node
  // views read them at call time (never through closures over props).
  useEffect(() => {
    editor?.storage.wikiHost.set(host, queryClient);
  });

  // Report on mount and on every mode change (dev tools only).
  // biome-ignore lint/correctness/useExhaustiveDependencies: report reads refs
  useEffect(() => {
    report();
  }, [mode, forced]);

  // After the commit: sync editability to the mode, then move focus to the visible surface.
  // (Focusing inside toRich/toSource would hit the still-hidden element: UAT gap 2.)
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs only on mode change
  useEffect(() => {
    editor.setEditable(mode === 'rich', false);
    const pending = pendingFocusRef.current;
    pendingFocusRef.current = null;
    if (!pending || pending.mode !== mode) return;
    if (mode === 'source') {
      sourceRef.current?.focusAt(0);
    } else {
      if (pending.resetCaret) {
        editor.view.dispatch(editor.state.tr.setSelection(Selection.atStart(editor.state.doc)));
      }
      editor.view.focus();
    }
  }, [mode]);

  // External value changes: reset, never echo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only react to value
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    setSaveError(null);
    const load = loadWiki(value);
    verdictRef.current = { load: loadSummary(load), save: null };
    if (mode === 'rich') {
      if (load.kind === 'failed') {
        loadedRef.current = null;
        textAtToggleRef.current = NO_TOGGLE_TEXT;
        setSourceText(value);
        setForced(true);
        setRichAllowed(false);
        setNotice(FORCED_NOTICE);
        setMode('source');
      } else {
        loadedRef.current = load;
        textAtToggleRef.current = value;
        exitAllSuggestions(editor);
        resetDoc(editor, load.doc);
      }
    } else {
      setSourceText(value);
      textAtToggleRef.current = NO_TOGGLE_TEXT;
      setRichAllowed(load.kind !== 'failed');
      if (load.kind === 'failed') {
        setForced(true);
        setNotice(FORCED_NOTICE);
      }
    }
    report();
  }, [value]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const toSource = () => {
    if (stateRef.current.mode !== 'rich') return;
    exitAllSuggestions(editor);
    editor.setEditable(false, false);
    pendingFocusRef.current = { mode: 'source', resetCaret: false };
    const load = loadedRef.current;
    if (!load) {
      setMode('source');
      return;
    }
    const res = richToSource(load, editor.state.doc, lastEmittedRef.current);
    setSourceText(res.text);
    textAtToggleRef.current = res.text;
    setNotice(res.note);
    setSaveError(res.error);
    setRichAllowed(canLoadRich(res.text));
    if (res.text !== lastEmittedRef.current) {
      lastEmittedRef.current = res.text;
      cbRef.current.onChange(res.text);
    }
    setMode('source');
  };

  const toRich = () => {
    exitAllSuggestions(editor);
    const res = sourceToRich(
      sourceText,
      textAtToggleRef.current === NO_TOGGLE_TEXT ? '\u0000' : (textAtToggleRef.current as string),
    );
    if (res.kind === 'same' && loadedRef.current) {
      editor.setEditable(true, false);
      pendingFocusRef.current = { mode: 'rich', resetCaret: false };
      setMode('rich');
      return;
    }
    const load = res.kind === 'load' ? res.load : loadWiki(sourceText);
    if (load.kind === 'failed') {
      setForced(true);
      setRichAllowed(false);
      setNotice(FORCED_NOTICE);
      return;
    }
    replaceDoc(editor, load.doc);
    loadedRef.current = load;
    lastEmittedRef.current = sourceText;
    textAtToggleRef.current = sourceText;
    setForced(false);
    setNotice(null);
    setSaveError(null);
    editor.setEditable(true, false);
    pendingFocusRef.current = { mode: 'rich', resetCaret: true };
    setMode('rich');
  };

  const richDisabled = mode === 'source' && forced && !richAllowed;

  const userToggle = (next: Mode) => {
    if (next === stateRef.current.mode) return;
    if (next === 'rich') {
      if (richDisabled) return;
      toRich();
    } else {
      toSource();
    }
    useSettingsStore.getState().setWikiEditorMode(next);
  };

  const onSourceChange = (text: string) => {
    setSourceText(text);
    setSaveError(null);
    lastEmittedRef.current = text;
    cbRef.current.onChange(text);
    if (forced) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setRichAllowed(canLoadRich(text));
      }, RICH_RECHECK_MS);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: toSource reads refs only
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const handler = () => toSource();
    el.addEventListener(EDIT_IN_SOURCE_EVENT, handler);
    return () => el.removeEventListener(EDIT_IN_SOURCE_EVENT, handler);
  }, []);

  const onKeyDownCapture = (e: React.KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const key = e.key.toLowerCase();
    if (e.shiftKey && key === 'm') {
      e.preventDefault();
      e.stopPropagation();
      userToggle(stateRef.current.mode === 'rich' ? 'source' : 'rich');
    } else if (!e.shiftKey && key === 'k') {
      e.preventDefault();
      setLinkOpen(true);
    }
  };

  const sizes = HEIGHTS[preset];
  const maxClass = maxHeightClass ?? sizes.max;
  const message = saveError ? null : notice;

  return (
    <div className={cn('@container', className)}>
      <div
        ref={frameRef}
        onKeyDownCapture={onKeyDownCapture}
        className="rounded-lg border border-input bg-background focus-within:ring-1 focus-within:ring-ring"
      >
        <div className={cn('relative overflow-auto', maxClass)}>
          <Toolbar
            editor={editor}
            preset={preset}
            mode={mode}
            richDisabled={richDisabled}
            onModeChange={userToggle}
            previewVisible={previewVisible}
            onPreviewToggle={() => setPreviewVisible((v) => !v)}
            linkOpen={linkOpen}
            onLinkOpenChange={setLinkOpen}
            source={sourceRef}
            frameRef={frameRef}
          />
          {saveError ? (
            <div className="flex items-center gap-2 border-b border-border px-3 py-1 text-xs">
              <span className="min-w-0 flex-1 truncate text-destructive" title={saveError}>
                Couldn't save safely: {saveError}.
              </span>
              {mode === 'rich' ? (
                <button
                  type="button"
                  onClick={toSource}
                  className="flex-none rounded px-2 py-0.5 text-xs hover:bg-accent"
                >
                  Fix in source
                </button>
              ) : null}
            </div>
          ) : message ? (
            <div
              className="truncate border-b border-border px-3 py-1 text-xs text-muted-foreground"
              title={message}
            >
              {message}
            </div>
          ) : null}
          <EditorContent editor={editor} className={mode === 'source' ? 'hidden' : undefined} />
          {mode === 'source' ? (
            <SourceView
              ref={sourceRef}
              value={sourceText}
              onChange={onSourceChange}
              previewVisible={previewVisible}
              minHeightClass={sizes.min}
              maxHeightClass={maxClass}
              aria-label={ariaLabel}
            />
          ) : null}
          {mode === 'rich' ? <TableToolbar editor={editor} /> : null}
        </div>
      </div>
    </div>
  );
}
