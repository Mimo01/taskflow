/**
 * QuickFilterChipRow -- horizontal scrollable row of label-filter toggle chips.
 *
 * Renders one chip per issue label. Active chips use Badge variant="default",
 * inactive use variant="outline". Chips AND with existing UnifiedFilterBar
 * selections. Arrow keys move focus between chips; Space/Enter toggles.
 */

import { useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { useFilterStore } from '@/stores/filter.store';

interface QuickFilterChipRowProps {
  labels: string[];
}

export function QuickFilterChipRow({ labels }: QuickFilterChipRowProps) {
  const { activeLabelFilters, toggleLabelFilter } = useFilterStore();

  const chipRefs = useRef<(HTMLElement | null)[]>([]);

  const totalChips = labels.length;

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') {
      nextIndex = index < totalChips - 1 ? index + 1 : 0;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = index > 0 ? index - 1 : totalChips - 1;
    }
    if (nextIndex !== null) {
      e.preventDefault();
      chipRefs.current[nextIndex]?.focus();
    }
  };

  if (labels.length === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Quick filters"
      className="flex items-center gap-2 px-3 py-1.5 overflow-x-auto no-scrollbar"
    >
      {/* Label chips */}
      {labels.map((label, j) => {
        const isActive = activeLabelFilters.has(label);
        return (
          <Badge
            key={`label-${label}`}
            ref={(el: HTMLElement | null) => {
              chipRefs.current[j] = el;
            }}
            variant={isActive ? 'default' : 'outline'}
            role="switch"
            aria-checked={isActive}
            aria-label={
              isActive
                ? `${label} filter active, click to remove`
                : `${label} filter, click to apply`
            }
            tabIndex={j === 0 ? 0 : -1}
            className="cursor-pointer select-none"
            onClick={() => toggleLabelFilter(label)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggleLabelFilter(label);
              }
              handleKeyDown(e, j);
            }}
          >
            {label}
          </Badge>
        );
      })}
    </div>
  );
}
