import { computePosition, flip, shift } from '@floating-ui/dom';
import type { Editor } from '@tiptap/core';
import { type RefObject, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getTextareaCaretRect } from '@/lib/textarea-caret';
import type { JiraAssignableUser } from '@/services/jira/types';
import type { EmoticonEntry } from '../suggestion/emoticon-data';
import { filterEmoticons } from '../suggestion/emoticon-suggestion';
import {
  SuggestionPopover,
  type SuggestionPopoverHandle,
  type SuggestionRow,
} from '../suggestion/SuggestionPopover';
import { searchPeople } from '../suggestion/search';

type Kind = 'mention' | 'emoticon';

interface Trigger {
  kind: Kind;
  start: number;
  query: string;
  container: HTMLElement;
}

const MENTION_RE = /(^|[\s([])@([\w.@-]*)$/;
const EMOTICON_RE = /(^|[\s([]):([A-Za-z][\w-]*)$/;

const CODE_FENCE_RE = /\{(code|noformat)(?::[^}]*)?\}/g;

/** True when `before` ends inside an unclosed {code…} or {noformat} block (literal text). */
function insideCodeBlock(before: string): boolean {
  let open: string | null = null;
  for (const m of before.matchAll(CODE_FENCE_RE)) {
    if (!open) open = m[1];
    else if (m[1] === open) open = null;
  }
  return open !== null;
}

/** Trigger (if any) that ends at `caret`; the prefix class keeps "a@b" and "10:30" from matching. */
export function detectSourceTrigger(
  value: string,
  caret: number,
): { kind: Kind; start: number; query: string } | null {
  const before = value.slice(0, caret);
  if (insideCodeBlock(before)) return null;
  const mention = MENTION_RE.exec(before);
  if (mention) {
    return {
      kind: 'mention',
      start: mention.index + mention[1].length,
      query: mention[2],
    };
  }
  const emoticon = EMOTICON_RE.exec(before);
  if (emoticon) {
    return {
      kind: 'emoticon',
      start: emoticon.index + emoticon[1].length,
      query: emoticon[2],
    };
  }
  return null;
}

function personRow(user: JiraAssignableUser): SuggestionRow {
  const urls = user.avatarUrls;
  const url = urls?.['24x24'] ?? (urls ? Object.values(urls)[0] : undefined);
  return {
    key: user.name,
    label: user.displayName,
    detail: user.name,
    avatar: { url, name: user.displayName },
    data: user,
  };
}

function emoticonRow(e: EmoticonEntry): SuggestionRow {
  return { key: e.token, label: e.name, detail: e.token, mono: true, glyph: e.glyph, data: e };
}

export interface SourceSuggestProps {
  editor: Editor;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onReplace(from: number, to: number, text: string): void;
}

/** @mention and :emoticon autocomplete for the source textarea (same popover and data as rich). */
export function SourceSuggest({ editor, textareaRef, value, onReplace }: SourceSuggestProps) {
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [people, setPeople] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const dismissed = useRef<string | null>(null);
  const popRef = useRef<SuggestionPopoverHandle>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const sync = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const found =
      el.selectionStart === el.selectionEnd
        ? detectSourceTrigger(el.value, el.selectionStart)
        : null;
    if (!found) {
      dismissed.current = null;
      setTrigger(null);
      return;
    }
    if (dismissed.current === `${found.kind}:${found.start}`) {
      setTrigger(null);
      return;
    }
    const container = (el.closest('[role="dialog"]') as HTMLElement | null) ?? document.body;
    setTrigger((prev) =>
      prev &&
      prev.kind === found.kind &&
      prev.start === found.start &&
      prev.query === found.query &&
      prev.container === container
        ? prev
        : { ...found, container },
    );
  }, [textareaRef]);

  // Re-evaluate on every text change and on caret moves.
  // biome-ignore lint/correctness/useExhaustiveDependencies: value is the trigger for re-evaluation
  useEffect(() => {
    sync();
  }, [value, sync]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    let blurTimer: ReturnType<typeof setTimeout> | undefined;
    const onBlur = () => {
      blurTimer = setTimeout(() => setTrigger(null), 0);
    };
    el.addEventListener('select', sync);
    el.addEventListener('keyup', sync);
    el.addEventListener('click', sync);
    el.addEventListener('blur', onBlur);
    return () => {
      el.removeEventListener('select', sync);
      el.removeEventListener('keyup', sync);
      el.removeEventListener('click', sync);
      el.removeEventListener('blur', onBlur);
      clearTimeout(blurTimer);
    };
  }, [textareaRef, sync]);

  const mentionQuery = trigger?.kind === 'mention' ? trigger.query : null;
  useEffect(() => {
    if (mentionQuery === null) {
      setPeople([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ac = new AbortController();
    const timer = setTimeout(() => {
      searchPeople(editor, mentionQuery, ac.signal).then(
        (users) => {
          if (ac.signal.aborted) return;
          setPeople(users.map(personRow));
          setLoading(false);
        },
        () => {
          if (ac.signal.aborted) return;
          setPeople([]);
          setLoading(false);
        },
      );
    }, 250);
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [mentionQuery, editor]);

  const emoticons =
    trigger?.kind === 'emoticon' ? filterEmoticons(trigger.query).map(emoticonRow) : [];
  const open = trigger !== null && (trigger.kind === 'mention' || emoticons.length > 0);
  const triggerStart = trigger?.start ?? -1;

  const select = (row: SuggestionRow) => {
    const el = textareaRef.current;
    if (!el || !trigger) return;
    const text =
      trigger.kind === 'mention'
        ? `[~${(row.data as JiraAssignableUser).name}] `
        : (row.data as EmoticonEntry).token;
    dismissed.current = null;
    setTrigger(null);
    onReplace(trigger.start, el.selectionStart, text);
  };

  // Keyboard routing while open (capture, so the textarea's own handling never sees these).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || !open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dismissed.current = `${trigger?.kind}:${trigger?.start}`;
        setTrigger(null);
        return;
      }
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) {
        if (popRef.current?.onKeyDown(e)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    el.addEventListener('keydown', onKeyDown, true);
    return () => el.removeEventListener('keydown', onKeyDown, true);
  }, [open, trigger?.kind, trigger?.start, textareaRef]);

  // Anchor at the caret position of the trigger character.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-position when rows change size
  useEffect(() => {
    const el = textareaRef.current;
    const wrap = wrapRef.current;
    if (!open || !el || !wrap) return;
    const reference = {
      getBoundingClientRect: () => {
        const r = getTextareaCaretRect(el, triggerStart);
        return { ...r, x: r.left, y: r.top, right: r.left, toJSON: () => r } as DOMRect;
      },
    };
    let cancelled = false;
    computePosition(reference, wrap, {
      strategy: 'fixed',
      placement: 'bottom-start',
      middleware: [flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      if (cancelled) return;
      wrap.style.left = `${x}px`;
      wrap.style.top = `${y}px`;
      wrap.style.visibility = 'visible';
    });
    return () => {
      cancelled = true;
    };
  }, [open, triggerStart, people, loading, textareaRef]);

  if (!open || !trigger) return null;
  const isMention = trigger.kind === 'mention';
  return createPortal(
    <div
      ref={wrapRef}
      className="z-50"
      style={{ position: 'fixed', left: 0, top: 0, visibility: 'hidden' }}
    >
      <SuggestionPopover
        ref={popRef}
        rows={isMention ? people : emoticons}
        loading={isMention && loading}
        query={trigger.query}
        onSelect={select}
        emptyText={isMention ? 'No matching people' : undefined}
        maxRows={isMention ? 8 : 6}
        listboxId={listboxId}
      />
    </div>,
    trigger.container,
  );
}
