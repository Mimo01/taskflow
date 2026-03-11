/**
 * StaleMrThresholdSection — Settings section for configuring the stale MR threshold.
 *
 * Allows the developer to choose how many days without updates before an MR is
 * flagged as stale in the MR Attention tab. Options: 1/2/3/5/7 days.
 *
 * Bound to setStaleMrThresholdDays in settings store — persists automatically
 * via the Tauri Store persist middleware.
 */
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../components/ui/select'
import { useSettingsStore } from '../../stores/settings.store'

const THRESHOLD_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1 day' },
  { value: '2', label: '2 days' },
  { value: '3', label: '3 days' },
  { value: '5', label: '5 days' },
  { value: '7', label: '7 days' },
]

export default function StaleMrThresholdSection() {
  const { staleMrThresholdDays, setStaleMrThresholdDays } = useSettingsStore()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold">MR Attention</h3>
        <p className="text-sm text-muted-foreground">
          Flag MRs as stale after the selected number of days without an update.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Flag MRs as stale after</span>
        <Select
          value={String(staleMrThresholdDays)}
          onValueChange={(v) => setStaleMrThresholdDays(Number(v))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THRESHOLD_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
