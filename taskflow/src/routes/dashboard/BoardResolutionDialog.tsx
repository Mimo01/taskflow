/**
 * BoardResolutionDialog — board-level resolution-picker dialog.
 *
 * Mirrors the structure of confirm-sprint-move-dialog.tsx (same Dialog primitives,
 * controlled open/onOpenChange, showCloseButton={false}) and the resolution-list
 * buttons from StatusPopover. Purely presentational: the parent owns the transition
 * execution; this component only collects the chosen resolution and forwards it via
 * onConfirm as `{ id }` (a real resolution) or `null` (Unresolved / clear).
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface BoardResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueKey: string;
  /** Transition target status name, for the description text. */
  toStatusName: string;
  /** Resolution options from the matching transition's fields.resolution.allowedValues. */
  allowedValues: Array<{ id: string; name: string }>;
  /** Called with `{ id }` for a real resolution or `null` for Unresolved. */
  onConfirm: (resolution: { id: string } | null) => void;
  isPending?: boolean;
}

// Sentinel for the explicit "Unresolved" option (maps to a null resolution payload).
const UNRESOLVED = '__unresolved__';

export function BoardResolutionDialog({
  open,
  onOpenChange,
  issueKey,
  toStatusName,
  allowedValues,
  onConfirm,
  isPending,
}: BoardResolutionDialogProps) {
  // Locally-selected resolution id (or the UNRESOLVED sentinel). null = nothing picked yet.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // CR-02: defense-in-depth alongside the parent's `key={issueKey}` remount —
  // reset the selection whenever the target issue or its allowed values change so
  // a selection made for one issue can never be applied to another if this
  // instance is ever reused without remounting.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is intentionally keyed to issue/allowed-values identity, not selectedId.
  useEffect(() => {
    setSelectedId(null);
  }, [issueKey, allowedValues]);

  function handleConfirm() {
    if (selectedId === null) return;
    onConfirm(selectedId === UNRESOLVED ? null : { id: selectedId });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Set Resolution</DialogTitle>
          <DialogDescription>
            Move <span className="font-mono font-medium text-foreground">{issueKey}</span> to{' '}
            <span className="font-medium text-foreground">{toStatusName}</span>. Choose a
            resolution:
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-0.5">
          {allowedValues.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className={cn(
                'w-full text-left px-2 py-1.5 hover:bg-accent rounded',
                selectedId === r.id && 'bg-accent font-medium',
              )}
            >
              {r.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedId(UNRESOLVED)}
            className={cn(
              'w-full text-left px-2 py-1.5 hover:bg-accent rounded text-muted-foreground',
              selectedId === UNRESOLVED && 'bg-accent font-medium',
            )}
          >
            Unresolved
          </button>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleConfirm} disabled={isPending || selectedId === null}>
            {isPending ? 'Setting...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
