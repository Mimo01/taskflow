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

interface ConfirmSprintMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueKey: string;
  fromSprintName: string | null; // null means "Backlog"
  toSprintName: string;
  onConfirm: () => void;
  isPending?: boolean;
}

export function ConfirmSprintMoveDialog({
  open,
  onOpenChange,
  issueKey,
  fromSprintName,
  toSprintName,
  onConfirm,
  isPending,
}: ConfirmSprintMoveDialogProps) {
  const from = fromSprintName ?? 'Backlog';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Move Issue</DialogTitle>
          <DialogDescription>
            Move <span className="font-mono font-medium text-foreground">{issueKey}</span> from{' '}
            <span className="font-medium text-foreground">{from}</span> to{' '}
            <span className="font-medium text-foreground">{toSprintName}</span>?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Moving...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
