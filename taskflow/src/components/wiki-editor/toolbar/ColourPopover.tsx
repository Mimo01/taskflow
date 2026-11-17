import { cloneElement } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { isSafeColor } from '@/lib/wiki/editor/parse/color';
import { TEXT_PALETTE } from '../palette';

export interface ColourPopoverProps {
  current: string | null;
  onPick: (value: string) => void;
  onRemove: () => void;
  trigger: React.ReactElement;
  disabled?: boolean;
}

/** Palette popover. Off-palette colours are kept as-is and shown as a disabled "Custom (kept)" swatch. */
export function ColourPopover({
  current,
  onPick,
  onRemove,
  trigger,
  disabled,
}: ColourPopoverProps) {
  const safeCurrent = current !== null && isSafeColor(current) ? current : null;
  const inPalette = safeCurrent !== null && TEXT_PALETTE.some((p) => p.value === safeCurrent);
  const custom = safeCurrent !== null && !inPalette;

  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        render={(props) => (
          <span className="relative inline-flex">
            {cloneElement(trigger, props)}
            <ColourBar current={current} />
          </span>
        )}
      />
      <PopoverContent className="w-auto p-2" initialFocus={false} side="bottom" align="start">
        <div className="grid grid-cols-8 gap-1">
          {TEXT_PALETTE.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-label={p.name}
              title={p.name}
              style={{ backgroundColor: p.value }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(p.value)}
              className={cn(
                'size-5 rounded border border-border',
                p.value === safeCurrent && 'ring-2 ring-ring',
              )}
            />
          ))}
        </div>
        {custom ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <button
              type="button"
              disabled
              aria-label="Custom (kept)"
              style={{ backgroundColor: safeCurrent }}
              className="size-5 rounded border border-border ring-2 ring-ring"
            />
            <span>Custom (kept)</span>
          </div>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="mt-2 w-full"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onRemove}
        >
          Remove colour
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/** 12px underline bar for the trigger showing the active colour (safe values only). */
export function ColourBar({ current }: { current: string | null }) {
  if (current === null || !isSafeColor(current)) return null;
  return (
    <span
      aria-hidden="true"
      data-testid="colour-bar"
      className="pointer-events-none absolute bottom-1 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full"
      style={{ backgroundColor: current }}
    />
  );
}
