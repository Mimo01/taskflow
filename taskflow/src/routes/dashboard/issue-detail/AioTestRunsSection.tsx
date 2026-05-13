import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { aioRunStatusBadgeClass } from '@/lib/statusStyles';
import {
  fetchAioCycles,
  fetchAioProjects,
  fetchAioTestCasesForIssue,
  fetchAioTestRunSteps,
  fetchAioTestRunsForCycle,
  fetchAioTraceabilityTestCases,
} from '@/services/aio';
import type { AioTestCase, AioTestRun, AioTestRunStep } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import { useSettingsStore } from '@/stores/settings.store';
import { AuthImage } from '../AuthImage';
import { ImageLightbox } from '../ImageLightbox';
import { AioTestRunsSkeleton } from './AioTestRunsSkeleton';

// Local composite type for a single test run with its resolved test case and steps
interface AioIssueRunData {
  run: AioTestRun;
  testCase: AioTestCase | undefined;
  steps: AioTestRunStep[];
}

interface AioTestRunsSectionProps {
  issueKey: string;
  jiraBaseUrl: string;
  jiraIssueId?: string;  // Jira numeric issue ID (e.g. "186227") for jiraRequirementIDs filtering
}

// Pick the latest active cycle by numeric suffix (e.g. PROJ-CY-4 > PROJ-CY-3).
// String sort is insufficient — "PROJ-CY-10" < "PROJ-CY-9" alphabetically (Pitfall 3).
function pickLatestActiveCycle(cycles: { key: string; status: string }[]) {
  const cycleNum = (key: string) => {
    const m = key.match(/CY-(\d+)$/);
    return m ? parseInt(m[1], 10) : -1;
  };
  const sorted = cycles
    .filter((c) => c.status === 'Active')
    .sort((a, b) => cycleNum(b.key) - cycleNum(a.key));
  return sorted.length > 0 ? sorted[0] : undefined;
}

function normalizeStatusLabel(raw: string | undefined): string {
  switch ((raw ?? '').toUpperCase()) {
    case 'PASS':
      return 'Pass';
    case 'FAIL':
      return 'Fail';
    case 'BLOCKED':
      return 'Blocked';
    case 'NOT_EXECUTED':
      return 'Not Run';
    default:
      return raw ?? 'Not Run';
  }
}

