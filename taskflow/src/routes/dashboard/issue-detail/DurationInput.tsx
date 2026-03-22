/**
 * DurationInput -- Natural language duration input with clock picker fallback.
 *
 * Accepts Jira-style durations like "2h 30m", "1d 4h", "45m".
 * Clock icon opens a numeric picker popover for hours and minutes.
 */
import { Clock } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DurationInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  autoFocus?: boolean;
}

export function DurationInput({ value, onChange, error, autoFocus }: DurationInputProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerHours, setPickerHours] = useState(0);
  const [pickerMinutes, setPickerMinutes] = useState(0);

  function applyPicker() {
    const parts: string[] = [];
    if (pickerHours > 0) parts.push(`${pickerHours}h`);
    if (pickerMinutes > 0) parts.push(`${pickerMinutes}m`);
    if (parts.length > 0) {
      onChange(parts.join(' '));
    }
    setPickerOpen(false);
  }

  return (
    <div>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. 2h 30m"
          autoFocus={autoFocus}
          className="pr-8"
        />
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Open time picker"
          >
            <Clock className="size-4" />
          </PopoverTrigger>
          <PopoverContent className="w-48 p-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-12">Hours</label>
                <Input
                  type="number"
                  min={0}
                  max={99}
                  value={pickerHours}
                  onChange={(e) => setPickerHours(Math.min(99, Math.max(0, Number(e.target.value))))}
                  className="h-7 text-xs w-16"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-12">Minutes</label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={pickerMinutes}
                  onChange={(e) => setPickerMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
                  className="h-7 text-xs w-16"
                />
              </div>
              <button
                type="button"
                onClick={applyPicker}
                className="w-full text-xs text-center py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Apply
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {error && (
        <p className="text-xs text-destructive mt-1">
          Couldn't parse duration. Use formats like 2h, 30m, or 1d 4h.
        </p>
      )}
    </div>
  );
}
