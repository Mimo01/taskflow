import { Keycap } from '@/components/ui/keycap';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody } from '@/components/ui/tooltip-body';
import { cn } from '@/lib/utils';
import { TOOLBAR_PRESSED_CLASS } from './ToolbarButton';

type Mode = 'rich' | 'source';

export interface ModeToggleProps {
  mode: Mode;
  onChange: (m: Mode) => void;
  /** Rich is unavailable (SAFE-05 forced source). */
  richDisabled?: boolean;
}

const DISABLED_COPY = "This text can't be edited in rich view without risking its formatting.";

interface SegmentProps {
  label: string;
  target: Mode;
  active: boolean;
  disabled?: boolean;
  tip: string;
  onSelect: (m: Mode) => void;
}

function Segment({ label, target, active, disabled, tip, onSelect }: SegmentProps) {
  const button = (
    // biome-ignore lint/a11y/useSemanticElements: styled segmented button inside a radiogroup
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (!active) onSelect(target);
      }}
      className={cn(
        'h-6 rounded-sm px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? cn(TOOLBAR_PRESSED_CLASS, 'font-semibold')
          : 'text-muted-foreground hover:text-foreground',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {label}
    </button>
  );
  return (
    <Tooltip>
      <TooltipTrigger
        delay={300}
        // A disabled button fires no pointer events, so the span carries the tooltip.
        render={<span className="inline-flex" />}
      >
        {button}
      </TooltipTrigger>
      <TooltipContent>
        <TooltipBody>
          {disabled ? (
            <span>{DISABLED_COPY}</span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium">{tip}</span>
              <span className="flex items-center gap-1">
                <Keycap>⌘</Keycap>
                <Keycap>⇧</Keycap>
                <Keycap>M</Keycap>
              </span>
            </div>
          )}
        </TooltipBody>
      </TooltipContent>
    </Tooltip>
  );
}

/** Rich | Source segmented control. Never shrinks or moves into the overflow (D-02). */
export function ModeToggle({ mode, onChange, richDisabled }: ModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Editor mode"
      className="flex flex-none items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5"
    >
      <Segment
        label="Rich"
        target="rich"
        active={mode === 'rich'}
        disabled={richDisabled}
        tip="Switch to rich"
        onSelect={onChange}
      />
      <Segment
        label="Source"
        target="source"
        active={mode === 'source'}
        tip="Switch to source"
        onSelect={onChange}
      />
    </div>
  );
}
