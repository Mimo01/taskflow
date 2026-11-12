import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, ExternalLink, Search } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useEffect, useId, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { epicColorToTailwind } from '@/lib/epicColors';
import { cn } from '@/lib/utils';
import { type EpicOption, fetchEpicSummary } from '@/services/jira/epics';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useEpicSearch } from './use-epic-search';

export function EpicPill({
  name,
  epicKey,
  color,
  className,
}: {
  name: string;
  epicKey: string;
  color: string | null;
  className?: string;
}) {
  const result = epicColorToTailwind(color, epicKey);
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center rounded border px-1.5 py-0.5 text-xs font-medium',
        result.className,
        className,
      )}
      style={result.style}
    >
      <span className="truncate">{name}</span>
    </span>
  );
}

interface PanelProps {
  value: string | null;
  onChange: (epic: EpicOption | null) => void;
  projectKey?: string;
  open: boolean;
  openAction?: { label: string; onSelect: () => void };
  footer?: ReactNode;
  onSearchResults?: (epics: EpicOption[]) => void;
}

function EpicPickerPanel({
  value,
  onChange,
  projectKey,
  open,
  openAction,
  footer,
  onSearchResults,
}: PanelProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(-1);
    }
  }, [open]);

  const { epics, isLoading } = useEpicSearch({ projectKey, query, open });

  useEffect(() => {
    onSearchResults?.(epics);
  }, [epics, onSearchResults]);

  // New results invalidate the highlighted index (it may now point past the end).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is keyed on the result list
  useEffect(() => {
    setActiveIndex(-1);
  }, [epics]);

  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' });
  });

  // Index 0 is the "No epic" row; epic rows follow.
  const total = epics.length + 1;

  function selectIndex(i: number) {
    if (i < 0 || i >= total) return;
    onChange(i === 0 ? null : epics[i - 1]);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, total - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        e.preventDefault();
        selectIndex(activeIndex);
      } else if (query.trim() && epics.length > 0) {
        // Typed a search and hit Enter: take the top hit.
        e.preventDefault();
        selectIndex(1);
      }
    }
    // Escape is handled by the Popover (closes without calling onChange).
  }

  // Rows share one column grid (subgrid): check | pill | key — check leads, like the Fix
  // Versions picker. Fixed h-8 so "No epic", epic rows and the footer action share one rhythm;
  // the check column sits under the search icon / footer icon, pills under the search text.
  const rowBase =
    'col-span-3 grid grid-cols-subgrid h-8 w-full items-center rounded-md px-1.5 text-left text-xs outline-none hover:bg-accent';
  const checkSlot = (selected: boolean, testId?: string) => (
    <span className="flex size-3.5 items-center justify-center">
      {selected && <Check className="size-3.5" data-testid={testId} aria-hidden="true" />}
    </span>
  );

  return (
    <>
      <div className="-mx-1 -mt-1 mb-1 flex h-9 items-center gap-2 border-b border-border/60 px-2.5">
        <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          placeholder="Search epics…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          // biome-ignore lint/a11y/noAutofocus: popover search field, same as PersonPicker
          autoFocus
          className="h-full min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div
        id={listId}
        role="listbox"
        className="grid max-h-64 grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2 overflow-y-auto"
      >
        <button
          id={optionId(0)}
          type="button"
          role="option"
          aria-selected={value === null}
          onClick={() => onChange(null)}
          className={cn(rowBase, activeIndex === 0 && 'bg-accent')}
        >
          {checkSlot(value === null)}
          <span className="min-w-0">
            <span className="inline-flex items-center rounded border border-dashed border-border px-1.5 py-0.5 text-xs text-muted-foreground">
              No epic
            </span>
          </span>
          <span />
        </button>
        {epics.map((epic, j) => {
          const selected = value === epic.key;
          return (
            <button
              key={epic.key}
              id={optionId(j + 1)}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onChange(epic)}
              className={cn(rowBase, activeIndex === j + 1 && 'bg-accent')}
            >
              {checkSlot(selected, 'epic-check')}
              <span className="flex min-w-0">
                <EpicPill name={epic.name} epicKey={epic.key} color={epic.color} />
              </span>
              <span className="pl-2 text-muted-foreground tabular-nums">{epic.key}</span>
            </button>
          );
        })}
        {(isLoading || epics.length === 0) && (
          <p className="col-span-3 flex h-8 items-center pr-1.5 pl-7 text-xs text-muted-foreground">
            {isLoading ? 'Searching…' : 'No open epics match'}
          </p>
        )}
      </div>
      {openAction && (
        <div className="-mx-1 mt-1 border-t border-border/60 px-1 pt-1">
          <button
            type="button"
            onClick={openAction.onSelect}
            className="flex h-8 w-full items-center gap-2 rounded-md px-1.5 text-left text-xs text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
            {openAction.label}
          </button>
        </div>
      )}
      {footer}
    </>
  );
}

