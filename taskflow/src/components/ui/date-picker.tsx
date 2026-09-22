import { CalendarIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { parseLocalDate, toLocalDateString } from '@/lib/local-date';
import { cn } from '@/lib/utils';

const DISPLAY = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

type DatePickerProps = {
  value: string | null | undefined;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'default';
  clearable?: boolean;
  minDate?: string;
  maxDate?: string;
  'aria-label'?: string;
};

function buildDisabledMatcher(minDate?: string, maxDate?: string) {
  const before = parseLocalDate(minDate);
  const after = parseLocalDate(maxDate);
  const matchers = [];
  if (before) matchers.push({ before });
  if (after) matchers.push({ after });
  return matchers.length > 0 ? matchers : undefined;
}

function DatePicker({
  value,
  onChange,
  id,
  disabled,
  placeholder = 'Pick a date',
  className,
  size = 'default',
  clearable,
  minDate,
  maxDate,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseLocalDate(value);

  return (
    <div className="relative flex items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          disabled={disabled}
          aria-label={ariaLabel}
          data-slot="date-picker-trigger"
          className={cn(
            buttonVariants({ variant: 'outline', size }),
            'w-full min-w-0 justify-start font-normal',
            !selected && 'text-muted-foreground',
            clearable && selected && 'pr-7',
            className,
          )}
        >
          <CalendarIcon />
          {selected ? DISPLAY.format(selected) : placeholder}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" initialFocus={false}>
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            autoFocus
            disabled={buildDisabledMatcher(minDate, maxDate)}
            startMonth={parseLocalDate(minDate)}
            endMonth={parseLocalDate(maxDate)}
            onSelect={(d) => {
              if (!d) {
                if (clearable) onChange('');
                setOpen(false);
                return;
              }
              onChange(toLocalDateString(d));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {clearable && selected && !disabled && (
        <button
          type="button"
          aria-label="Clear date"
          data-slot="date-picker-clear"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export type { DatePickerProps };
export { DatePicker };
