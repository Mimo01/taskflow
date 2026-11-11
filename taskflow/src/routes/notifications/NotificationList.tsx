import { useVirtualizer } from '@tanstack/react-virtual';
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '../../lib/utils';
import {
  NOTIF_EXIT_MS,
  NOTIF_FOLD_MS,
  NOTIF_SLIDE_MS,
  NOTIF_UNFOLD_MS,
  prefersReducedMotion,
} from './notification-motion';
import {
  type EventEntry,
  entityKey,
  estimateEntryHeight,
  isFocusableEntry,
  type NotificationEntry,
  type StackEntry,
} from './notification-view';

/** Ephemeral motion state owned by NotificationPopover; the list only turns it into attributes. */
export interface NotificationListMotion {
  /** Item ids that just arrived while the panel is open (their event row slides in). */
  entering: ReadonlySet<string>;
  /** Entry id -> exit delay (ms): the card slides out, then the row collapses. */
  leaving: ReadonlyMap<string, number>;
  /** Entry ids whose read state just toggled (scale flash). */
  flashing: ReadonlySet<string>;
  /** Entity key of the stack that was just expanded (header + members unfold once). */
  justExpanded: string | null;
  /** Entity keys of open stacks that are folding closed (header + members fold up, then collapse). */
  folding?: ReadonlySet<string>;
  /** Entity key of the stack that just collapsed (its stack card fades in). */
  justCollapsed?: string | null;
}

const NO_MOTION: NotificationListMotion = {
  entering: new Set(),
  leaving: new Map(),
  flashing: new Set(),
  justExpanded: null,
  folding: new Set(),
  justCollapsed: null,
};

interface NotificationListProps {
  entries: NotificationEntry[];
  /** Row/header markup. Each focusable render must contain one `[data-entry-primary]` element. */
  renderEntry: (entry: NotificationEntry) => ReactNode;
  /** Toggle read on a card, or on every card of a collapsed stack. */
  onToggleRead: (entry: EventEntry | StackEntry) => void;
  /** Done a card, or a whole collapsed stack. */
  onDone: (entry: EventEntry | StackEntry) => void;
  /** Expand / collapse the stack of an entity key. */
  onToggleStack: (entity: string) => void;
  motion?: NotificationListMotion;
  /** Rendered inside the scroller above the rows, so it scrolls away with them. */
  header?: ReactNode;
  className?: string;
}

const MAX_FOCUS_ATTEMPTS = 5;

/**
 * Virtualized notification entry list with a popover-scoped keyboard triage layer
 * (j/k/arrows to move, u toggle read, e/Delete/Backspace done, Enter/Space/ArrowRight expand a
 * stack, Esc/ArrowLeft collapse the stack of the focused member). Handlers are bound to the
 * scroller only — never global hotkeys.
 */
