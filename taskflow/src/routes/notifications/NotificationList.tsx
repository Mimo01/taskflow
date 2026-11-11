import { useVirtualizer } from '@tanstack/react-virtual';
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import {
  type EventEntry,
  entityKey,
  estimateEntryHeight,
  isFocusableEntry,
  type NotificationEntry,
  type StackEntry,
} from './notification-view';

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
  className,
}: NotificationListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (entries[i] ? estimateEntryHeight(entries[i]) : 72),
    overscan: 8,
    // Stable identity keys: entries remap indices on read/done, so an index-keyed
    // size cache would apply a row's height to a different entry.
    getItemKey: (i) => entries[i]?.id ?? i,
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
        pendingFocus.current = current + 1;
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
        pendingFocus.current = headerIndex >= 0 ? headerIndex : current;
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
        pendingFocus.current = current;
        onToggleRead(focusable);
        return;
      }
      case 'e':
      case 'Delete':
      case 'Backspace': {
        if (!focusable) return;
        e.preventDefault();
        pendingFocus.current = current;
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
        '@container relative min-h-0 flex-1 select-none overflow-y-auto overscroll-contain pt-2 pr-1 pb-3.5 pl-2.5 [scrollbar-width:thin]',
        className,
      )}
      onKeyDown={handleKeyDown}
    >
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
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <EntryWrapper
                    entry={entry}
                    index={virtualRow.index}
                    renderEntry={renderEntry}
                    expandedEntities={expandedEntities}
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
}: {
  entry: NotificationEntry;
  index: number;
  renderEntry: (entry: NotificationEntry) => ReactNode;
  expandedEntities: ReadonlySet<string>;
}) {
  const key = entry.kind === 'event' ? entityKey(entry.item) : null;
  const isMember = key != null && expandedEntities.has(key);
  return (
    <div
      data-entry-index={index}
      data-entry-id={entry.id}
      className={cn(
        (entry.kind === 'event' || entry.kind === 'stack') &&
          'pb-2 density-compact:pb-1.5 density-comfortable:pb-2.5',
        // Expanded members slide in; rows are inserted, never height-animated inside a measured row.
        isMember &&
          'fade-in-0 slide-in-from-top-1 animate-in duration-150 motion-reduce:animate-none',
      )}
    >
      {renderEntry(entry)}
    </div>
  );
}
