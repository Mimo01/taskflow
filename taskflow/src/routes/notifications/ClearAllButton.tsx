/**
 * ClearAllButton — macOS Notification Center style "clear all" with an inline confirmation.
 *
 * Idle: a small round ✕. First click expands it in place into a "Clear all" pill (no dialog);
 * a second click confirms. It reverts to the ✕ on Escape, when focus/pointer leaves it, or after
 * CLEAR_ALL_REVERT_MS of no action. Keyboard: Enter/Space on the ✕ arms it, again confirms.
 */

import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

export const CLEAR_ALL_REVERT_MS = 3000;

interface ClearAllButtonProps {
  onConfirm: () => void;
  disabled?: boolean;
}

export default function ClearAllButton({ onConfirm, disabled }: ClearAllButtonProps) {
  const [armed, setArmed] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  // Auto-revert when left armed.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), CLEAR_ALL_REVERT_MS);
    return () => clearTimeout(t);
  }, [armed]);

  // Clicking anywhere else disarms (capture, so it runs before other handlers).
  useEffect(() => {
    if (!armed) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setArmed(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [armed]);

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      data-armed={armed ? 'true' : undefined}
      aria-label={armed ? 'Confirm: clear all notifications' : 'Clear all notifications'}
      title={armed ? undefined : 'Clear all'}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && armed) {
          // Disarm only; do not let Escape also close the panel.
          e.stopPropagation();
          e.preventDefault();
          setArmed(false);
        }
      }}
      onBlur={() => setArmed(false)}
      className={cn(
        'inline-flex h-6 flex-none cursor-pointer items-center justify-center overflow-hidden rounded-full text-xs font-medium whitespace-nowrap',
        'transition-[max-width,background-color,color,padding] duration-200 ease-(--ease-out)',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
        armed
          ? 'max-w-[7rem] gap-1 bg-foreground px-2.5 text-background'
          : 'max-w-6 w-6 bg-muted text-muted-foreground hover:bg-foreground/10 hover:text-foreground',
      )}
    >
      <X aria-hidden="true" className="size-3.5 flex-none" />
      <span
        data-clear-label
        className={cn(
          'transition-opacity duration-150',
          armed ? 'opacity-100' : 'sr-only opacity-0',
        )}
      >
        Clear all
      </span>
    </button>
  );
}
