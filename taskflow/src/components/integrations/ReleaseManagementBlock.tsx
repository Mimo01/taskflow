import { useQuery } from '@tanstack/react-query';
import { Loader2, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { listJiraProjects } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

/** Sentinel for the "None" option: Base UI Select values must be non-empty strings. */
const NONE = '__none__';

/**
 * Release Management project picker (quick 261014-eym).
 *
 * Global (not per-project). Leaving it unset silently disables every
 * deployment-package warning, section and column.
 */
export default function ReleaseManagementBlock() {
  const rmProjectKey = useSettingsStore((s) => s.releaseManagementProjectKey);
  const setRmProjectKey = useSettingsStore((s) => s.setReleaseManagementProjectKey);
  const { jiraBaseUrl } = useAuthStore();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!jiraBaseUrl) return;
    setToken(null);
    readSecret('jira-pat')
      .then(setToken)
      .catch(() => setToken(null));
  }, [jiraBaseUrl]);

  const {
    data: projects,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['jira-projects-rm', jiraBaseUrl],
    queryFn: () => listJiraProjects(jiraBaseUrl ?? '', token ?? ''),
    enabled: !!jiraBaseUrl && !!token,
  });

  const sorted = useMemo(
    () =>
      projects
        ? [...projects].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
          )
        : [],
    [projects],
  );

  const selected = projects?.find((p) => p.key === rmProjectKey);
  const keyIsStale = !!rmProjectKey && Array.isArray(projects) && !selected;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Release Management
      </h3>
      <div className="flex flex-col gap-2">
        <Label htmlFor="rm-project">Release Management project</Label>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading projects…</span>
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive" role="alert">
            <XCircle className="h-4 w-4" />
            <span>
              Couldn't load projects.{' '}
              <button
                type="button"
                onClick={() => refetch()}
                className="underline hover:no-underline"
              >
                Retry
              </button>
            </span>
          </div>
        ) : (
          <SearchableSelect
            id="rm-project"
            value={rmProjectKey ?? NONE}
            onValueChange={(v) => setRmProjectKey(!v || v === NONE ? null : v)}
            placeholder={rmProjectKey ?? 'None'}
            searchPlaceholder="Search projects..."
            options={[
              { value: NONE, label: 'None', keywords: ['None'] },
              ...sorted.map((p) => ({ value: p.key, label: p.name, keywords: [p.key, p.name] })),
            ]}
          />
        )}
        {keyIsStale && (
          <p className="text-xs text-destructive">
            Previously selected project "{rmProjectKey}" is no longer available. Pick another or
            choose None.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          The project holding the WEEK issues. Deployment package checks and sync are disabled while
          nothing is selected.
        </p>
      </div>
    </div>
  );
}