// Step thumbnail sub-component — each thumbnail has its own independent lightbox state (D-14)
function StepThumbnail({ url, fileName }: { url: string; fileName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${fileName} - click to view full size`}
        className="h-12 w-auto rounded-md overflow-hidden bg-muted relative cursor-pointer"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <AuthImage src={url} alt={fileName} className="h-full w-auto object-contain" />
      </div>
      <ImageLightbox src={url} alt={fileName} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// 4-column step table per UI-SPEC: Step | Expected | Actual | Status
function StepTable({ steps }: { steps: AioTestRunStep[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b bg-muted/10">
        <tr>
          <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">
            Step
          </th>
          <th className="w-48 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
            Expected
          </th>
          <th className="w-48 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
            Actual
          </th>
          <th className="w-24 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
            Status
          </th>
        </tr>
      </thead>
      <tbody>
        {steps.map((step) => (
          <tr
            key={step.id}
            className="border-b border-border hover:bg-muted/30 transition-colors"
          >
            <td className="px-4 py-3">{step.step}</td>
            <td className="px-3 py-3">{step.expectedResult ?? '—'}</td>
            <td className="px-3 py-3">
              <div>
                {step.status === 'NOT_EXECUTED' || !step.actualResult ? '—' : step.actualResult}
              </div>
              {/* Thumbnails below actual text — D-12 */}
              {((step as AioTestRunStep & { attachments?: { url?: string; fileName?: string }[] })
                .attachments ?? []
              ).length > 0 && (
                <div className="flex flex-row gap-1 mt-1 flex-wrap">
                  {(
                    (
                      step as AioTestRunStep & {
                        attachments?: { url?: string; fileName?: string }[];
                      }
                    ).attachments ?? []
                  ).map((att, idx) => (
                    <StepThumbnail key={idx} url={att.url ?? ''} fileName={att.fileName ?? ''} />
                  ))}
                </div>
              )}
            </td>
            <td className="px-3 py-3">
              <span
                className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioRunStatusBadgeClass(step.status ?? 'NOT_EXECUTED')}`}
              >
                {normalizeStatusLabel(step.status)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Collapsible block for multi-test-case grouping — collapsed for PASS, expanded for FAIL/BLOCKED (D-10)
function CollapsibleRunBlock({ run, testCase, steps }: AioIssueRunData) {
  const [isExpanded, setIsExpanded] = useState(run.status !== 'PASS');
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
  const displayName = testCase?.title ?? run.testCase?.title ?? run.testCaseKey;

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={
          isExpanded
            ? `Collapse test run for ${displayName}`
            : `Expand test run for ${displayName}`
        }
        className="flex items-center gap-2 cursor-pointer min-h-[44px] px-4 py-2 hover:bg-muted/30 w-full text-left"
      >
        <ChevronIcon className="size-4" />
        <FlaskConical className="size-3.5 text-muted-foreground" />
        <span className="text-sm">{displayName}</span>
        <span
          className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioRunStatusBadgeClass(run.status)}`}
        >
          {normalizeStatusLabel(run.status)}
        </span>
      </button>
      {isExpanded && <StepTable steps={steps} />}
    </div>
  );
}

export function AioTestRunsSection({ issueKey, jiraBaseUrl, jiraIssueId }: AioTestRunsSectionProps) {
  // aioEnabled gate — must be first, before all hooks (Rules of Hooks: conditional return after hook reads)
  const aioEnabled = useSettingsStore((s) => s.aioEnabled);

  const queryClient = useQueryClient();
  const stepsQuery = useQuery({
    queryKey: ['aio', jiraBaseUrl, 'issue-steps', issueKey],
    queryFn: async (): Promise<AioIssueRunData[] | null> => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !issueKey) return null;

      const projectKey = issueKey.split('-')[0];

      const jiraNumericId = jiraIssueId ? Number(jiraIssueId) : null;

      // Step 1: resolve AIO numeric project ID + fetch linked test cases via traceability
      // (both defect and requirement in parallel — replaces 13K test case scan)
      let linkedTestCases: import('@/services/aio').AioTestCase[];
      if (jiraNumericId !== null) {
        const projects = await fetchAioProjects(jiraBaseUrl, token);
        const aioProject = projects.find((p) => p.projectKey === projectKey);
        if (!aioProject) return null;
        const [defectCases, reqCases] = await Promise.all([
          fetchAioTraceabilityTestCases(jiraBaseUrl, token, aioProject.id, jiraNumericId, 'defect'),
          fetchAioTraceabilityTestCases(jiraBaseUrl, token, aioProject.id, jiraNumericId, 'requirement'),
        ]);
        const seen = new Set<string>();
        linkedTestCases = [...defectCases, ...reqCases].filter((tc) => seen.has(tc.key) ? false : seen.add(tc.key) || true);
      } else {
        // No jiraIssueId — fall back to full project scan (legacy path, tests only)
        linkedTestCases = await fetchAioTestCasesForIssue(jiraBaseUrl, token, projectKey, issueKey);
      }

      if (linkedTestCases.length === 0) return null;

      // Step 2: find active cycle, fetch runs, filter to linked test cases
      const cycles = await fetchAioCycles(jiraBaseUrl, token, projectKey);
      const activeCycle = pickLatestActiveCycle(cycles);
      if (!activeCycle) return [];

      const allRuns = await fetchAioTestRunsForCycle(jiraBaseUrl, token, projectKey, activeCycle.key);
      const testCaseKeys = new Set(linkedTestCases.map((tc) => tc.key));
      const matchedRuns = allRuns.filter((r) => testCaseKeys.has(r.testCaseKey));
      if (matchedRuns.length === 0) return [];

      // Step 3: fetch steps for matched runs
      const runData = await Promise.all(
        matchedRuns.map(async (run) => ({
          run,
          testCase: linkedTestCases.find((tc) => tc.key === run.testCaseKey),
          steps: await fetchAioTestRunSteps(jiraBaseUrl, token, projectKey, activeCycle.key, run.id),
        })),
      );
      const withSteps = runData.filter((item) => item.steps.length > 0);
      if (withSteps.length === 0) return [];
      return withSteps;
    },
    enabled: !!jiraBaseUrl && !!issueKey && !!aioEnabled,
    staleTime: 30_000,
  });

  const showSkeleton = useDelayedLoading(stepsQuery.isLoading);

  // Render state waterfall
  if (!aioEnabled) return null;

  if (showSkeleton || stepsQuery.isLoading) return <AioTestRunsSkeleton />;

  if (stepsQuery.isError) {
    return (
      <div className="p-4">
        <ErrorState
          error={stepsQuery.error}
          onRetry={() =>
            void queryClient.invalidateQueries({
              queryKey: ['aio', jiraBaseUrl, 'issue-steps', issueKey],
            })
          }
          viewName="AIO test runs"
        />
      </div>
    );
  }

  const data = stepsQuery.data;

  // Sentinel null = no linked test cases → section hidden entirely (D-04 first case)
  if (data === null) return null;

  // undefined = not yet loaded (already handled above by isLoading)
  if (data === undefined) return null;

  // Empty array = test cases linked but no usable runs (D-04 second case)
  if (data.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No test runs in active cycle"
        subtitle="Test cases are linked but no runs have been recorded for the active cycle."
      />
    );
  }

  // Data available — render section
  return (
    <section aria-label="AIO Test Runs" className="mt-6" data-testid="aio-test-runs-section">
      <div className="flex items-center gap-1.5 text-sm font-semibold mb-2">
        <FlaskConical className="size-3.5 text-muted-foreground" />
        AIO Test Runs
      </div>
      {data.length === 1 ? (
        <StepTable steps={data[0].steps} />
      ) : (
        <div>
          {data.map((item) => (
            <CollapsibleRunBlock key={item.run.id} {...item} />
          ))}
        </div>
      )}
    </section>
  );
}
