/**
 * OperationsTab — Grouped operation cards with expandable fetch breakdowns.
 *
 * Displays profiled operations (newest first) as OperationCard components,
 * plus an ungrouped requests section at the bottom.
 */
import { useOperationProfilerStore } from '../../stores/operation-profiler.store';
import { useSettingsStore } from '../../stores/settings.store';
import OperationCard from './OperationCard';
import { sourceBadgeClass, statusColor } from './utils';

export default function OperationsTab() {
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);
  const operationProfiling = useSettingsStore((s) => s.operationProfiling);
  const operations = useOperationProfilerStore((s) => s.operations);
  const ungrouped = useOperationProfilerStore((s) => s.ungrouped);

  if (!devToolsEnabled) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Developer Tools are disabled. Toggle the master switch in Settings to start capturing data.
      </p>
    );
  }

  if (!operationProfiling || (operations.length === 0 && ungrouped.length === 0)) {
    return (
      <div className="text-center py-8">
        <p className="text-sm font-medium">No operations recorded</p>
        <p className="text-sm text-muted-foreground mt-1">
          Enable operation profiling in Settings above, then trigger an action like loading a board
          or searching issues.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {operations.map((operation) => (
        <OperationCard key={operation.id} operation={operation} />
      ))}

      {ungrouped.length > 0 && (
        <details className="border border-border rounded-lg overflow-hidden">
          <summary className="px-4 py-3 density-compact:py-1.5 density-comfortable:py-4 text-sm font-medium cursor-pointer hover:bg-accent transition-colors">
            Ungrouped Requests ({ungrouped.length})
          </summary>
          <div className="border-t border-border px-4 py-2 density-compact:py-1 density-comfortable:py-3 flex flex-col gap-1">
            {ungrouped.map((fetch) => (
              <div
                key={fetch.id}
                className="flex items-center gap-3 text-xs font-mono py-1 density-compact:py-0.5 density-comfortable:py-2"
              >
                <span className={sourceBadgeClass(fetch.source)}>{fetch.source}</span>
                <span className="font-semibold shrink-0">{fetch.method}</span>
                <span className={`shrink-0 ${statusColor(fetch.status)}`}>
                  {fetch.status ?? 'ERR'}
                </span>
                <span className="truncate flex-1 text-muted-foreground">{fetch.url}</span>
                <span className="shrink-0">{fetch.durationMs}ms</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
