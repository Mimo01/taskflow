import { Button } from '@/components/ui/button';
import { Keycap } from '@/components/ui/keycap';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody } from '@/components/ui/tooltip-body';
import { cn } from '@/lib/utils';

export interface ToolbarButtonProps {
  label: string;
  /** Individual keycaps shown in the tooltip, e.g. ['⌘', 'B']. */
  keys?: string[];
  icon: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Pressed (toggled-on) look. `--accent` equals `--muted` in this theme, so the
 * old `bg-accent` matched the ghost hover; a foreground-alpha fill + hairline
 * inset ring stays colourless yet clearly reads as "on" in both themes.
 */
export const TOOLBAR_PRESSED_CLASS =
  'bg-foreground/10 text-foreground ring-1 ring-inset ring-foreground/15 hover:bg-foreground/15 dark:bg-foreground/15 dark:hover:bg-foreground/20';

/** Props injected by a wrapping Popover/Menu trigger are forwarded onto the button. */
type TriggerProps = Omit<React.ComponentProps<'button'>, keyof ToolbarButtonProps>;

/** Icon button for the editor toolbar: tooltip with label + keycaps, keeps editor focus. */
export function ToolbarButton({
  label,
  keys,
  icon,
  onClick,
  pressed,
  disabled,
  className,
  children,
  ...rest
}: ToolbarButtonProps & TriggerProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={300}
        render={
          <Button
            {...rest}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={pressed}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className={cn(pressed && TOOLBAR_PRESSED_CLASS, className)}
          />
        }
      >
        {icon}
        {children}
      </TooltipTrigger>
      <TooltipContent>
        <TooltipBody fit>
          <div className="flex items-center gap-2">
            <span className="font-medium">{label}</span>
            {keys && keys.length > 0 ? (
              <span className="flex items-center gap-1">
                {keys.map((k, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static key list, no reorder
                  <Keycap key={i}>{k}</Keycap>
                ))}
              </span>
            ) : null}
          </div>
        </TooltipBody>
      </TooltipContent>
    </Tooltip>
  );
}
