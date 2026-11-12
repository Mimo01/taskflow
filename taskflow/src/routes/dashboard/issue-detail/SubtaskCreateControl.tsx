import { LayoutList, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SECTION_ACTION_BUTTON_CLASS, SECTION_ACTION_ICON_CLASS } from './SectionHeader';

/**
 * Subtask create actions for the Subtasks SectionHeader: two separate ghost xs buttons
 * ("Bulk create", "Add subtask"), same style as Attachments' "Attach file".
 * Parent SectionHeader supplies the gap-2 between them.
 */
export function SubtaskCreateControl({ onAdd, onBulk }: { onAdd: () => void; onBulk: () => void }) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className={SECTION_ACTION_BUTTON_CLASS}
        onClick={onBulk}
      >
        <LayoutList className={SECTION_ACTION_ICON_CLASS} />
        Bulk create
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className={SECTION_ACTION_BUTTON_CLASS}
        onClick={onAdd}
      >
        <Plus className={SECTION_ACTION_ICON_CLASS} />
        Add subtask
      </Button>
    </>
  );
}
