import { LayoutList, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Subtask create actions for the Subtasks SectionHeader: two separate outline buttons
 * ("Bulk create", "Add subtask"), same style as Attachments' "Attach file".
 * Parent SectionHeader supplies the gap-2 between them.
 */
export function SubtaskCreateControl({ onAdd, onBulk }: { onAdd: () => void; onBulk: () => void }) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={onBulk}
      >
        <LayoutList className="size-3.5" />
        Bulk create
      </Button>
      <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onAdd}>
        <Plus className="size-3.5" />
        Add subtask
      </Button>
    </>
  );
}
