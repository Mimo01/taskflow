import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StandupPageHeaderProps {
  /** Formatted date string for the yesterday date, e.g. "Monday, 26 May 2026" */
  dateLabel: string;
  /** Minutes since last successful data sync; null means never synced or unknown */
  syncedMinutesAgo: number | null;
  /** Called when the user clicks the Refresh button */
  onRefresh: () => void;
  /** Called when the user clicks the Copy markdown button */
  onCopyMarkdown: () => void;
  /** True for 2 seconds after a successful clipboard write */
  copied: boolean;
}

/**
 * StandupPageHeader
 *
 * Full-width page header for the Standup Notes route.
 *
 * Left side: page title "Standup notes" + muted yesterday date.
 * Right side: sync status ("• synced Nm ago"), Refresh (ghost), Copy markdown (primary).
 *
 * Per UI-SPEC D-11:
 * - Title is lowercase "notes" — "Standup notes"
 * - Copy markdown button uses the Lucide Copy icon to the left of the label
 * - Accent (primary) is reserved for the Copy markdown button only
 */
export default function StandupPageHeader({
  dateLabel,
  syncedMinutesAgo,
  onRefresh,
  onCopyMarkdown,
  copied,
}: StandupPageHeaderProps) {
  return (
    <header className="px-6 py-4 border-b border-border flex items-center justify-between">
      {/* Left: title + date */}
      <div>
        <h1 className="text-2xl font-semibold">Standup notes</h1>
        <p className="text-xs text-muted-foreground">{dateLabel}</p>
      </div>

      {/* Right: sync status + Refresh + Copy markdown */}
      <div className="flex items-center gap-2">
        {syncedMinutesAgo !== null && (
          <span className="text-xs text-muted-foreground">• synced {syncedMinutesAgo}m ago</span>
        )}
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
        <Button variant="default" size="sm" onClick={onCopyMarkdown}>
          <Copy />
          {copied ? 'Copied!' : 'Copy markdown'}
        </Button>
      </div>
    </header>
  );
}
