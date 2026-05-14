import { useQuery } from '@tanstack/react-query';
import { Loader2, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { fetchAioProjects } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '../../stores/settings.store';

export default function IntegrationsSection() {
  // IN-01: fine-grained selectors avoid re-rendering this component on every
  // unrelated settings-store mutation (theme, density, sidebarCollapsed, etc.).
  const aioEnabled = useSettingsStore((s) => s.aioEnabled);
  const setAioEnabled = useSettingsStore((s) => s.setAioEnabled);
  const selectedAioProjectKey = useSettingsStore((s) => s.selectedAioProjectKey);
  const setSelectedAioProjectKey = useSettingsStore((s) => s.setSelectedAioProjectKey);

  const { jiraBaseUrl } = useAuthStore();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // WR-03: skip the Stronghold IPC when Jira is unconfigured. Mirrors the
    // matching guard in Sidebar.tsx so the two copies of this pattern stay aligned.
    if (!jiraBaseUrl) return;
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
    queryKey: ['aio', jiraBaseUrl, 'projects'],
    queryFn: () => fetchAioProjects(jiraBaseUrl!, token!),
    enabled: !!jiraBaseUrl && !!token,
  });

  const sortedProjects = useMemo(
    () =>
      projects
        ? [...projects].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        : [],
    [projects],
  );

  const selectedProject = projects?.find((p) => p.projectKey === selectedAioProjectKey);
  // WR-01: surface a stale persisted key (project deleted/renamed upstream).
  // Only flag when projects has loaded as an array AND the persisted key is non-empty
  // AND no matching project was found — otherwise loading and "no projects" states
  // would spuriously render the warning.
  const selectedKeyIsStale =
    !!selectedAioProjectKey && Array.isArray(projects) && !selectedProject;

  return (
    <div data-testid="section-integrations" className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Integrations</h2>
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          AIO Test Management
        </h3>
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-medium">Enable AIO Test Management</p>
            <p className="text-xs text-muted-foreground">
              Show test execution data from AIO TCMS. Requires AIO plugin on your Jira instance.
            </p>
          </div>
          <input
            type="checkbox"
            aria-label="Enable AIO Test Management"
            checked={aioEnabled}
            onChange={(e) => setAioEnabled(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
        </label>
        {aioEnabled && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aio-project">AIO Project</Label>
            {isLoading ? (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading projects…</span>
              </div>
            ) : isError ? (
              <div className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
                <XCircle className="h-4 w-4" />
                <span>
                  Couldn't load AIO projects.{' '}
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="underline hover:no-underline"
                  >
                    Retry
                  </button>
                </span>
              </div>
            ) : projects && projects.length === 0 ? (
              <Select disabled value="">
                <SelectTrigger id="aio-project" className="w-full">
                  <span className="flex flex-1 text-left text-sm text-muted-foreground">
                    No AIO projects available
                  </span>
                </SelectTrigger>
                <SelectContent />
              </Select>
            ) : (
              <Select value={selectedAioProjectKey ?? ''} onValueChange={setSelectedAioProjectKey}>
                <SelectTrigger id="aio-project" className="w-full">
                  <span className="flex flex-1 text-left text-sm">
                    {selectedProject ? (
                      selectedProject.name
                    ) : (
                      <span className="text-muted-foreground">Choose a project...</span>
                    )}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {sortedProjects.map((p) => (
                    <SelectItem key={p.projectKey} value={p.projectKey}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedKeyIsStale && (
              <p className="text-xs text-destructive">
                Previously selected project "{selectedAioProjectKey}" is no longer available. Pick
                another or clear the selection.
              </p>
            )}
            {!isLoading && !isError && projects && projects.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Pick the AIO Test Management project this app shows.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
