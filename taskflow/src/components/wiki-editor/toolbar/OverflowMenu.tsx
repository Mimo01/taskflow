import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody } from '@/components/ui/tooltip-body';

export interface OverflowItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  pressed?: boolean;
  disabled?: boolean;
}

export interface OverflowMenuProps {
  items: readonly OverflowItem[];
}

/** "⋯" menu holding the toolbar items that no longer fit. Renders nothing when empty. */
export function OverflowMenu({ items }: OverflowMenuProps) {
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          delay={300}
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="More"
                  onMouseDown={(e) => e.preventDefault()}
                />
              }
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </TooltipTrigger>
        <TooltipContent>
          <TooltipBody>
            <span className="font-medium">More</span>
          </TooltipBody>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        {items.map((item) =>
          item.pressed === undefined ? (
            <DropdownMenuItem key={item.id} disabled={item.disabled} onClick={item.onSelect}>
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuCheckboxItem
              key={item.id}
              checked={item.pressed}
              disabled={item.disabled}
              onClick={item.onSelect}
            >
              {item.icon}
              {item.label}
            </DropdownMenuCheckboxItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
