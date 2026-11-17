import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface TableGridPickerProps {
  max?: number;
  onPick: (rows: number, cols: number) => void;
}

/** Hover/keyboard grid for choosing a table size (rows x columns). */
export function TableGridPicker({ max = 6, onPick }: TableGridPickerProps) {
  const [hover, setHover] = useState<{ r: number; c: number }>({ r: 1, c: 1 });
  const cells = Array.from({ length: max * max }, (_, i) => ({
    r: Math.floor(i / max) + 1,
    c: (i % max) + 1,
  }));

  const onKeyDown = (e: React.KeyboardEvent) => {
    const clamp = (n: number) => Math.min(max, Math.max(1, n));
    if (e.key === 'ArrowRight') setHover((h) => ({ ...h, c: clamp(h.c + 1) }));
    else if (e.key === 'ArrowLeft') setHover((h) => ({ ...h, c: clamp(h.c - 1) }));
    else if (e.key === 'ArrowDown') setHover((h) => ({ ...h, r: clamp(h.r + 1) }));
    else if (e.key === 'ArrowUp') setHover((h) => ({ ...h, r: clamp(h.r - 1) }));
    else if (e.key === 'Enter') onPick(hover.r, hover.c);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="flex flex-col gap-2 p-1.5">
      <div
        role="grid"
        aria-label="Table size"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="grid gap-1 outline-none"
        style={{ gridTemplateColumns: `repeat(${max}, 1.25rem)` }}
      >
        {cells.map(({ r, c }) => (
          <button
            key={`${r}-${c}`}
            type="button"
            tabIndex={-1}
            aria-label={`${r} by ${c}`}
            onMouseEnter={() => setHover({ r, c })}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(r, c)}
            className={cn(
              'size-5 rounded-sm border',
              r <= hover.r && c <= hover.c ? 'border-primary bg-primary/20' : 'border-border',
            )}
          />
        ))}
      </div>
      <div className="text-center text-xs text-muted-foreground">
        {hover.r} × {hover.c}
      </div>
    </div>
  );
}
