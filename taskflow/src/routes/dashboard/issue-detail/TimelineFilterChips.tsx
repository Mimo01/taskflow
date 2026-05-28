/**
 * TimelineFilterChips — row of filter chips for the activity timeline.
 *
 * Uses Badge components styled as radio buttons for All / Changes / Comments.
 * Follows UI-SPEC.md accessibility contract: role="radiogroup" + role="radio" + aria-checked.
 */
import { Badge } from '@/components/ui/badge';
import type { TimelineFilter } from '@/services/jira';

interface TimelineFilterChipsProps {
  counts: { all: number; comment: number; change: number; worklog: number };
  active: TimelineFilter;
  onFilterChange: (filter: TimelineFilter) => void;
}

const FILTERS: {
  key: TimelineFilter;
  label: string;
  countKey: 'all' | 'comment' | 'change' | 'worklog';
}[] = [
  { key: 'comment', label: 'Comments', countKey: 'comment' },
  { key: 'change', label: 'Changes', countKey: 'change' },
  { key: 'worklog', label: 'Worklogs', countKey: 'worklog' },
];

export function TimelineFilterChips({ counts, active, onFilterChange }: TimelineFilterChipsProps) {
  return (
    <div role="radiogroup" aria-label="Filter activity" className="flex gap-2">
      {FILTERS.map(({ key, label, countKey }) => {
        const isActive = active === key;
        return (
          // biome-ignore lint/a11y/useSemanticElements: badge toggle pattern; <input type="radio"> would break the visual chip design
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onFilterChange(key)}
            className="cursor-pointer"
          >
            <Badge variant={isActive ? 'default' : 'outline'}>
              {label} ({counts[countKey]})
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
