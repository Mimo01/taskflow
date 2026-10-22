import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  buildMatchRanges,
  collectRuns,
  type FindScopeKind,
  resolveFindScope,
  scrollRangeIntoView,
} from '@/lib/find-in-page';

interface FindBarProps {
  scope: HTMLElement;
  kind: FindScopeKind;
  focusSignal: number;
  onClose: () => void;
}

const HL_ALL = 'find-all';
const HL_CURRENT = 'find-current';

function highlightsSupported(): boolean {
  return (
    typeof Highlight !== 'undefined' &&
    typeof CSS !== 'undefined' &&
    (CSS as unknown as { highlights?: unknown }).highlights != null
  );
}

// WebKit only repaints ranges removed via the Highlight's own set API — replacing or
// deleting a registry entry leaves stale paint behind. So mutate one Highlight per
// name in place, and clear() it before deleting.
function getHighlight(name: string, priority: number): Highlight {
  let h = CSS.highlights.get(name);
  if (!h) {
    h = new Highlight();
    h.priority = priority;
    CSS.highlights.set(name, h);
  }
  return h;
}

function clearHighlights() {
  if (!highlightsSupported()) return;
  for (const name of [HL_ALL, HL_CURRENT]) {
    CSS.highlights.get(name)?.clear();
    CSS.highlights.delete(name);
  }
}

function paint(ranges: Range[], idx: number) {
  if (!highlightsSupported()) return;
  if (ranges.length === 0) {
    clearHighlights();
    return;
  }
  const all = getHighlight(HL_ALL, 0);
  all.clear();
  for (const r of ranges) all.add(r);
  const current = getHighlight(HL_CURRENT, 1);
  current.clear();
  const cur = ranges[idx];
  if (cur) current.add(cur);
}

export function FindBar({ scope, kind, focusSignal, onClose }: FindBarProps) {
  const [query, setQuery] = useState('');
  const [total, setTotal] = useState(0);
  const [capped, setCapped] = useState(false);
  const [current, setCurrent] = useState(0);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const rangesRef = useRef<Range[]>([]);
  const idxRef = useRef(0);
  const queryRef = useRef('');
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Recompute matches. `scroll` = bring current match into view (query change only).
  const recompute = (q: string, mode: 'query' | 'mutation') => {
    const prev = rangesRef.current[idxRef.current];
    const { ranges, capped: cap } = q.trim()
      ? buildMatchRanges(collectRuns(scope), q)
      : { ranges: [] as Range[], capped: false };
    let idx = 0;
    if (mode === 'mutation' && prev && ranges.length > 0) {
      const found = ranges.findIndex((r) => {
        try {
          return r.compareBoundaryPoints(Range.START_TO_START, prev) >= 0;
        } catch {
          return false;
        }
      });
      idx = found === -1 ? ranges.length - 1 : found;
    }
    rangesRef.current = ranges;
    idxRef.current = idx;
    paint(ranges, idx);
    setTotal(ranges.length);
    setCapped(cap);
    setCurrent(idx);
    if (mode === 'query' && ranges[idx]) scrollRangeIntoView(ranges[idx]);
  };

  const step = (delta: 1 | -1) => {
    const n = rangesRef.current.length;
    if (n === 0) return;
    const idx = (idxRef.current + delta + n) % n;
    idxRef.current = idx;
    paint(rangesRef.current, idx);
    setCurrent(idx);
    scrollRangeIntoView(rangesRef.current[idx]);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: recompute is stable in behaviour; keyed on query/scope
  useEffect(() => {
    queryRef.current = query;
    recompute(query, 'query');
  }, [query, scope]);

  // Live updates: throttled MutationObserver on the whole body, so removal of the
  // scope itself (dialog/peek closing) and newly opened layers are seen too.
  // Trailing throttle (timer not reset) so constantly-mutating pages still refresh.
  // biome-ignore lint/correctness/useExhaustiveDependencies: recompute reads refs only
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const mo = new MutationObserver((records) => {
      if (!scope.isConnected) {
        clearTimeout(timer);
        onCloseRef.current();
        return;
      }
      const relevant = records.some((r) => {
        const el = r.target instanceof Element ? r.target : r.target.parentElement;
        return !el?.closest('[data-find-bar]');
      });
      if (!relevant || timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        const resolved = resolveFindScope();
        if (!scope.isConnected || resolved?.el !== scope) {
          onCloseRef.current();
          return;
        }
        if (queryRef.current.trim()) recompute(queryRef.current, 'mutation');
      }, 150);
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      mo.disconnect();
      clearTimeout(timer);
      clearHighlights();
    };
  }, [scope]);

  // Re-focus + select when Cmd+F is pressed while open.
  // biome-ignore lint/correctness/useExhaustiveDependencies: focusSignal is the trigger
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusSignal]);

  // Position for non-modal scopes.
  useEffect(() => {
    if (kind === 'modal') return;
    const update = () => {
      const rect = scope.getBoundingClientRect();
      setPos({ top: rect.top + 8, right: window.innerWidth - rect.right + 16 });
    };
    update();
    window.addEventListener('resize', update);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(scope);
    return () => {
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, [scope, kind]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      step(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  let counter = '';
  if (query.trim()) {
    counter = total === 0 ? 'No results' : `${current + 1}/${total}${capped ? '+' : ''}`;
  }

  const bar = (
    <search
      data-find-bar
      style={
        kind === 'modal' || !pos ? undefined : { position: 'fixed', top: pos.top, right: pos.right }
      }
      className={
        (kind === 'modal' ? 'absolute top-2 right-12 z-10 ' : 'fixed z-40 ') +
        'flex items-center gap-1 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md'
      }
    >
      <Input
        ref={inputRef}
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Find in page"
        aria-label="Find in page"
        className="h-7 w-48"
      />
      <span className="min-w-[4.5rem] text-center text-muted-foreground text-xs tabular-nums">
        {counter}
      </span>
      <Button variant="ghost" size="icon-sm" aria-label="Previous match" onClick={() => step(-1)}>
        <ChevronUp />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Next match" onClick={() => step(1)}>
        <ChevronDown />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Close find" onClick={onClose}>
        <X />
      </Button>
    </search>
  );

  return createPortal(bar, kind === 'modal' ? scope : document.body);
}
