import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { FIELD_LIST, FIELD_POPOVER, FIELD_ROW, FIELD_TRIGGER } from './field-styles';

export interface AutocompleteResult {
  id: string;
  label: string;
}

interface AutocompleteFieldProps {
  id: string;
  label: string;
  /** Selected value id ('' when none) and its display text. */
  value: string;
  displayText: string;
  results: AutocompleteResult[];
  /** Server-side search; called with '' when the popover opens. */
  onSearch: (query: string) => void;
  onSelect: (result: AutocompleteResult) => void;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Jira autocomplete custom field (e.g. Account) as a portaled picker, so the result list
 * never overflows the modal's scrolling sidebar. Search stays server-side per keystroke.
 */
export function AutocompleteField({
  id,
  label,
  value,
  displayText,
  results,
  onSearch,
  onSelect,
  required,
  disabled,
}: AutocompleteFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const shown = displayText || value;

  const pick = (r: AutocompleteResult) => {
    onSelect(r);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery('');
          setActive(0);
          onSearch('');
        }
      }}
    >
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-required={required || undefined}
        className={FIELD_TRIGGER}
      >
        {/* Inherited values (epic/parent) show their label before a value id is set. */}
        <span className={cn('min-w-0 flex-1 truncate', !shown && 'text-muted-foreground')}>
          {shown || `Select ${label}`}
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className={FIELD_POPOVER}>
        <Input
          autoFocus
          value={query}
          placeholder={`Search ${label}...`}
          aria-label={`Search ${label}`}
          className="mb-2 h-7 text-xs"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            onSearch(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && results[active]) {
              e.preventDefault();
              pick(results[active]);
            }
          }}
        />
        <div className={FIELD_LIST} role="listbox" aria-label={label}>
          {results.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No matches</p>
          )}
          {results.map((r, i) => (
            <button
              key={r.id}
              type="button"
              role="option"
              aria-selected={r.id === value}
              onClick={() => pick(r)}
              title={r.label}
              onMouseEnter={() => setActive(i)}
              className={cn(FIELD_ROW, i === active && 'bg-accent')}
            >
              <span className="flex size-4 shrink-0 items-center justify-center">
                {r.id === value && <Check className="size-4" />}
              </span>
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
