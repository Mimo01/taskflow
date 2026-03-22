import { Badge } from '@/components/ui/badge';

/**
 * Check if an issue is overdue: has a due date in the past AND status is not "done".
 * Per D-09 and Pitfall 5 from research.
 */
export function isOverdue(duedate: string | null, statusCategoryKey?: string): boolean {
  if (!duedate) return false;
  if (statusCategoryKey === 'done') return false;
  const due = new Date(duedate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

interface OverdueBadgeProps {
  duedate: string | null;
  statusCategoryKey?: string;
}

export function OverdueBadge({ duedate, statusCategoryKey }: OverdueBadgeProps) {
  if (!isOverdue(duedate, statusCategoryKey)) return null;
  return (
    <Badge
      variant="destructive"
      className="bg-destructive/10 text-destructive text-xs"
      aria-label="Overdue"
    >
      Overdue
    </Badge>
  );
}
