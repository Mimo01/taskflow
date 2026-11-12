import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SECTION_ACTION_BUTTON_CLASS, SECTION_ACTION_ICON_CLASS } from './SectionHeader';

/**
 * Epic Stories SectionHeader action: a single ghost xs "Add story" button, styled like
 * the Subtasks section's "Add subtask" (SubtaskCreateControl).
 */
export function EpicStoryCreateControl({ onAdd }: { onAdd: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className={SECTION_ACTION_BUTTON_CLASS}
      onClick={onAdd}
    >
      <Plus className={SECTION_ACTION_ICON_CLASS} />
      Add story
    </Button>
  );
}
