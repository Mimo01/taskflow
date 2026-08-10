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

interface CreateBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchName: string;
  defaultBranch: string;
  onConfirm: () => void;
  isPending?: boolean;
  errorMessage?: string | null;
}

export function CreateBranchDialog({
  open,
  onOpenChange,
  branchName,
  defaultBranch,
  onConfirm,
  isPending,
  errorMessage,
}: CreateBranchDialogProps) {
  // WR-03: inline dialog text is the ONLY error surface for this write
  // (D-15 forbids toasts), so dismissing mid-flight — via Cancel, Escape or
  // the backdrop — would report a subsequent 403/500 nowhere, and a
  // succeeded write would appear with no acknowledgement. Guard the single
  // choke point Dialog exposes for all three dismissal paths.
  function handleOpenChange(nextOpen: boolean, ...rest: unknown[]) {
    if (isPending) return;
    onOpenChange(nextOpen, ...(rest as []));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Create release branch</DialogTitle>
          <DialogDescription>
            Create <code className="font-mono font-medium text-foreground">{branchName}</code> off{' '}
            <span className="font-medium text-foreground">{defaultBranch}</span>?
          </DialogDescription>
        </DialogHeader>
        {errorMessage && (
          <p className="text-xs text-destructive">Couldn't create branch: {errorMessage}</p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>
            Cancel
          </DialogClose>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Creating…' : 'Create branch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
