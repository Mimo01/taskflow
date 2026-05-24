/**
 * IntegrationsStep — Wizard step 3 (Integrations).
 *
 * Mounts the self-contained AioBlock component (D-05) and adds an inline
 * Tempo toggle (D-06 — not extracted, single checkbox). Continue is gated
 * per D-01..D-04 (see continueDisabled expression below). All settings bind
 * directly to useSettingsStore — no wizard-local state (D-10).
 *
 * Continue gating uses Option A: a duplicate useQuery with the same key as
 * AioBlock (['aio', jiraBaseUrl, 'projects']). TanStack Query deduplicates
 * the two subscribers to a single network call — the step gets isLoading /
 * isError / projects state for gating without a second HTTP request.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import AioBlock from '@/components/integrations/AioBlock';
import { Button } from '@/components/ui/button';
import { fetchAioProjects } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useSettingsStore } from '@/stores/settings.store';

export default function IntegrationsStep() {
  // ── Onboarding store ───────────────────────────────────────────────────────
  const { goBack, goNext, set } = useOnboardingStore();

  // ── Settings store — fine-grained selectors (D-10, no wizard-local state) ─
  const aioEnabled = useSettingsStore((s) => s.aioEnabled);
  const selectedAioProjectKey = useSettingsStore((s) => s.selectedAioProjectKey);
  const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);
  const setTempoEnabled = useSettingsStore((s) => s.setTempoEnabled);

  // ── Option A: duplicate gating query (same key as AioBlock — intentional) ─
  // TanStack Query deduplicates subscriptions with the same queryKey to a
  // single in-flight request, so AioBlock and IntegrationsStep share one call.
  const { jiraBaseUrl } = useAuthStore();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!jiraBaseUrl) return;
    readSecret('jira-pat')
      .then(setToken)
      .catch(() => setToken(null));
  }, [jiraBaseUrl]);

  const { data: projects, isLoading, isError } = useQuery({
    // Same queryKey as AioBlock — intentional deduplication (Option A, RESEARCH Pattern 3)
    queryKey: ['aio', jiraBaseUrl, 'projects'],
    queryFn: () => fetchAioProjects(jiraBaseUrl!, token!),
    enabled: !!jiraBaseUrl && !!token,
  });

  // ── D-01..D-04: Continue gating expression ─────────────────────────────────
  // D-01: enabled when aioEnabled is false (short-circuit)
  // D-01: enabled when aioEnabled is true AND project selected AND list loaded
  // D-02: disabled while loading
  // D-03: disabled on error
  // D-04: disabled when list loads empty
  const continueDisabled =
    aioEnabled &&
    (!selectedAioProjectKey || isLoading || isError || (Array.isArray(projects) && projects.length === 0));

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleContinue = () => {
    set({ integrationsVisited: true });
    goNext();
  };

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto py-8">
      {/* Step heading block — matches GitLabStep/JiraStep layout */}
      <div>
        <h2 className="text-xl font-semibold">Set up Integrations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enable optional plugins to see test execution and worklog data.
        </p>
      </div>

      {/* AIO block — self-contained toggle + project picker (D-05) */}
      <AioBlock />

      {/* Tempo toggle — inline (D-06: not extracted; single checkbox) */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Tempo Timesheets
        </h3>
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-semibold">Enable Tempo Timesheets</p>
            <p className="text-xs text-muted-foreground">
              Show worklog data from Jira Tempo Timesheets. Requires Tempo plugin on your Jira
              instance.
            </p>
          </div>
          <input
            type="checkbox"
            aria-label="Enable Tempo Timesheets"
            checked={tempoEnabled}
            onChange={(e) => setTempoEnabled(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
        </label>
      </div>

      {/* Navigation row — Back always enabled; Continue gated per D-01..D-04 */}
      <div className="flex gap-3">
        <Button variant="ghost" onClick={goBack}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={continueDisabled}>
          Continue
        </Button>
      </div>
    </div>
  );
}
