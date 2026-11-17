import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { InsertItem } from '../insert-items';
import { TableGridPicker } from './TableGridPicker';

export interface InsertMenuProps {
  items: readonly InsertItem[];
  onInsert: (item: InsertItem, opts?: { rows: number; cols: number }) => void;
  disabled?: boolean;
}

/** "+ Insert" dropdown over the shared INSERT_ITEMS list; Table opens a size grid. */
export function InsertMenu({ items, onInsert, disabled }: InsertMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="Insert"
            aria-label="Insert"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            className="gap-1 text-xs"
          />
        }
      >
        <Plus className="size-4" />
        Insert
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map((item) => {
          const Icon = item.icon;
          if (item.id === 'table') {
            return (
              <DropdownMenuSub key={item.id}>
                <DropdownMenuSubTrigger>
                  <Icon />
                  {item.label}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <TableGridPicker onPick={(rows, cols) => onInsert(item, { rows, cols })} />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          }
          return (
            <DropdownMenuItem key={item.id} onClick={() => onInsert(item)}>
              <Icon />
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
