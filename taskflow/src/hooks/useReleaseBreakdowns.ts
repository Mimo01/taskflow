import { useQueries, useQueryClient } from '@tanstack/react-query';
import { fetchVersionsStatusBreakdown, type VersionStatusBreakdown } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

export const BREAKDOWN_CHUNK_MAX = 50;

/** Chunk key. 'batch' keeps it distinct from the per-version detail key. */
export const releaseBreakdownChunkKey = (ids: readonly string[]) =>
  ['jira-version-counts', 'batch', [...ids].sort().join(',')] as const;

/** Per-version seed written when a chunk resolves (read by the detail header). */
export const releaseBreakdownSeedKey = (versionId: string) =>
  ['jira-version-counts', 'breakdown', versionId] as const;

function slices<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Split ids into fixed fetch chunks. Boundaries depend only on position (upcoming
 * in slices of `max`, then released in firstPage / loadMore steps), so revealing
 * more released rows only appends chunks and never changes an earlier key.
 */
export function planBreakdownChunks(
  upcomingIds: readonly string[],
  releasedIds: readonly string[],
  releasedVisible: number,
  opts: { firstPage?: number; loadMore?: number; max?: number } = {},
): string[][] {
  const { firstPage = 5, loadMore = 10, max = BREAKDOWN_CHUNK_MAX } = opts;
  const chunks: string[][] = slices(upcomingIds, max);
  const limit = Math.min(releasedVisible, releasedIds.length);
  let start = 0;
  let step = firstPage;
  while (start < limit) {
    const end = start + step;
    chunks.push(...slices(releasedIds.slice(start, end), max));
    start = end;
    step = loadMore;
  }
  return chunks.filter((c) => c.length > 0);
}

export function useReleaseBreakdowns(args: {
  upcomingIds: readonly string[];
  releasedIds: readonly string[];
  releasedVisible: number;
}): {
  breakdowns: ReadonlyMap<string, VersionStatusBreakdown>;
  loadingIds: ReadonlySet<string>;
  errorIds: ReadonlySet<string>;
} {
  const { jiraBaseUrl } = useAuthStore();
  const queryClient = useQueryClient();
  const chunks = planBreakdownChunks(args.upcomingIds, args.releasedIds, args.releasedVisible);

  return useQueries({
    queries: chunks.map((ids) => ({
      queryKey: releaseBreakdownChunkKey(ids),
      queryFn: async () => {
        const token = await readSecret('jira-pat');
        const res = await fetchVersionsStatusBreakdown(jiraBaseUrl ?? '', token ?? '', ids);
        for (const id of ids) queryClient.setQueryData(releaseBreakdownSeedKey(id), res[id]);
        return res;
      },
      enabled: !!jiraBaseUrl && ids.length > 0,
      staleTime: 5 * 60_000,
    })),
    combine: (results) => {
      const breakdowns = new Map<string, VersionStatusBreakdown>();
      const loadingIds = new Set<string>();
      const errorIds = new Set<string>();
      results.forEach((q, i) => {
        const ids = chunks[i] ?? [];
        if (q.data) {
          for (const id of ids) {
            const b = q.data[id];
            if (b) breakdowns.set(id, b);
          }
        } else if (q.isError) {
          for (const id of ids) errorIds.add(id);
        } else if (q.isFetching) {
          for (const id of ids) loadingIds.add(id);
        }
      });
      return { breakdowns, loadingIds, errorIds };
    },
  });
}
