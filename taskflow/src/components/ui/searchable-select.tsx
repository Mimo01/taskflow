import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronDown, SearchIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  /** Unique id; also the cmdk item identity. */
  value: string;
  label: ReactNode;
  /** Muted secondary text after the label (project key, board id…). */
  detail?: string;
  /** Plain strings matched by the search box (name AND key/id). */
  keywords: string[];
}

export interface SearchableSelectProps {
  id?: string;
  value: string | null;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  /**
   * Special option (e.g. "None") pinned above the list: never filtered out by
   * the search and separated from the regular options by a divider.
   */
  pinnedOption?: SearchableSelectOption;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  'aria-label'?: string;
  testIdPrefix?: string;
  className?: string;
}

const ROW_CLASS =
  'relative flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-hidden select-none';

function OptionContent({
  option,
  checked,
  testIdPrefix,
}: {
  option: SearchableSelectOption;
  checked: boolean;
  testIdPrefix: string;
}) {
  return (
    <>
      <span className="flex size-4 shrink-0 items-center justify-center">
        {checked && <Check className="size-3.5" data-testid={`${testIdPrefix}-check`} />}
      </span>
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      {option.detail && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {option.detail}
        </span>
      )}
    </>
  );
}

/**
 * Single-select with a search box: Popover + cmdk. Search header sits above the
 * list behind a divider; the selected row carries a leading check and is
 * highlighted + scrolled into view on open; an optional pinned option stays on top.
 */
export function SearchableSelect({
  id,
  value,
  onValueChange,
  options,
  pinnedOption,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches',
  disabled,
  'aria-label': ariaLabel,
  testIdPrefix = 'searchable-select',
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const all = pinnedOption ? [pinnedOption, ...options] : options;
  const selected = value === null ? undefined : all.find((o) => o.value === value);
  const searching = search.trim() !== '';

  const pick = (v: string) => {
    setOpen(false);
    onValueChange(v);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <PopoverTrigger
        id={id}
        aria-label={ariaLabel}
        disabled={disabled}
        data-testid={`${testIdPrefix}-trigger`}
        className={cn(
          'flex h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-transparent pr-2 pl-2.5 text-left text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[popup-open]:border-ring dark:bg-input/30 dark:hover:bg-input/50',
          className,
        )}
      >
        <span
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2',
            !selected && 'text-muted-foreground',
          )}
        >
          <span className="min-w-0 truncate">{selected ? selected.label : placeholder}</span>
          {selected?.detail && (
            <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
              {selected.detail}
            </span>
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[max(20rem,var(--anchor-width))] max-w-(--available-width) gap-0 overflow-hidden p-0"
      >
        {/* Remounts on every open: highlight starts on the selected row. */}
        <CommandPrimitive
          loop
          defaultValue={value ?? undefined}
          className="flex flex-col bg-popover text-popover-foreground"
        >
          <div className="flex items-center gap-2 border-b px-3">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              value={search}
              onValueChange={setSearch}
              placeholder={searchPlaceholder}
              autoFocus
              className="h-10 w-full min-w-0 bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
            />
          </div>
          <CommandPrimitive.List className="max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto p-1 outline-none">
            {pinnedOption &&
              (searching ? (
                // While searching the pinned row leaves cmdk's item set, so the
                // first *match* gets the highlight and Enter picks it, not None.
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  data-testid={`${testIdPrefix}-pinned`}
                  onClick={() => pick(pinnedOption.value)}
                  className={cn(ROW_CLASS, 'hover:bg-muted')}
                >
                  <OptionContent
                    option={pinnedOption}
                    checked={pinnedOption.value === value}
                    testIdPrefix={testIdPrefix}
                  />
                </button>
              ) : (
                <CommandPrimitive.Item
                  value={pinnedOption.value}
                  forceMount
                  data-testid={`${testIdPrefix}-pinned`}
                  data-checked={pinnedOption.value === value ? 'true' : undefined}
                  onSelect={() => pick(pinnedOption.value)}
                  className={cn(ROW_CLASS, 'data-selected:bg-muted')}
                >
                  <OptionContent
                    option={pinnedOption}
                    checked={pinnedOption.value === value}
                    testIdPrefix={testIdPrefix}
                  />
                </CommandPrimitive.Item>
              ))}
            {pinnedOption && (
              <CommandPrimitive.Separator alwaysRender className="-mx-1 my-1 h-px bg-border" />
            )}
            <CommandPrimitive.Empty className="px-2 py-4 text-center text-sm text-muted-foreground">
              {emptyText}
            </CommandPrimitive.Empty>
            {options.map((opt) => {
              const isChecked = opt.value === value;
              return (
                <CommandPrimitive.Item
                  key={opt.value}
                  value={opt.value}
                  keywords={opt.keywords}
                  data-checked={isChecked ? 'true' : undefined}
                  onSelect={() => pick(opt.value)}
                  className={cn(ROW_CLASS, 'data-selected:bg-muted data-selected:text-foreground')}
                >
                  <OptionContent option={opt} checked={isChecked} testIdPrefix={testIdPrefix} />
                </CommandPrimitive.Item>
              );
            })}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </PopoverContent>
    </Popover>
  );
}
