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
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { EpicEnriched, EpicEnrichmentCounts } from '@/services/jira';
import { EPICS_PAGE_ORDER, fetchEpicEnrichmentMap, fetchEpicsBasic } from '@/services/jira';
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
    // biome-ignore lint/a11y/noStaticElementInteractions: matches the previous <tr onClick> row semantics — plan explicitly forbids adding new a11y semantics here
    // biome-ignore lint/a11y/useKeyWithClickEvents: matches the previous <tr onClick> row semantics — plan explicitly forbids adding new a11y semantics here
    <div
      className="flex w-full items-center border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => onEpicClick?.(epic.key)}
    >
      {/* Key */}
      <div className={cn('flex-none w-24 pl-4 pr-2 whitespace-nowrap', CELL_PADDING)}>
        <span className="font-mono text-xs text-muted-foreground">{epic.key}</span>
      </div>

      {/* Priority — icon only, name carried in title/alt (D-10).
          Sits between key and name to match BacklogRow's column order. */}
      <div className={cn('flex-none pl-2 pr-0 whitespace-nowrap', CELL_PADDING)}>
        <span
          className="flex items-center justify-center"
          style={{ width: 18, height: 18 }}
          aria-hidden={!epic.priority}
        >
          <PriorityIcon priority={epic.priority} />
        </span>
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
  const { epicNameFieldKey, epicColorFieldKey, storyPointsFieldKey, epicLinkFieldKey } =
    useSettingsStore();

  const [token, setToken] = useState<string | null>(null);
  const loadToken = useCallback(() => {
    readSecret('jira-pat')
      .then(setToken)
      .catch(() => setToken(null));
  }, []);
  useEffect(() => {
    loadToken();
  }, [loadToken]);

  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: epicsData,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery<EpicEnriched[]>({
    // Ordering is part of the key. fetchEpicsBasic is shared with the Sidebar,
    // Backlog and Sprint Board epic pickers, which keep `updated DESC`; reusing
    // the bare key would have served this page's `created ASC` order to them
    // (and vice versa) depending on who fetched first.
    queryKey: ['jira-epics-basic', activeJiraProject, jiraBaseUrl, EPICS_PAGE_ORDER],
    queryFn: () =>
      fetchEpicsBasic(
        jiraBaseUrl ?? '',
        token ?? '',
        activeJiraProject ?? '',
        epicNameFieldKey ?? undefined,
        epicColorFieldKey ?? undefined,
        EPICS_PAGE_ORDER,
      ),
    enabled: !!jiraBaseUrl && !!token && !!activeJiraProject,
  });
  const epics = epicsData ?? [];

  // Progressive enrichment (D-04, D-14): a second query keyed off the loaded
  // epic keys. Its isLoading/isError must never gate showSkeleton, ErrorState
  // or StaleDataBanner — those remain driven exclusively by the basic query.
  const epicKeys = useMemo(() => epics.map((e) => e.key), [epics]);

  const {
    data: enrichmentMap,
    isError: enrichmentIsError,
    refetch: refetchEnrichment,
  } = useQuery<Map<string, EpicEnrichmentCounts>>({
    // Custom field keys participate in the key: changing the field mapping
    // changes what the counts mean, so cached counts must not be reused.
    queryKey: [
      'jira-epics-enrichment',
      activeJiraProject,
      jiraBaseUrl,
      epicKeys.join(','),
      storyPointsFieldKey,
      epicLinkFieldKey,
    ],
    queryFn: () =>
      fetchEpicEnrichmentMap(
        jiraBaseUrl ?? '',
        token ?? '',
        epicKeys,
        storyPointsFieldKey ?? undefined,
        epicLinkFieldKey ?? undefined,
      ),
    enabled: !!jiraBaseUrl && !!token && epicKeys.length > 0,
  });

  function getEnrichmentState(epicKey: string): EnrichmentCellState {
    // Check error BEFORE data, so a stale-but-present map never masks a live
    // failure (the 91.1 CR-06 unread-isError bug class).
    if (enrichmentIsError) return { kind: 'error' };
    // Rows can render from the shared ['jira-epics-basic', …] cache (Sidebar /
    // Backlog / SprintBoard prefetch it, gcTime is Infinity) while readSecret
    // has failed. The enrichment query is then permanently disabled, so
    // reporting `pending` would shimmer forever with no recourse (CR-02).
    // Surface it as an error — retry re-attempts the secret read.
    if (!token) return { kind: 'error' };
    if (enrichmentMap) {
      const counts = enrichmentMap.get(epicKey) ?? {
        total: 0,
        done: 0,
        inProgress: 0,
        todo: 0,
        points: 0,
        donePoints: 0,
      };
      // An epic absent from the map genuinely has zero children (D-16).
      return { kind: 'ready', counts };
    }
    return { kind: 'pending' };
  }

  // Retry semantics are WHOLE-QUERY (locked at plan time): fetchEpicEnrichmentMap
  // is a single batched JQL for all epic keys, so one click refetches enrichment
  // for every row. Do NOT build a single-epic enrichment fetcher.
  const handleRetryEnrichment = () => {
    // A missing token is what disabled the query in the first place, so a bare
    // refetch would be a no-op — re-attempt the secret read as well (CR-02).
    if (!token) loadToken();
    refetchEnrichment();
  };

  const showSkeleton = useDelayedLoading(isLoading) || isRefreshing;

  // Reset off isFetching, NOT isLoading (CR-01). Both retry affordances are only
  // reachable while the query is in `error` state, where isLoading (isPending &&
  // isFetching) is already false and stays false across refetch and success — so
  // an isLoading-keyed effect never re-runs and the skeleton sticks forever.
  // isFetching does transition (false → true → false) on every retry.
  useEffect(() => {
    if (!isFetching) setIsRefreshing(false);
  }, [isFetching]);

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
          // No wrapper padding: settled rows render unwrapped, so a p-4 here
          // would shift every column 16px the moment data lands.
          <EpicsSkeleton />
        ) : !isError ? (
          <>
            {epics.length > 0 ? (
              <div className="w-full text-sm">
                {epics.map((epic) => (
                  <EpicRow
                    key={epic.key}
                    epic={epic}
                    onEpicClick={onEpicClick}
                    enrichment={getEnrichmentState(epic.key)}
                    onRetryEnrichment={handleRetryEnrichment}
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
