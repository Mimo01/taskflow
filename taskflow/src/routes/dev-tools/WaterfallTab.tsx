/**
 * WaterfallTab — CSS-bar timeline visualization for profiled operations.
 *
 * Shows operation bars positioned by percentage within the overall timeline,
 * expandable to nested fetch bars colored by source.
 */
import { useOperationProfilerStore } from '../../stores/operation-profiler.store';
import { useSettingsStore } from '../../stores/settings.store';
import WaterfallBar from './WaterfallBar';

export default function WaterfallTab() {
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);
  const performanceWaterfall = useSettingsStore((s) => s.performanceWaterfall);
  const operations = useOperationProfilerStore((s) => s.operations);

  if (!devToolsEnabled) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Developer Tools are disabled. Toggle the master switch in Settings to start capturing data.
      </p>
    );
  }

  if (!performanceWaterfall || operations.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm font-medium">No waterfall data</p>
        <p className="text-sm text-muted-foreground mt-1">
          Enable performance waterfall in Settings above, then perform some actions to see timing
          data.
        </p>
      </div>
    );
  }

  const timelineStart = Math.min(...operations.map((o) => o.startTime));
  const timelineEnd = Math.max(...operations.map((o) => o.endTime));
  const totalDuration = timelineEnd - timelineStart;

  const midpointMs = Math.round(totalDuration / 2);

  return (
    <div className="flex flex-col gap-1">
      {/* Time axis header */}
      <div className="flex items-center gap-2">
        <span className="w-[200px] shrink-0" />
        <div className="flex-1 flex justify-between text-xs text-muted-foreground font-mono px-1">
          <span>0ms</span>
          {totalDuration > 0 && <span>{midpointMs}ms</span>}
          <span>{Math.round(totalDuration)}ms</span>
        </div>
        {/* Spacer for chevron column */}
        <span className="shrink-0 w-4" />
      </div>

      {/* Operation rows */}
      {operations.map((operation) => (
        <WaterfallBar
          key={operation.id}
          operation={operation}
          timelineStart={timelineStart}
          totalDuration={totalDuration}
        />
      ))}
    </div>
  );
}
