import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, ExternalLink, Search } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
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
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectIndex(activeIndex);
    }
    // Escape is handled by the Popover (closes without calling onChange).
  }

  const rowBase =
    'w-full text-left px-2 py-1 text-xs hover:bg-accent rounded flex items-center gap-2';

  return (
    <>
      <div className="relative mb-2">
        <Search
          className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          placeholder="Search epics…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          autoFocus
          className="h-7 pl-7 text-xs"
        />
      </div>
      <div role="listbox" className="max-h-64 overflow-y-auto">
        <button
          type="button"
          role="option"
          aria-selected={value === null}
          onClick={() => onChange(null)}
          className={cn(rowBase, 'text-muted-foreground', activeIndex === 0 && 'bg-accent')}
        >
          <span className="flex size-3.5 shrink-0 items-center justify-center">
            {value === null && <Check className="size-3.5" aria-hidden="true" />}
          </span>
          No epic
        </button>
        {epics.map((epic, j) => {
          const selected = value === epic.key;
          return (
            <button
              key={epic.key}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onChange(epic)}
              className={cn(rowBase, activeIndex === j + 1 && 'bg-accent')}
            >
              <span className="flex size-3.5 shrink-0 items-center justify-center">
                {selected && (
                  <Check className="size-3.5" data-testid="epic-check" aria-hidden="true" />
                )}
              </span>
              <EpicPill name={epic.name} epicKey={epic.key} color={epic.color} />
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{epic.key}</span>
            </button>
          );
        })}
      </div>
      {isLoading && <p className="px-1 py-1 text-xs text-muted-foreground">Searching…</p>}
      {!isLoading && epics.length === 0 && (
        <p className="px-1 py-1 text-xs text-muted-foreground">No open epics match</p>
      )}
      {openAction && (
        <div className="mt-1 border-t border-border/40 pt-1">
          <button
            type="button"
            onClick={openAction.onSelect}
            className={cn(rowBase, 'text-muted-foreground hover:text-foreground')}
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
        className="w-[max(20rem,var(--anchor-width))] max-w-(--available-width) p-2"
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
