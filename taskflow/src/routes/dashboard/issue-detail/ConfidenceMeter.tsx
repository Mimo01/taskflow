/**
 * ConfidenceMeter — a 3-bar signal glyph plus the High / Medium / Low word, used everywhere the
 * forecast confidence appears (Finish tile and tooltip, chart tooltip, forecast legend).
 * Neutral colours only: colour in this feature is reserved for statuses.
 */
import type { Confidence } from '@/lib/epic-progress';
import { cn } from '@/lib/utils';

const WORD: Record<Confidence, string> = { low: 'Low', medium: 'Medium', high: 'High' };
const FILLED: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };
const BAR_HEIGHT = ['h-1.5', 'h-2.5', 'h-3.5'] as const;

export function ConfidenceMeter({
  level,
  className,
}: {
  level: Confidence | null;
  className?: string;
}) {
  if (level === null) return null;
  const filled = FILLED[level];
  return (
    <span
      data-testid="confidence-meter"
      data-level={level}
      role="img"
      aria-label={`${WORD[level]} confidence`}
      className={cn('inline-flex items-center gap-1 text-xs', className)}
    >
      <span aria-hidden="true" className="flex items-end gap-px">
        {BAR_HEIGHT.map((h, i) => (
          <span
            key={h}
            className={cn(
              'w-[3px] rounded-[1px]',
              h,
              i < filled ? 'bg-foreground/70' : 'bg-muted-foreground/25',
            )}
          />
        ))}
      </span>
      <span aria-hidden="true">{WORD[level]}</span>
    </span>
  );
}
