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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Creating…' : 'Create branch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
