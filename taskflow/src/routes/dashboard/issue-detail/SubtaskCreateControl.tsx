import { ChevronDown, LayoutList, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Split create control for the Subtasks heading row: primary "Add subtask" plus a chevron
 * menu holding "Bulk create subtasks…". Isolated so swapping to two plain buttons is a
 * one-file change.
 */
export function SubtaskCreateControl({ onAdd, onBulk }: { onAdd: () => void; onBulk: () => void }) {
  return (
    <div className="inline-flex items-stretch">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 rounded-r-none border-r-0 text-xs"
        onClick={onAdd}
      >
        <Plus className="size-3.5" />
        Add subtask
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="rounded-l-none"
              aria-label="More subtask actions"
              title="More subtask actions"
            />
          }
        >
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="cursor-pointer text-xs" onClick={onBulk}>
            <LayoutList className="size-3.5" />
            Bulk create subtasks…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
