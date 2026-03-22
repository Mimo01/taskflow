/**
 * WatcherToggle — sidebar widget for watching/unwatching a Jira issue.
 *
 * Self-contained: fetches watcher state, toggles with optimistic update.
 * Uses the jira-watchers service CRUD functions.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import type { WatcherData } from '@/services/jira';
import { addWatcher, fetchWatchers, removeWatcher } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { MetaRow } from './MetaRow';

interface WatcherToggleProps {
  issueKey: string;
  jiraBaseUrl: string;
}

export function WatcherToggle({ issueKey, jiraBaseUrl }: WatcherToggleProps) {
  const queryClient = useQueryClient();
  const jiraUsername = useAuthStore((s) => s.jiraUsername);

  const queryKey = ['jira-watchers', issueKey];

  const { data: watcherData } = useQuery({
    queryKey,
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return fetchWatchers(jiraBaseUrl, token, issueKey);
    },
    staleTime: 30_000,
    enabled: !!issueKey && !!jiraBaseUrl,
  });

  const toggleMutation = useMutation({
    mutationFn: async (shouldWatch: boolean) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      if (!jiraUsername) throw new Error('Jira username not available');
      if (shouldWatch) {
        await addWatcher(jiraBaseUrl, token, issueKey, jiraUsername);
      } else {
        await removeWatcher(jiraBaseUrl, token, issueKey, jiraUsername);
      }
    },
    onMutate: async (shouldWatch) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WatcherData>(queryKey);
      queryClient.setQueryData<WatcherData>(queryKey, (old) => {
        if (!old) return { isWatching: shouldWatch, watchCount: shouldWatch ? 1 : 0 };
        return {
          isWatching: shouldWatch,
          watchCount: shouldWatch ? old.watchCount + 1 : Math.max(0, old.watchCount - 1),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const isWatching = watcherData?.isWatching ?? false;
  const watchCount = watcherData?.watchCount ?? 0;
  const isPending = toggleMutation.isPending;

  return (
    <MetaRow label="Watchers">
      <button
        type="button"
        onClick={() => toggleMutation.mutate(!isWatching)}
        disabled={isPending || !jiraUsername}
        aria-pressed={isWatching}
        aria-label={isWatching ? 'Click to stop watching' : 'Click to start watching'}
        className="inline-flex items-center gap-1.5 hover:bg-accent rounded px-1 -ml-1 cursor-pointer disabled:cursor-default"
      >
        {isWatching ? (
          <EyeOff className={`size-4 ${isPending ? 'opacity-50' : ''}`} />
        ) : (
          <Eye className={`size-4 ${isPending ? 'opacity-50' : ''}`} />
        )}
        <span className="text-sm">{watchCount}</span>
      </button>
    </MetaRow>
  );
}
