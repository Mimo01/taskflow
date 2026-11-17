import type { LucideIcon } from 'lucide-react';
import { useEffect, useImperativeHandle, useState } from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface SuggestionRow {
  key: string;
  label: string;
  detail?: string;
  mono?: boolean;
  avatar?: { url?: string; name: string };
  glyph?: string;
  icon?: LucideIcon;
  group?: 'Recent' | 'Text' | 'Blocks' | 'Insert';
  data: unknown;
}

export interface SuggestionPopoverHandle {
  onKeyDown(event: KeyboardEvent): boolean;
}

export interface SuggestionPopoverProps {
  rows: SuggestionRow[];
  loading: boolean;
  query?: string;
  onSelect: (row: SuggestionRow) => void;
  emptyText?: string;
  maxRows: number;
  listboxId: string;
  onActiveChange?: (optionId: string | null) => void;
  ref?: React.Ref<SuggestionPopoverHandle>;
}

const ROW_PX = 32;
const optionId = (listboxId: string, i: number) => `${listboxId}-opt-${i}`;

function Emphasised({ text, query }: { text: string; query?: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (!query || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="font-semibold">{text.slice(at, at + query.length)}</span>
      {text.slice(at + query.length)}
    </>
  );
}

/** Shared listbox for every editor autocomplete. Focus stays in the editor; keys arrive via the handle. */
export function SuggestionPopover({
  rows,
  loading,
  query,
  onSelect,
  emptyText,
  maxRows,
  listboxId,
  onActiveChange,
  ref,
}: SuggestionPopoverProps) {
  // Keep the last resolved rows visible while the next query loads (no blink).
  const [kept, setKept] = useState(rows);
  if (!loading && rows !== kept) setKept(rows);
  const display = loading ? kept : rows;

  const [active, setActive] = useState(0);
  const [prevDisplay, setPrevDisplay] = useState(display);
  if (prevDisplay !== display) {
    setPrevDisplay(display);
    setActive(0);
  }

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown(event) {
        if (display.length === 0) return false;
        if (event.key === 'ArrowDown') {
          setActive((i) => (i + 1) % display.length);
          return true;
        }
        if (event.key === 'ArrowUp') {
          setActive((i) => (i - 1 + display.length) % display.length);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const row = display[active];
          if (!row) return false;
          onSelect(row);
          return true;
        }
        return false;
      },
    }),
    [display, active, onSelect],
  );

  const hasRows = display.length > 0;
  useEffect(() => {
    onActiveChange?.(hasRows ? optionId(listboxId, active) : null);
  }, [active, hasRows, onActiveChange, listboxId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: display re-runs scroll after rows change
  useEffect(() => {
    document.getElementById(optionId(listboxId, active))?.scrollIntoView?.({ block: 'nearest' });
  }, [active, display, listboxId]);

  const showSkeleton = loading && display.length === 0;
  if (!showSkeleton && !hasRows && !emptyText) return null;

  return (
    <div
      data-suggestion=""
      className="w-72 min-w-56 max-w-80 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md"
      style={{ maxHeight: Math.min(maxRows * ROW_PX + 8, 280) }}
    >
      {showSkeleton && (
        <div className="flex flex-col gap-1" aria-hidden="true">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-8 w-full" />
          ))}
        </div>
      )}
      {!showSkeleton && !hasRows && (
        <div className="flex h-8 items-center px-2 text-xs text-muted-foreground">{emptyText}</div>
      )}
      {hasRows && (
        <div role="listbox" id={listboxId} aria-label="Suggestions">
          {display.map((row, i) => {
            const Icon = row.icon;
            const isActive = i === active;
            const heading = row.group && row.group !== display[i - 1]?.group ? row.group : null;
            return (
              <div key={row.key} role="presentation">
                {heading && (
                  <div className="px-2 pt-1.5 pb-0.5 text-xs font-semibold text-muted-foreground">
                    {heading}
                  </div>
                )}
                <div
                  id={optionId(listboxId, i)}
                  role="option"
                  tabIndex={-1}
                  aria-selected={isActive}
                  className={cn(
                    'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-xs',
                    isActive && 'bg-accent text-accent-foreground',
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerMove={() => setActive(i)}
                  onClick={() => onSelect(row)}
                  onKeyDown={() => {}}
                >
                  {row.avatar && (
                    <CachedAvatar
                      url={row.avatar.url}
                      name={row.avatar.name}
                      size={20}
                      className="shrink-0"
                    />
                  )}
                  {row.glyph && (
                    <span className="flex size-5 shrink-0 items-center justify-center">
                      {row.glyph}
                    </span>
                  )}
                  {Icon && (
                    <span className="flex size-5 shrink-0 items-center justify-center">
                      <Icon className="size-4" />
                    </span>
                  )}
                  <span className={cn('truncate', row.mono && 'font-mono')}>
                    <Emphasised text={row.label} query={query} />
                  </span>
                  {row.detail && (
                    <span className="ml-auto truncate text-muted-foreground">{row.detail}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
