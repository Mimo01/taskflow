/**
 * Shared table toolbar/header controls: multi-select `FilterPopover` and three-state
 * `SortableHeader`. Consumers: AIO cycle DefectsList and release detail UnifiedTaskTable.
 * Responsive (container-query) label variants are passed in via `label` because
 * Tailwind container classes must be literal at the call site.
 */
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { SortDir } from '@/lib/table-sort';

export function SortableHeader<K extends string>({
  sortKey,
  label,
  className,
  activeSortKey,
  activeSortDir,
  onSort,
  testIdPrefix,
}: {
  sortKey: K;
  label: ReactNode;
  className: string;
  activeSortKey: K | null;
  activeSortDir: SortDir;
  onSort: (key: K) => void;
  /** Test ids become `${prefix}-sort-header-${key}` / `${prefix}-sort-indicator-${key}`. */
  testIdPrefix: string;
}) {
  const isActive = activeSortKey === sortKey;
  return (
    <div className={className}>
      <button
        type="button"
        data-testid={`${testIdPrefix}-sort-header-${sortKey}`}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {isActive && activeSortDir === 'asc' && (
          <ChevronUp
            className="w-3 h-3"
            data-testid={`${testIdPrefix}-sort-indicator-${sortKey}`}
          />
        )}
        {isActive && activeSortDir === 'desc' && (
          <ChevronDown
            className="w-3 h-3"
            data-testid={`${testIdPrefix}-sort-indicator-${sortKey}`}
          />
        )}
      </button>
    </div>
  );
}

export function FilterPopover({
  dimension,
  testId,
  options,
  selected,
  setSelected,
  formatOption = (value) => value,
}: {
  dimension: string;
  testId: string;
  options: string[];
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** Display text for an option value (e.g. map a sentinel to a human label). */
  formatOption?: (value: string) => string;
}) {
  const isActive = selected.size > 0;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs gap-1"
            data-testid={testId}
          />
        }
      >
        {dimension}
        {isActive && <span className="ml-0.5 opacity-70">({selected.size})</span>}
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2">
        {options.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1">No options available</p>
        ) : (
          <ul className="max-h-48 overflow-auto space-y-0.5">
            {options.map((opt) => {
              const checked = selected.has(opt);
              return (
                <li key={opt}>
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-muted flex items-center gap-2 ${checked ? 'font-medium' : ''}`}
                    onClick={() => {
                      setSelected((prev) => {
                        const n = new Set(prev);
                        if (n.has(opt)) n.delete(opt);
                        else n.add(opt);
                        return n;
                      });
                    }}
                  >
                    <span
                      className={`w-3 h-3 border rounded-sm flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-muted-foreground'}`}
                    >
                      {checked && (
                        <span className="text-primary-foreground text-[8px] leading-none">✓</span>
                      )}
                    </span>
                    {formatOption(opt)}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
