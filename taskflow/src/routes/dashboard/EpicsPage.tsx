/**
 * EpicsPage — Full-page /epics route component.
 *
 * Loads basic epic data (key, name, status, priority, assignee) via
 * fetchEpicsBasic for a fast first paint, ordered `created ASC`. Story
 * progress and points stream in behind first paint from a second
 * progressive-enrichment query.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PriorityIcon } from '@/components/ui/priority-icon';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { epicColorToTailwind } from '@/lib/epicColors';
import { statusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { EpicEnriched } from '@/services/jira';
import { fetchEpicsBasic } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { CreateEpicDialog } from './CreateEpicDialog';
import type { EnrichmentCellState } from './EpicProgressCells';
import { EpicPointsCell, EpicProgressCell } from './EpicProgressCells';
import { EpicsSkeleton } from './EpicsSkeleton';

// ── EpicRow ───────────────────────────────────────────────────────────────────

const CELL_PADDING = 'py-2 density-compact:py-1 density-comfortable:py-3';

interface EpicRowProps {
  epic: EpicEnriched;
  onEpicClick?: (key: string) => void;
  enrichment: EnrichmentCellState;
  onRetryEnrichment: () => void;
}

function EpicRow({ epic, onEpicClick, enrichment, onRetryEnrichment }: EpicRowProps) {
  const colorResult = epicColorToTailwind(epic.color ?? null, epic.key);

  return (
    <div
      className="flex w-full items-center border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => onEpicClick?.(epic.key)}
    >
      {/* Key */}
      <div className={cn('flex-none w-24 pl-4 pr-2 whitespace-nowrap', CELL_PADDING)}>
        <span className="font-mono text-xs text-muted-foreground">{epic.key}</span>
      </div>

      {/* Epic name — sole colour carrier (D-09); the ONE flex-1 min-w-0 cell */}
      <div className={cn('flex-1 min-w-0 px-2 overflow-hidden', CELL_PADDING)}>
        <span
          className={cn(
            'inline-flex min-w-0 max-w-full items-center rounded border px-1.5 py-0.5 text-xs font-normal',
            colorResult.className,
          )}
          style={colorResult.style}
          title={epic.epicName}
        >
          <span className="truncate">{epic.epicName}</span>
        </span>
      </div>

      {/* Status badge — flex wrapper so the shared pill's min-w/text-center
          take effect (statusPillClass assumes a flex-item context). */}
      <div className={cn('flex-none w-28 px-2 whitespace-nowrap', CELL_PADDING)}>
        <div className="flex">
          <span className={statusPillClass(epic.status.statusCategory?.key)}>
            {epic.status.name}
          </span>
        </div>
      </div>

      {/* Priority — icon only, name carried in title/alt (D-10) */}
      <div className={cn('flex-none w-8 px-2 whitespace-nowrap', CELL_PADDING)}>
        <span
          className="flex items-center justify-center"
          style={{ width: 18, height: 18 }}
          aria-hidden={!epic.priority}
        >
          <PriorityIcon priority={epic.priority} />
        </span>
      </div>

      {/* Progress — segmented Done/In-Progress/To-Do bar + done/total (D-11) */}
      <div className={cn('flex-none w-32 px-2 whitespace-nowrap', CELL_PADDING)}>
        <EpicProgressCell state={enrichment} onRetry={onRetryEnrichment} />
      </div>

      {/* Points — done/total SP (D-13) */}
      <div className={cn('flex-none w-20 px-2 text-right whitespace-nowrap', CELL_PADDING)}>
        <EpicPointsCell state={enrichment} onRetry={onRetryEnrichment} />
      </div>

      {/* Assignee */}
      <div className={cn('flex-none w-10 pl-2 pr-4 whitespace-nowrap', CELL_PADDING)}>
        <CachedAvatar
          url={epic.assignee?.avatarUrls?.['48x48'] || null}
          name={epic.assignee?.displayName || 'Unassigned'}
          size={24}
        />
      </div>
    </div>
  );
}

// ── EpicsPage ─────────────────────────────────────────────────────────────────

export default function EpicsPage() {
  const ctx =
    useOutletContext<{ onEpicClick?: (key: string) => void; [key: string]: unknown }>() ?? {};
  const onEpicClick = ctx.onEpicClick;

  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const { epicNameFieldKey, epicColorFieldKey } = useSettingsStore();

  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    readSecret('jira-pat')
      .then(setToken)
      .catch(() => setToken(null));
  }, []);

  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: epicsData,
    isLoading,
    isError,
    error,
  } = useQuery<EpicEnriched[]>({
    queryKey: ['jira-epics-basic', activeJiraProject, jiraBaseUrl],
    queryFn: () =>
      fetchEpicsBasic(
        jiraBaseUrl ?? '',
        token ?? '',
        activeJiraProject ?? '',
        epicNameFieldKey ?? undefined,
        epicColorFieldKey ?? undefined,
      ),
    enabled: !!jiraBaseUrl && !!token && !!activeJiraProject,
  });
  const epics = epicsData ?? [];

  const showSkeleton = useDelayedLoading(isLoading) || isRefreshing;

  useEffect(() => {
    if (!isLoading) setIsRefreshing(false);
  }, [isLoading]);

  // Reset banner dismissal when error state changes
  useEffect(() => {
    setBannerDismissed(false);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <h1 className="text-xl font-semibold">Epics</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          + Create Epic
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Error state -- full error when no cached data */}
        {isError && !epicsData && (
          <div className="p-4">
            <ErrorState
              error={error}
              onRetry={() => {
                setIsRefreshing(true);
                queryClient.invalidateQueries({ queryKey: ['jira-epics-basic'] });
              }}
              viewName="epics"
            />
          </div>
        )}

        {/* Stale data banner -- error with cached data still visible */}
        {isError && epicsData && !bannerDismissed && (
          <div className="px-4 pt-4">
            <StaleDataBanner
              onRetry={() => {
                setIsRefreshing(true);
                queryClient.invalidateQueries({ queryKey: ['jira-epics-basic'] });
              }}
              onDismiss={() => setBannerDismissed(true)}
            />
          </div>
        )}

        {showSkeleton ? (
          <div className="p-4">
            <EpicsSkeleton />
          </div>
        ) : !isError ? (
          <>
            {epics.length > 0 ? (
              <div className="w-full text-sm">
                {epics.map((epic) => (
                  <EpicRow
                    key={epic.key}
                    epic={epic}
                    onEpicClick={onEpicClick}
                    enrichment={{ kind: 'pending' }}
                    onRetryEnrichment={() => {}}
                  />
                ))}
              </div>
            ) : null}

            {epicsData !== undefined && epics.length === 0 && (
              <EmptyState
                icon={Layers}
                title="No epics yet"
                subtitle="Epics will appear once they are created in your project"
                action={<Button onClick={() => setCreateOpen(true)}>Create Epic</Button>}
              />
            )}
          </>
        ) : null}
      </div>

      <CreateEpicDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