export interface EpicPickerProps {
  variant: 'inline' | 'field';
  /** Linked epic key, or null for none. */
  value: string | null;
  onChange: (epic: EpicOption | null) => void;
  projectKey?: string;
  id?: string;
  'aria-label'?: string;
  triggerTestId?: string;
  disabled?: boolean;
  openAction?: { label: string; onSelect: () => void };
  footer?: ReactNode;
}

export function EpicPicker({
  variant,
  value,
  onChange,
  projectKey,
  id,
  'aria-label': ariaLabel,
  triggerTestId,
  disabled,
  openAction,
  footer,
}: EpicPickerProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<EpicOption[]>([]);
  const base = useAuthStore((s) => s.jiraBaseUrl) ?? '';
  const epicNameFieldKey = useSettingsStore((s) => s.epicNameFieldKey);
  const epicColorFieldKey = useSettingsStore((s) => s.epicColorFieldKey);

  // Resolve the linked epic itself so a Done / off-list epic still renders. Same key + shape
  // as the issue-detail sidebar so the cache is shared.
  const { data: resolved } = useQuery({
    queryKey: ['jira-issue-name', value, base],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) return null;
      return fetchEpicSummary(base, token, value as string, epicNameFieldKey, epicColorFieldKey);
    },
    enabled: !!value && !!base,
    staleTime: 60_000,
  });

  let pill: ReactNode = null;
  if (value) {
    const fromSearch = results.find((e) => e.key === value);
    const name = resolved
      ? (resolved.fields[epicNameFieldKey] as string | null) || resolved.fields.summary
      : (fromSearch?.name ?? value);
    const color = resolved
      ? ((resolved.fields[epicColorFieldKey] as string | null) ?? null)
      : (fromSearch?.color ?? null);
    pill = <EpicPill name={name} epicKey={value} color={color} />;
  }

  const trigger = pill ?? <span className="truncate text-muted-foreground">No epic</span>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        aria-label={ariaLabel}
        data-testid={triggerTestId}
        disabled={disabled}
        className={
          variant === 'inline'
            ? 'hover:bg-accent rounded px-1 -ml-1 cursor-pointer text-left text-sm inline-flex min-w-0 max-w-full items-center gap-1.5'
            : 'flex h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-transparent pr-2 pl-2.5 text-left text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50'
        }
      >
        {variant === 'field' ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5">{trigger}</span>
        ) : (
          trigger
        )}
        {variant === 'field' && <ChevronDown className="size-4 shrink-0 opacity-50" />}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        // Inline (sidebar): the leading check column hangs left so list pills line up with the
        // trigger pill — trigger pads its pill 4px (px-1 -ml-1), list pills sit at 32px
        // (p-1 + px-1.5 + check 14 + gap 8). Field variant keeps the popover flush with the box.
        alignOffset={variant === 'inline' ? -28 : 0}
        className="w-[max(20rem,var(--anchor-width))] max-w-(--available-width) p-1"
      >
        <EpicPickerPanel
          value={value}
          projectKey={projectKey}
          open={open}
          openAction={
            openAction
              ? {
                  label: openAction.label,
                  onSelect: () => {
                    setOpen(false);
                    openAction.onSelect();
                  },
                }
              : undefined
          }
          footer={footer}
          onSearchResults={setResults}
          onChange={(epic) => {
            setOpen(false);
            onChange(epic);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