export default function NotificationList({
  entries,
  renderEntry,
  onToggleRead,
  onDone,
  onToggleStack,
  motion = NO_MOTION,
  header,
  className,
}: NotificationListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  /** Height of the scrolling header above the rows = the virtualizer's scrollMargin. */
  const [headerHeight, setHeaderHeight] = useState(0);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) {
      setHeaderHeight(0);
      return;
    }
    const measure = () => setHeaderHeight(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pendingFocus = useRef<number | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Remember where focus should land once the entries change; expires if they never do (WR-06). */
  const setPendingFocus = (index: number) => {
    pendingFocus.current = index;
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => {
      pendingFocus.current = null;
    }, NOTIF_EXIT_MS + 300);
  };
  useEffect(
    () => () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    },
    [],
  );

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (entries[i] ? estimateEntryHeight(entries[i]) : 72),
    overscan: 8,
    // Stable identity keys: entries remap indices on read/done, so an index-keyed
    // size cache would apply a row's height to a different entry.
    getItemKey: (i) => entries[i]?.id ?? i,
    // Virtualize from the very first frame. Without a rect the first render falls back to the
    // plain list, then remounts the rows as virtual rows and re-positions them as they measure,
    // which made the panel look like it unrolled top-to-bottom while fading in (261111-m0g UAT).
    initialRect: {
      width: 0,
      height: typeof window === 'undefined' ? 800 : window.innerHeight,
    },
    // The header scrolls with the rows; rows start after it.
    scrollMargin: headerHeight,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const useVirtual = virtualItems.length > 0;

  const focusEntry = useCallback(
    (index: number) => {
      rowVirtualizer.scrollToIndex(index, { align: 'auto' });
      let attempts = 0;
      const tryFocus = () => {
        const el = parentRef.current?.querySelector<HTMLElement>(
          `[data-entry-index="${index}"] [data-entry-primary]`,
        );
        if (el) {
          el.focus();
          return;
        }
        attempts += 1;
        if (attempts < MAX_FOCUS_ATTEMPTS) requestAnimationFrame(tryFocus);
      };
      requestAnimationFrame(tryFocus);
    },
    [rowVirtualizer],
  );

  // Resolve a pending focus target once the entries list has been updated.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when entries change only
  useEffect(() => {
    const pending = pendingFocus.current;
    if (pending == null) return;
    pendingFocus.current = null;
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    let target = -1;
    for (let i = Math.min(pending, entries.length); i < entries.length; i++) {
      if (isFocusableEntry(entries[i])) {
        target = i;
        break;
      }
    }
    if (target < 0) {
      for (let i = Math.min(pending, entries.length) - 1; i >= 0; i--) {
        if (isFocusableEntry(entries[i])) {
          target = i;
          break;
        }
      }
    }
    if (target >= 0) focusEntry(target);
  }, [entries]);

  // Entities currently expanded (their stack-header is in the list): members of these collapse on Esc.
  const expandedEntities = new Set(
    entries.flatMap((e) => (e.kind === 'stack-header' ? [e.entity] : [])),
  );

  /** Position of an expanded member within its stack (drives the fan-out), else -1. */
  const memberIndexOf = (index: number): number => {
    const entry = entries[index];
    if (!entry || entry.kind !== 'event' || !motion.justExpanded) return -1;
    const entity = entityKey(entry.item);
    if (entity !== motion.justExpanded) return -1;
    const header = entries.findIndex((x) => x.kind === 'stack-header' && x.entity === entity);
    return header >= 0 ? index - header - 1 : -1;
  };

  /** Last card of an open group: gets extra space below so the group's end is clear. */
  const isGroupEnd = (index: number): boolean => {
    const entry = entries[index];
    if (!entry || entry.kind !== 'event') return false;
    const entity = entityKey(entry.item);
    if (!entity || !expandedEntities.has(entity)) return false;
    const next = entries[index + 1];
    return !(next && next.kind === 'event' && entityKey(next.item) === entity);
  };

  const nextFocusable = (from: number, dir: 1 | -1): number => {
    for (let i = from + dir; i >= 0 && i < entries.length; i += dir) {
      if (isFocusableEntry(entries[i])) return i;
    }
    return -1;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as HTMLElement).closest('input,textarea,[contenteditable="true"]')) return;

    const active = document.activeElement as HTMLElement | null;
    const attr = active?.closest('[data-entry-index]')?.getAttribute('data-entry-index');
    const current = attr == null ? -1 : Number(attr);
    const entry = current >= 0 ? entries[current] : undefined;
    const focusable = entry && isFocusableEntry(entry) ? entry : undefined;
    const onPrimary = Boolean((e.target as HTMLElement).closest('[data-entry-primary]'));

    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'ArrowRight': {
        if (!focusable || focusable.kind !== 'stack') return;
        if (e.key !== 'ArrowRight' && !onPrimary) return;
        e.preventDefault();
        // The stack row is replaced by header + members: land on the first member.
        setPendingFocus(current + 1);
        onToggleStack(focusable.entity);
        return;
      }
      case 'Escape':
      case 'ArrowLeft': {
        if (!focusable || focusable.kind !== 'event') return;
        const entity = entityKey(focusable.item);
        if (!entity || !expandedEntities.has(entity)) return;
        e.preventDefault();
        e.stopPropagation();
        // Collapsing puts the stack where the stack-header is now.
        const headerIndex = entries.findIndex(
          (x) => x.kind === 'stack-header' && x.entity === entity,
        );
        setPendingFocus(headerIndex >= 0 ? headerIndex : current);
        onToggleStack(entity);
        return;
      }
      case 'ArrowDown':
      case 'j': {
        e.preventDefault();
        const n = nextFocusable(current, 1);
        if (n >= 0) focusEntry(n);
        return;
      }
      case 'ArrowUp':
      case 'k': {
        e.preventDefault();
        const n = nextFocusable(current, -1);
        if (n >= 0) focusEntry(n);
        return;
      }
      case 'u': {
        if (!focusable) return;
        e.preventDefault();
        // In the Unread view the card drops out once read; re-resolve focus like Done does.
        setPendingFocus(current);
        onToggleRead(focusable);
        return;
      }
      case 'e':
      case 'Delete':
      case 'Backspace': {
        if (!focusable) return;
        e.preventDefault();
        setPendingFocus(current);
        onDone(focusable);
        return;
      }
      default:
        return;
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: keyboard triage layer scoped to the list
    <div
      ref={parentRef}
      className={cn(
        '@container relative min-h-0 flex-1 select-none overflow-y-auto overscroll-contain pt-0 pr-1 pb-3.5 pl-2.5 [scrollbar-width:thin]',
        className,
      )}
      onKeyDown={handleKeyDown}
    >
      {header ? <div ref={headerRef}>{header}</div> : null}
      <div
        style={
          useVirtual
            ? { height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }
            : undefined
        }
      >
        {useVirtual
          ? virtualItems.map((virtualRow) => {
              const entry = entries[virtualRow.index];
              if (!entry) return null;
              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start - headerHeight}px)`,
                  }}
                >
                  <EntryWrapper
                    entry={entry}
                    index={virtualRow.index}
                    renderEntry={renderEntry}
                    expandedEntities={expandedEntities}
                    motion={motion}
                    memberIndex={memberIndexOf(virtualRow.index)}
                    groupEnd={isGroupEnd(virtualRow.index)}
                  />
                </div>
              );
            })
          : entries.map((entry, i) => (
              <EntryWrapper
                key={entry.id}
                entry={entry}
                index={i}
                renderEntry={renderEntry}
                expandedEntities={expandedEntities}
                motion={motion}
                memberIndex={memberIndexOf(i)}
                groupEnd={isGroupEnd(i)}
              />
            ))}
      </div>
    </div>
  );
}

function EntryWrapper({
  entry,
  index,
  renderEntry,
  expandedEntities,
  motion,
  memberIndex,
  groupEnd,
}: {
  entry: NotificationEntry;
  index: number;
  renderEntry: (entry: NotificationEntry) => ReactNode;
  expandedEntities: ReadonlySet<string>;
  motion: NotificationListMotion;
  memberIndex: number;
  /** Last card of an open group: extra space below it marks where the group ends. */
  groupEnd: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const leaveDelay = motion.leaving.get(entry.id);
  const leaving = leaveDelay !== undefined;
  // 0 = idle, 1 = height pinned to the measured value, 2 = collapsing to 0.
  const [collapse, setCollapse] = useState<{ phase: 0 | 1 | 2; height: number }>({
    phase: 0,
    height: 0,
  });

  // After the slide-out, collapse this row's own height so the rows below glide up. The
  // virtualizer's ResizeObserver re-measures the row; no row is rebuilt.
  useEffect(() => {
    if (leaveDelay === undefined) return;
    let raf = 0;
    const timer = setTimeout(() => {
      setCollapse({ phase: 1, height: ref.current?.offsetHeight ?? 0 });
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => setCollapse((c) => ({ ...c, phase: 2 })));
      });
    }, NOTIF_SLIDE_MS + leaveDelay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [leaveDelay]);

  const key = entry.kind === 'event' ? entityKey(entry.item) : null;
  const isMember = key != null && expandedEntities.has(key);
  const entering = entry.kind === 'event' && motion.entering.has(entry.item.id);
  const fanning = memberIndex >= 0 && isMember;
  const groupKey =
    entry.kind === 'stack-header' || entry.kind === 'stack' ? entry.entity : isMember ? key : null;
  /** Open group folding closed: header + members fold up while their rows shrink to 0. */
  const folding =
    groupKey != null && entry.kind !== 'stack' && (motion.folding?.has(groupKey) ?? false);
  /** Open group just opened: header + members grow from 0 so the rows below glide down. */
  const unfolding =
    fanning || (entry.kind === 'stack-header' && motion.justExpanded === entry.entity);
  const justCollapsed = entry.kind === 'stack' && motion.justCollapsed === entry.entity;

  // Unfold: measure the natural height, start at 0, grow to it, then release the height.
  const [grow, setGrow] = useState<{ phase: 0 | 1 | 2; height: number }>({ phase: 0, height: 0 });
  useLayoutEffect(() => {
    if (!unfolding || prefersReducedMotion()) return;
    const height = ref.current?.offsetHeight ?? 0;
    setGrow({ phase: 1, height });
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setGrow({ phase: 2, height }));
    });
    const done = setTimeout(() => setGrow({ phase: 0, height: 0 }), NOTIF_UNFOLD_MS + 60);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [unfolding]);

  // Fold: pin the measured height, then shrink to 0 (the popover collapses the stack after).
  useEffect(() => {
    if (!folding) return;
    setCollapse({ phase: 1, height: ref.current?.offsetHeight ?? 0 });
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setCollapse((c) => ({ ...c, phase: 2 })));
    });
    return () => cancelAnimationFrame(raf);
  }, [folding]);

  const style: CSSProperties = {};
  if (fanning) {
    (style as Record<string, string | number>)['--i'] = memberIndex;
    style.animationDelay = `${Math.min(memberIndex, 6) * 30}ms`;
  }
  if (leaving) (style as Record<string, string | number>)['--leave-delay'] = `${leaveDelay}ms`;
  if (collapse.phase > 0) {
    style.overflow = 'hidden';
    style.height = collapse.phase === 1 ? collapse.height : 0;
    if (collapse.phase === 2) {
      style.paddingBottom = 0;
      style.paddingTop = 0;
    }
    const d = folding ? `${NOTIF_FOLD_MS}ms` : '.28s';
    style.transition = `height ${d} var(--ease-out), padding-bottom ${d} var(--ease-out), padding-top ${d} var(--ease-out)`;
  } else if (grow.phase > 0) {
    style.overflow = 'hidden';
    style.height = grow.phase === 1 ? 0 : grow.height;
    if (grow.phase === 2) style.transition = `height ${NOTIF_UNFOLD_MS}ms var(--ease-out)`;
  }

  return (
    <div
      ref={ref}
      data-notif-entry
      data-entry-index={index}
      data-entry-id={entry.id}
      data-stack-header-entry={entry.kind === 'stack-header' ? '' : undefined}
      data-entering={entering ? 'true' : undefined}
      data-leaving={leaving ? 'true' : undefined}
      data-flash={motion.flashing.has(entry.id) ? 'true' : undefined}
      data-group-end={groupEnd ? 'true' : undefined}
      data-folding={folding ? 'true' : undefined}
      style={Object.keys(style).length ? style : undefined}
      className={cn(
        (entry.kind === 'event' || entry.kind === 'stack') &&
          (groupEnd
            ? 'pb-7 density-compact:pb-6 density-comfortable:pb-8'
            : 'pb-2 density-compact:pb-1.5 density-comfortable:pb-2.5'),
        // An open group also gets space above its header, so it reads as one block.
        entry.kind === 'stack-header' && 'pt-3 density-compact:pt-2.5 density-comfortable:pt-3.5',
        entering && 'animate-[notif-enter_.45s_var(--ease-out)_both]',
        // Expanded members unfold once per expand (not on every virtual remount).
        fanning && 'animate-[notif-fan_.26s_var(--ease-out)_both]',
        entry.kind === 'stack-header' &&
          motion.justExpanded === entry.entity &&
          'animate-[notif-fade_.2s_var(--ease-out)_both]',
        folding && 'animate-[notif-fold_.2s_ease-in_both]',
        justCollapsed && 'animate-[notif-fade_.2s_var(--ease-out)_both]',
      )}
    >
      {renderEntry(entry)}
    </div>
  );
}
