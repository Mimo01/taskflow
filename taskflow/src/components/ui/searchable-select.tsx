import { Command as CommandPrimitive } from 'cmdk';
import { Check, ChevronDown } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Command, CommandEmpty, CommandInput, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  /** Unique id; also the cmdk item identity. */
  value: string;
  label: ReactNode;
  /** Plain strings matched by the search box (name AND key/id). */
  keywords: string[];
  /** Shown in the trigger instead of `label` when selected. */
  triggerLabel?: ReactNode;
}

export interface SearchableSelectProps {
  id?: string;
  value: string | null;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  'aria-label'?: string;
  testIdPrefix?: string;
  className?: string;
}

/** Single-select with a search box: Popover + cmdk, leading check on the selected row. */
export function SearchableSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches',
  disabled,
  'aria-label': ariaLabel,
  testIdPrefix = 'searchable-select',
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = value === null ? undefined : options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        aria-label={ariaLabel}
        disabled={disabled}
        data-testid={`${testIdPrefix}-trigger`}
        className={cn(
          'flex h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-transparent pr-2 pl-2.5 text-left text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50',
          className,
        )}
      >
        <span
          className={cn(
            'flex min-w-0 flex-1 items-center truncate',
            !selected && 'text-muted-foreground',
          )}
        >
          {selected ? (selected.triggerLabel ?? selected.label) : placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      {/* Command remounts on every open, so the search text resets on close. */}
      <PopoverContent
        align="start"
        className="w-[max(20rem,var(--anchor-width))] max-w-(--available-width) p-0"
      >
        <Command loop>
          <CommandInput placeholder={searchPlaceholder} autoFocus />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <CommandPrimitive.Item
                  key={opt.value}
                  value={opt.value}
                  keywords={opt.keywords}
                  data-checked={isSelected ? 'true' : undefined}
                  aria-selected={isSelected}
                  onSelect={() => {
                    setOpen(false);
                    onValueChange(opt.value);
                  }}
                  className="relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-selected:bg-muted data-selected:text-foreground"
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    {isSelected && (
                      <Check className="size-3.5" data-testid={`${testIdPrefix}-check`} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                </CommandPrimitive.Item>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
