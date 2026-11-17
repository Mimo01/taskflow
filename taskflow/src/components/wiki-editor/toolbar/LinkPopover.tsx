import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { openExternal } from '@/lib/openExternal';
import { normalizeLinkUrl } from '../link-url';

export interface LinkPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement;
  currentUrl: string | null;
  onApply: (url: string) => void;
  onRemove: () => void;
}

const ERROR_COPY = 'Enter an http(s) or mailto link.';

/** Link popover: URL entry with allowlist validation, plus open/remove for an existing link. */
export function LinkPopover({
  open,
  onOpenChange,
  trigger,
  currentUrl,
  onApply,
  onRemove,
}: LinkPopoverProps) {
  const [value, setValue] = useState(currentUrl ?? '');
  const [error, setError] = useState(false);

  const submit = () => {
    if (normalizeLinkUrl(value) === null) {
      setError(true);
      return;
    }
    setError(false);
    onApply(value);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent className="flex w-72 flex-col gap-2 p-2" side="bottom" align="start">
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            aria-label="Link URL"
            placeholder="https://"
            value={value}
            aria-invalid={error}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button type="button" size="sm" onClick={submit}>
            Apply
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {ERROR_COPY}
          </p>
        ) : null}
        {currentUrl ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-muted-foreground" title={currentUrl}>
              {currentUrl}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => openExternal(currentUrl)}
            >
              Open
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-destructive"
              onClick={onRemove}
            >
              Remove link
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
