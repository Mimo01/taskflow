/**
 * DevToolsSettingsPopover — header gear popover holding the master toggle, request logging,
 * response body capture and the retention limit.
 */
import { Settings2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { useSettingsStore } from '../../stores/settings.store';

const RETENTION_OPTIONS = ['50', '100', '200', '500', '1000'] as const;
const RETENTION_ITEMS = RETENTION_OPTIONS.map((o) => ({ value: o, label: o }));

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function DevToolsSettingsPopover() {
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);
  const setDevToolsEnabled = useSettingsStore((s) => s.setDevToolsEnabled);
  const requestLogging = useSettingsStore((s) => s.requestLogging);
  const setRequestLogging = useSettingsStore((s) => s.setRequestLogging);
  const responseBodyCapture = useSettingsStore((s) => s.responseBodyCapture);
  const setResponseBodyCapture = useSettingsStore((s) => s.setResponseBodyCapture);
  const retentionLimit = useSettingsStore((s) => s.retentionLimit);
  const setRetentionLimit = useSettingsStore((s) => s.setRetentionLimit);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Developer Tools settings"
          />
        }
      >
        <Settings2 />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-3">
          <ToggleRow
            label="Developer Tools"
            description="Capture API requests and desktop notifications."
            checked={devToolsEnabled}
            onChange={setDevToolsEnabled}
          />
          <ToggleRow
            label="Request logging"
            description="Record each API call in Logs."
            checked={requestLogging}
            onChange={setRequestLogging}
            disabled={!devToolsEnabled}
          />
          <ToggleRow
            label="Response body capture"
            description="Keep response bodies (uses more memory)."
            checked={responseBodyCapture}
            onChange={setResponseBodyCapture}
            disabled={!devToolsEnabled}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Retention limit</p>
            <Select
              value={retentionLimit.toString()}
              onValueChange={(val) => setRetentionLimit(Number(val))}
              items={RETENTION_ITEMS}
            >
              <SelectTrigger aria-label="Retention limit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETENTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Applies to new entries.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
