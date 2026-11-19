import { QueryClientContext } from '@tanstack/react-query';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Selection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import { useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { attachmentRef } from '@/lib/attachment-markup';
import { cn } from '@/lib/utils';
import { explainSave, loadWiki, type WikiLoad } from '@/lib/wiki/editor';
import { logWikiEditor, nextEditorSessionId } from '@/lib/wiki-editor-log';
import { AttachmentPickerModal } from '@/routes/dashboard/issue-detail/AttachmentPickerModal';
import type { JiraAttachment } from '@/services/jira';
import { useSettingsStore } from '@/stores/settings.store';
import type { WikiEditorLogEntry } from '@/stores/wiki-editor-log.store';
import {
  CARRY_OVER_NOTE,
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
import { setLocalPreview, useHost } from './host';
import { EditorMessages } from './media/EditorMessages';
import { insertEmbed } from './media/embed';
import { startUploads } from './media/upload-plugin';
import { EDIT_IN_SOURCE_EVENT, WIKI_OPEN_ATTACH_EVENT } from './nodeviews/events';
import { richExtensions } from './rich-extensions';
import { type SourceHandle, SourceView } from './source/SourceView';
import { uploadIntoSource } from './source/source-uploads';
import { exitAllSuggestions, isAnySuggestionActive } from './suggestion/create-suggestion';
import { BubbleToolbar } from './toolbar/BubbleToolbar';
import { CompactFooter } from './toolbar/CompactFooter';
import { TableToolbar } from './toolbar/TableToolbar';
import { Toolbar } from './toolbar/Toolbar';
import type { WikiEditorProps } from './types';

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

/** Diagnostics for a failed save: original/produced markup and the first differing block. */
function failureSnapshot(
  original: string,
  doc: PMNode,
): Pick<WikiEditorLogEntry, 'markup' | 'diagnosis' | 'details'> {
  const { produced, diagnosis, error } = explainSave(doc);
  return {
    markup: { original, ...(produced !== null && { produced }) },
    ...(diagnosis !== null && { diagnosis }),
    ...(error !== null && { details: { emitError: error } }),
  };
}

export default function WikiEditor({
  value,
  onChange,
  preset = 'full',
  maxHeightClass,
  className,
  'aria-label': ariaLabel,
  host,
  placeholder,
  autoFocus,
  onSubmit,
  onSaveBlockedChange,
  onCancel,
  ref,
}: WikiEditorProps) {
  const [initial] = useState(() => {
    const load = loadWiki(value);
    const preference = useSettingsStore.getState().wikiEditorMode;
    return { load, ...initialMode(load, preference) };
  });

  const [session] = useState(nextEditorSessionId);
  // Read at call time (inside handlers/effects), never during render.
  const logContext = () => ({ label: ariaLabel, issueKey: host?.issueKey ?? null, preset });

  const [mode, setMode] = useState<Mode>(initial.mode);
  const [forced, setForced] = useState(initial.forced);
  const [richAllowed, setRichAllowed] = useState(false);
  const [sourceText, setSourceText] = useState(value);
  const [notice, setNotice] = useState<string | null>(initial.forced ? FORCED_NOTICE : null);
  const [saveError, setSaveErrorState] = useState<string | null>(null);
  // Mirrors saveError synchronously so a Cmd+Enter right after a failed keystroke sees it.
  const saveErrorRef = useRef<string | null>(null);
  const setSaveError = (error: string | null) => {
    saveErrorRef.current = error;
    setSaveErrorState(error);
  };
  const [previewVisible, setPreviewVisible] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  const frameRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<SourceHandle>(null);
  const loadedRef = useRef<RichLoad | null>(initial.load.kind === 'failed' ? null : initial.load);
  const lastEmittedRef = useRef(value);
  const textAtToggleRef = useRef<string | symbol>(
    initial.load.kind === 'failed' ? NO_TOGGLE_TEXT : value,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef({ mode, forced });
  const pendingFocusRef = useRef<{ mode: Mode; resetCaret: boolean } | null>(null);
  const cbRef = useRef({ onChange, onSubmit, onCancel, onSaveBlockedChange });
  const sourceTextRef = useRef(sourceText);

  useEffect(() => {
    cbRef.current = { onChange, onSubmit, onCancel, onSaveBlockedChange };
    sourceTextRef.current = sourceText;
    stateRef.current = { mode, forced };
  });

  const queryClient = useContext(QueryClientContext);

  const editor = useEditor({
    extensions: richExtensions,
    content: initial.load.kind === 'failed' ? EMPTY_DOC : initial.load.doc,
    immediatelyRender: true,
    editable: mode === 'rich',
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        ...EDITOR_ATTRIBUTES[preset],
        ...(placeholder !== undefined ? { 'data-wiki-placeholder': placeholder } : {}),
      },
    },
    ...EDITOR_RULE_OPTIONS,
    onCreate: ({ editor: e }) => {
      if (autoFocus && stateRef.current.mode === 'rich') e.commands.focus('end');
    },
    onUpdate: ({ editor: e, transaction }) => {
      if (transaction.getMeta(WIKI_TOGGLE_META)) return;
      // The hidden rich doc (source mode) must never emit.
      if (!e.isEditable) return;
      const load = loadedRef.current;
      if (!load) return;
      const res = evaluateSave(load, e.state.doc, lastEmittedRef.current);
      const previousError = saveErrorRef.current;
      if (res.kind === 'failed') {
        // Log the transition into failure only: the reason embeds document text, so it changes
        // on every keystroke and keying on it would flood the capped log.
        if (previousError === null) {
          logWikiEditor(() => ({
            session,
            event: 'save-failed',
            level: 'error',
            message: `Couldn't save safely: ${res.error}`,
            context: logContext(),
            ...failureSnapshot(load.original, e.state.doc),
            error: { message: res.error ?? '' },
          }));
        }
        setSaveError(res.error);
      } else {
        if (previousError !== null) {
          logWikiEditor(() => ({
            session,
            event: 'save-recovered',
            level: 'info',
            message: 'Save recovered',
            context: logContext(),
            details: { previousReason: previousError },
          }));
        }
        setSaveError(null);
        if (res.emit !== null) {
          lastEmittedRef.current = res.emit;
          cbRef.current.onChange(res.emit);
        }
      }
    },
  });

  // Push host + queryClient into per-editor storage so module-scope extensions and node
  // views read them at call time (never through closures over props).
  useEffect(() => {
    editor?.storage.wikiHost?.set(host, queryClient);
  });

  // Rich edits that can't be saved leave the host holding the last good text: tell it.
  const saveBlocked = mode === 'rich' && saveError !== null;
  const reportedBlockedRef = useRef(false);
  useEffect(() => {
    if (saveBlocked === reportedBlockedRef.current) return;
    reportedBlockedRef.current = saveBlocked;
    cbRef.current.onSaveBlockedChange?.(saveBlocked);
  }, [saveBlocked]);
  useEffect(
    () => () => {
      // An editor unmounted while blocked must not leave its host blocked.
      if (reportedBlockedRef.current) cbRef.current.onSaveBlockedChange?.(false);
    },
    [],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only observation
  useEffect(() => {
    logWikiEditor(() => ({
      session,
      event: 'open',
      level: 'info',
      message: `Editor opened (${stateRef.current.mode})`,
      context: logContext(),
      details: {
        mode: stateRef.current.mode,
        forced: stateRef.current.forced,
        loadKind: initial.load.kind,
        demotedBlocks: initial.load.kind === 'rich-demoted' ? initial.load.demoted.length : 0,
        length: value.length,
      },
    }));
    if (initial.load.kind === 'failed') {
      const { reason } = initial.load;
      logWikiEditor(() => ({
        session,
        event: 'load-failed',
        level: 'warn',
        message: `Rich editor can't load this text: ${reason}`,
        context: logContext(),
        markup: { original: value },
        error: { message: reason },
      }));
    }
    return () => {
      logWikiEditor(() => ({
        session,
        event: 'close',
        level: 'info',
        message: 'Editor closed',
        context: logContext(),
        details: { mode: stateRef.current.mode, saveBlocked: reportedBlockedRef.current },
      }));
    };
  }, []);

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
    logWikiEditor(() =>
      mode === 'rich' && load.kind === 'failed'
        ? {
            session,
            event: 'external-reset',
            level: 'warn',
            message: `External value can't load in rich: ${load.reason}`,
            context: logContext(),
            markup: { original: value },
            error: { message: load.reason },
          }
        : {
            session,
            event: 'external-reset',
            level: 'info',
            message: 'Value replaced from outside',
            context: logContext(),
            details: { mode, loadKind: load.kind, length: value.length },
          },
    );
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
      logWikiEditor(() => ({
        session,
        event: 'mode-switch',
        level: 'info',
        message: 'Switched rich to source',
        context: logContext(),
        details: { noLoadedDoc: true },
      }));
      setMode('source');
      return;
    }
    const res = richToSource(load, editor.state.doc, lastEmittedRef.current);
    logWikiEditor(() => {
      const carryFailed = res.note === CARRY_OVER_NOTE;
      return {
        session,
        event: 'mode-switch',
        level: carryFailed ? 'warn' : 'info',
        message: carryFailed
          ? 'Switched rich to source; latest edit could not be carried over'
          : 'Switched rich to source',
        context: logContext(),
        ...(res.error !== null && failureSnapshot(load.original, editor.state.doc)),
        details: { error: res.error, carriedOver: !carryFailed, length: res.text.length },
        ...(res.error !== null && { error: { message: res.error } }),
      };
    });
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
      logWikiEditor(() => ({
        session,
        event: 'mode-switch',
        level: 'info',
        message: 'Switched source to rich',
        context: logContext(),
        details: { kind: res.kind, length: sourceText.length },
      }));
      editor.setEditable(true, false);
      pendingFocusRef.current = { mode: 'rich', resetCaret: false };
      setMode('rich');
      return;
    }
    const load = res.kind === 'load' ? res.load : loadWiki(sourceText);
    if (load.kind === 'failed') {
      logWikiEditor(() => ({
        session,
        event: 'load-failed',
        level: 'warn',
        message: `Rich editor can't load this text: ${load.reason}`,
        context: logContext(),
        markup: { original: sourceText },
        error: { message: load.reason },
      }));
      setForced(true);
      setRichAllowed(false);
      setNotice(FORCED_NOTICE);
      return;
    }
    logWikiEditor(() => ({
      session,
      event: 'mode-switch',
      level: 'info',
      message: 'Switched source to rich',
      context: logContext(),
      details: { kind: res.kind, length: sourceText.length },
    }));
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

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const handler = () => setAttachOpen(true);
    el.addEventListener(WIKI_OPEN_ATTACH_EVENT, handler);
    return () => el.removeEventListener(WIKI_OPEN_ATTACH_EVENT, handler);
  }, []);

  // Source mode has no ProseMirror plugin state; its popover is a portaled [data-suggestion].
  const suggestionOpen = () =>
    stateRef.current.mode === 'rich'
      ? isAnySuggestionActive(editor.state)
      : document.querySelector('[data-suggestion]') !== null;

  const focusEditor = (toEnd?: boolean) => {
    if (stateRef.current.mode === 'rich') {
      editor.commands.focus(toEnd ? 'end' : undefined);
    } else if (toEnd) {
      sourceRef.current?.focusAt(Number.MAX_SAFE_INTEGER);
    } else {
      sourceRef.current?.focus();
    }
  };

  useImperativeHandle(ref, () => ({
    focus: (opts) => focusEditor(opts?.toEnd),
    blur: () => {
      if (stateRef.current.mode === 'rich') editor.commands.blur();
      else (document.activeElement as HTMLElement | null)?.blur();
    },
    setLocalPreview: (name, url) => setLocalPreview(editor, name, url),
    insertFiles: (files) => {
      if (stateRef.current.mode === 'rich') {
        startUploads(editor, files, editor.state.selection.to);
      } else {
        uploadIntoSource(editor, files, (m) => {
          if (!sourceRef.current) return false;
          sourceRef.current.insert(m);
          return true;
        });
      }
    },
  }));

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only focus
  useEffect(() => {
    if (autoFocus && stateRef.current.mode === 'source')
      sourceRef.current?.focusAt(Number.MAX_SAFE_INTEGER);
  }, []);

  const { attachments } = useHost(editor);
  const onPickAttachment = (att: JiraAttachment) => {
    if (stateRef.current.mode === 'rich') {
      insertEmbed(editor, att);
      editor.view.focus();
    } else {
      sourceRef.current?.insert(attachmentRef(att));
    }
  };

  const onKeyDownCapture = (e: React.KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const key = e.key.toLowerCase();
    if (key === 'enter' && !e.shiftKey && !e.altKey) {
      const submit = cbRef.current.onSubmit;
      if (!submit || e.nativeEvent.isComposing || e.keyCode === 229) return;
      if (suggestionOpen()) {
        // Do nothing while a popover is open: don't let the popover treat it as Enter (pick)
        // or let a host form's own Cmd+Enter handler submit (D-14).
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      // Never submit the stale last-good text; the banner tells the user to fix it in source.
      if (stateRef.current.mode === 'rich' && saveErrorRef.current !== null) {
        logWikiEditor(() => ({
          session,
          event: 'submit-blocked',
          level: 'warn',
          message: 'Submit blocked: edit cannot be saved safely',
          context: logContext(),
          ...(loadedRef.current && editor
            ? failureSnapshot(loadedRef.current.original, editor.state.doc)
            : {}),
          details: { reason: saveErrorRef.current },
        }));
        return;
      }
      logWikiEditor(() => ({
        session,
        event: 'submit',
        level: 'info',
        message: 'Submitted',
        context: logContext(),
        details: {
          mode: stateRef.current.mode,
          length: (stateRef.current.mode === 'source'
            ? sourceTextRef.current
            : lastEmittedRef.current
          ).length,
        },
      }));
      submit(stateRef.current.mode === 'source' ? sourceTextRef.current : lastEmittedRef.current);
    } else if (e.shiftKey && key === 'm') {
      e.preventDefault();
      e.stopPropagation();
      userToggle(stateRef.current.mode === 'rich' ? 'source' : 'rich');
    } else if (!e.shiftKey && key === 'k') {
      e.preventDefault();
      setLinkOpen(true);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape' || e.nativeEvent.isComposing) return;
    // ProseMirror preventDefaults every Escape it sees (captureKeyDown, keyCode 27), so in rich
    // mode defaultPrevented says nothing. Popovers and the bubble toolbar that consume Esc stop
    // propagation, so they never reach this handler.
    const fromProseMirror =
      stateRef.current.mode === 'rich' && editor.view.dom.contains(e.target as Node);
    if (e.defaultPrevented && !fromProseMirror) return;
    const cancel = cbRef.current.onCancel;
    if (!cancel) return;
    e.preventDefault();
    e.stopPropagation();
    cancel();
  };

  const sizes = HEIGHTS[preset];
  const maxClass = maxHeightClass ?? sizes.max;
  const message = saveError ? null : notice;

  return (
    <div className={cn('@container', className)}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: key events bubble up from the focusable editor/textarea inside */}
      <div
        ref={frameRef}
        onKeyDownCapture={onKeyDownCapture}
        onKeyDown={onKeyDown}
        data-slot="wiki-editor-frame"
        className="rounded-lg border border-input bg-transparent dark:bg-input/30 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
      >
        <div
          className={cn(
            'relative overflow-auto',
            preset === 'full'
              ? 'rounded-[calc(var(--radius-lg)-1px)]'
              : 'rounded-t-[calc(var(--radius-lg)-1px)]',
            maxClass,
          )}
        >
          {preset === 'compact' ? (
            mode === 'rich' ? (
              <BubbleToolbar editor={editor} linkOpen={linkOpen} onLinkOpenChange={setLinkOpen} />
            ) : null
          ) : (
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
          )}
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
              editor={editor}
              onFiles={(files) =>
                uploadIntoSource(editor, files, (m) => {
                  if (!sourceRef.current) return false;
                  sourceRef.current.insert(m);
                  return true;
                })
              }
            />
          ) : null}
          <EditorMessages editor={editor} />
          {mode === 'rich' ? <TableToolbar editor={editor} /> : null}
        </div>
        {preset === 'compact' ? (
          <CompactFooter
            editor={editor}
            mode={mode}
            richDisabled={richDisabled}
            onModeChange={userToggle}
            onAttach={() => setAttachOpen(true)}
            source={sourceRef}
          />
        ) : null}
        <AttachmentPickerModal
          open={attachOpen}
          onOpenChange={setAttachOpen}
          attachments={[...attachments]}
          description="Select an attachment to embed it here."
          onSelect={onPickAttachment}
        />
      </div>
    </div>
  );
}
