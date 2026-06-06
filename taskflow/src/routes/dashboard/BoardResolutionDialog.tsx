/**
 * BoardResolutionDialog — board-level resolution-picker dialog.
 *
 * Mirrors the structure of confirm-sprint-move-dialog.tsx (same Dialog primitives,
 * controlled open/onOpenChange, showCloseButton={false}) and the resolution-list
 * buttons from StatusPopover. Purely presentational: the parent owns the transition
 * execution; this component only collects the chosen resolution and forwards it via
 * onConfirm as `{ id }` (a real resolution) or `null` (Unresolved / clear).
 */

import { CheckIcon } from 'lucide-react';
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
      <DialogContent showCloseButton={false} className="max-h-[85vh] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set a resolution</DialogTitle>
          <DialogDescription>
            Moving <span className="font-mono font-medium text-foreground">{issueKey}</span> to{' '}
            <span className="font-medium text-foreground">{toStatusName}</span> closes it. Jira
            records <em>how</em> it was resolved as part of this move — pick a resolution to
            continue.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex max-h-[45vh] flex-col gap-0.5 overflow-y-auto px-1">
          {allowedValues.map((r) => {
            const active = selectedId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors',
                  active
                    ? 'border-primary bg-primary/10 font-medium'
                    : 'border-transparent hover:bg-accent',
                )}
              >
                <span>{r.name}</span>
                {active && <CheckIcon className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={selectedId === UNRESOLVED}
            onClick={() => setSelectedId(UNRESOLVED)}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-muted-foreground transition-colors',
              selectedId === UNRESOLVED
                ? 'border-primary bg-primary/10 font-medium text-foreground'
                : 'border-transparent hover:bg-accent',
            )}
          >
            <span>
              Unresolved
              <span className="ml-1.5 text-xs text-muted-foreground" aria-hidden="true">
                (leave without a resolution)
              </span>
            </span>
            {selectedId === UNRESOLVED && <CheckIcon className="size-4 shrink-0 text-primary" />}
          </button>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleConfirm} disabled={isPending || selectedId === null}>
            {isPending ? 'Setting…' : 'Confirm move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
