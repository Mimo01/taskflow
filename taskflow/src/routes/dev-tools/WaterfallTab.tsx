/**
 * WaterfallTab -- Per-operation scoped timeline visualization for profiled operations.
 *
 * Each operation row renders its own 0-to-wallClockMs timeline so bars fill
 * their lane fully, avoiding the "invisible sliver" problem of a single
 * global timeline.
 */
import { useState } from 'react';
import { useOperationProfilerStore } from '../../stores/operation-profiler.store';
import { useSettingsStore } from '../../stores/settings.store';
import { sourceBadgeClass } from './utils';
import WaterfallBar from './WaterfallBar';

type SourceFilter = 'all' | 'jira' | 'gitlab';
type SortMode = 'newest' | 'slowest';

export default function WaterfallTab() {
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);
  const performanceWaterfall = useSettingsStore((s) => s.performanceWaterfall);
  const operations = useOperationProfilerStore((s) => s.operations);

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

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

  // Filter by dominant source of each operation's fetches
  const filtered = operations.filter((op) => {
    if (sourceFilter === 'all') return true;
    const sources = op.fetches.map((f) => f.source);
    const jiraCount = sources.filter((s) => s === 'jira').length;
    const gitlabCount = sources.filter((s) => s === 'gitlab').length;
    const dominant = jiraCount >= gitlabCount ? 'jira' : 'gitlab';
    return dominant === sourceFilter;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'newest') {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
    return b.wallClockMs - a.wallClockMs;
  });

  return (
    <div className="flex flex-col gap-2">
      {/* Controls row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Source filters */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSourceFilter('all')}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              sourceFilter === 'all'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('jira')}
            className={
              sourceFilter === 'jira'
                ? sourceBadgeClass('jira')
                : 'rounded px-1.5 py-0.5 text-xs font-semibold uppercase text-muted-foreground hover:bg-accent/50'
            }
          >
            Jira
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('gitlab')}
            className={
              sourceFilter === 'gitlab'
                ? sourceBadgeClass('gitlab')
                : 'rounded px-1.5 py-0.5 text-xs font-semibold uppercase text-muted-foreground hover:bg-accent/50'
            }
          >
            GitLab
          </button>
        </div>

        <span className="text-muted-foreground text-xs">|</span>

        {/* Sort toggle */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSortMode('newest')}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              sortMode === 'newest'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50'
            }`}
          >
            Newest
          </button>
          <button
            type="button"
            onClick={() => setSortMode('slowest')}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              sortMode === 'slowest'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50'
            }`}
          >
            Slowest
          </button>
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {sorted.length} operation{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Column header */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <span className="w-[200px] shrink-0 text-xs font-medium text-muted-foreground">
          Operation
        </span>
        <span className="flex-1 text-xs font-medium text-muted-foreground">Timeline</span>
      </div>

      {/* Operation rows -- each self-scoped */}
      {sorted.map((operation) => (
        <WaterfallBar key={operation.id} operation={operation} />
      ))}
    </div>
  );
}
