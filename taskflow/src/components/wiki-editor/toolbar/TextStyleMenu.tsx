import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TEXT_STYLES, type TextStyleId } from '../text-style';

export interface TextStyleMenuProps {
  current: TextStyleId;
  onSelect: (id: TextStyleId) => void;
  disabled?: boolean;
}

/** "Normal text" dropdown: shows the current block style, switches Paragraph/Heading/Quote. */
export function TextStyleMenu({ current, onSelect, disabled }: TextStyleMenuProps) {
  const label = TEXT_STYLES.find((s) => s.id === current)?.label ?? 'Paragraph';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Text style"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            className="gap-1 text-xs"
          />
        }
      >
        {label}
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={current} onValueChange={(v) => onSelect(v as TextStyleId)}>
          {TEXT_STYLES.map((s) => (
            <DropdownMenuRadioItem key={s.id} value={s.id}>
              {s.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
