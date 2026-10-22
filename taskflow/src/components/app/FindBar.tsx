import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  buildMatchRanges,
  collectRuns,
  type FindScopeKind,
  layoutMatchBoxes,
  resolveFindScope,
  scrollRangeIntoView,
} from '@/lib/find-in-page';

interface FindBarProps {
  scope: HTMLElement;
  kind: FindScopeKind;
  focusSignal: number;
  onClose: () => void;
}

// Matches are drawn as boxes on a pointer-events-none overlay rather than with the
// CSS Custom Highlight API: WKWebView doesn't paint ::highlight on text that is a
// direct child of a flex/grid container, inside a <button>, or user-select:none —
// i.e. most badges, pills, and field triggers in this app.
function createOverlay(kind: FindScopeKind): HTMLDivElement {
  const el = document.createElement('div');
  // data-find-bar: excluded from matching and from the mutation observer
  el.setAttribute('data-find-bar', '');
  el.setAttribute('aria-hidden', 'true');
  el.className = `find-overlay ${kind === 'modal' ? 'z-[60]' : 'z-30'}`;
  document.body.append(el);
  return el;
}

function paintBoxes(overlay: HTMLDivElement, ranges: Range[], idx: number) {
  const boxes = layoutMatchBoxes(ranges, idx);
  while (overlay.childElementCount > boxes.length) overlay.lastElementChild?.remove();
  while (overlay.childElementCount < boxes.length) overlay.append(document.createElement('div'));
  boxes.forEach((b, i) => {
    const el = overlay.children[i] as HTMLDivElement;
    el.className = b.current ? 'find-hl find-hl-current' : 'find-hl';
    el.style.transform = `translate(${b.left}px, ${b.top}px)`;
    el.style.width = `${b.width}px`;
    el.style.height = `${b.height}px`;
  });
}

export function FindBar({ scope, kind, focusSignal, onClose }: FindBarProps) {
  const [query, setQuery] = useState('');
  const [total, setTotal] = useState(0);
  const [capped, setCapped] = useState(false);
  const [current, setCurrent] = useState(0);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const rangesRef = useRef<Range[]>([]);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const idxRef = useRef(0);
  const queryRef = useRef('');
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const paint = () => {
    if (overlayRef.current) paintBoxes(overlayRef.current, rangesRef.current, idxRef.current);
  };

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
    setTotal(ranges.length);
    setCapped(cap);
    setCurrent(idx);
    if (mode === 'query' && ranges[idx]) scrollRangeIntoView(ranges[idx]);
    paint();
  };

  const step = (delta: 1 | -1) => {
    const n = rangesRef.current.length;
    if (n === 0) return;
    const idx = (idxRef.current + delta + n) % n;
    idxRef.current = idx;
    setCurrent(idx);
    scrollRangeIntoView(rangesRef.current[idx]);
    paint();
  };

  // Overlay for match boxes; repainted (rAF-throttled) on any scroll or resize,
  // since boxes are in viewport coordinates. Declared before the query effect so
  // the overlay exists for the first paint.
  // biome-ignore lint/correctness/useExhaustiveDependencies: paint reads refs only
  useEffect(() => {
    const overlay = createOverlay(kind);
    overlayRef.current = overlay;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        paint();
      });
    };
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(scope);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
      overlay.remove();
      overlayRef.current = null;
    };
  }, [scope, kind]);

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
      const isOwn = (n: Node) => n instanceof Element && n.hasAttribute('data-find-bar');
      const relevant = records.some((r) => {
        const el = r.target instanceof Element ? r.target : r.target.parentElement;
        if (el?.closest('[data-find-bar]')) return false;
        // Mounting/unmounting our own overlay or bar portal on <body>
        const changed = [...r.addedNodes, ...r.removedNodes];
        return !(changed.length > 0 && changed.every(isOwn));
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
