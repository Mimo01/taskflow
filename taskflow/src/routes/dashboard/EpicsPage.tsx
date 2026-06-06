/**
 * EpicsPage — Full-page /epics route component.
 *
 * Loads only basic epic data (name, status, assignee). Story counts and
 * progress are deferred to EpicDetailSheet — no expensive bulk story query here.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { epicColorToTailwind } from '@/lib/epicColors';
import { statusPillClass } from '@/lib/statusStyles';
import type { EpicEnriched } from '@/services/jira';
import { fetchEpicsBasic } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { CreateEpicDialog } from './CreateEpicDialog';
import { EpicsSkeleton } from './EpicsSkeleton';

// ── EpicRow ───────────────────────────────────────────────────────────────────

interface EpicRowProps {
  epic: EpicEnriched;
  onEpicClick?: (key: string) => void;
}

function EpicRow({ epic, onEpicClick }: EpicRowProps) {
  const colorResult = epicColorToTailwind(epic.color ?? null, epic.key);

  return (
    <tr
      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => onEpicClick?.(epic.key)}
    >
      {/* Color bar — prominent left border */}
      <td className="w-1 p-0">
        <div
          className={`w-1 h-full min-h-[3rem] ${colorResult.className}`}
          style={colorResult.style ? { backgroundColor: colorResult.style.color } : undefined}
        />
      </td>

      {/* Epic name as colored badge */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium text-left ${colorResult.className}`}
          style={colorResult.style}
        >
          {epic.epicName}
        </span>
      </td>

      {/* Epic key */}
      <td className="px-3 py-3 text-xs text-muted-foreground font-mono">{epic.key}</td>

      {/* Status badge — flex wrapper so the shared pill's min-w/text-center
          take effect (statusPillClass assumes a flex-item context, as in
          StoryHeaderRow / TaskCard / issue detail). */}
      <td className="px-3 py-3">
        <div className="flex">
          <span className={statusPillClass(epic.status.statusCategory?.key)}>
            {epic.status.name}
          </span>
        </div>
      </td>

      {/* Assignee — extra right padding so the avatar isn't flush against the
          container edge (the table has no outer horizontal padding, unlike the
          px-6 page header). */}
      <td className="pl-3 pr-6 py-3">
        <CachedAvatar
          url={epic.assignee?.avatarUrls?.['48x48'] || null}
          name={epic.assignee?.displayName || 'Unassigned'}
          size={24}
        />
      </td>
    </tr>
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
              <table className="w-full text-sm">
                <colgroup>
                  <col className="w-1" />
                  <col />
                  <col className="w-28" />
                  <col className="w-28" />
                  <col className="w-16" />
                </colgroup>
                <tbody>
                  {epics.map((epic) => (
                    <EpicRow key={epic.key} epic={epic} onEpicClick={onEpicClick} />
                  ))}
                </tbody>
              </table>
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
