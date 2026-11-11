import { useVirtualizer } from '@tanstack/react-virtual';
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import {
  type EventEntry,
  estimateEntryHeight,
  isFocusableEntry,
  type NotificationEntry,
} from './notification-view';

interface NotificationListProps {
  entries: NotificationEntry[];
  /** Row/header markup. Each focusable render must contain one `[data-entry-primary]` element. */
  renderEntry: (entry: NotificationEntry) => ReactNode;
  onToggleRead: (entry: EventEntry) => void;
  onDone: (entry: EventEntry) => void;
  className?: string;
}

const MAX_FOCUS_ATTEMPTS = 5;

/**
 * Virtualized notification entry list with a popover-scoped keyboard triage layer
 * (j/k/arrows to move, u toggle read, e/Delete done). Handlers are bound to the
 * scroller only — never global hotkeys.
 */
export default function NotificationList({
  entries,
  renderEntry,
  onToggleRead,
  onDone,
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

    switch (e.key) {
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
      case 'Delete': {
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
        '@container relative max-h-[520px] overflow-y-auto bg-muted/40 px-2 py-1 dark:bg-muted/20',
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
                  <EntryWrapper entry={entry} index={virtualRow.index} renderEntry={renderEntry} />
                </div>
              );
            })
          : entries.map((entry, i) => (
              <EntryWrapper key={entry.id} entry={entry} index={i} renderEntry={renderEntry} />
            ))}
      </div>
    </div>
  );
}

function EntryWrapper({
  entry,
  index,
  renderEntry,
}: {
  entry: NotificationEntry;
  index: number;
  renderEntry: (entry: NotificationEntry) => ReactNode;
}) {
  return (
    <div
      data-entry-index={index}
      data-entry-id={entry.id}
      className={cn(
        entry.kind === 'event' && 'pb-1.5 density-compact:pb-1 density-comfortable:pb-2',
      )}
    >
      {renderEntry(entry)}
    </div>
  );
}
