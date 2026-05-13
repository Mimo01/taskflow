import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, FlaskConical, Paperclip } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { aioRunStatusBadgeClass } from '@/lib/statusStyles';
import type { AioTestCase, AioTestRun, AioTestRunStep } from '@/services/aio';
import {
  fetchAioCycles,
  fetchAioProjects,
  fetchAioTestCasesForIssue,
  fetchAioTestRunDetail,
  fetchAioTestRunSteps,
  fetchAioTestRunsForCycle,
  fetchAioTraceabilityTestCases,
} from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import { useSettingsStore } from '@/stores/settings.store';
import { AuthImage } from '../AuthImage';
import { ImageLightbox } from '../ImageLightbox';
import { WikiRenderer } from '../WikiRenderer';
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
  jiraIssueId?: string; // Jira numeric issue ID (e.g. "186227") for jiraRequirementIDs filtering
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

// Aggregates inline `[name.ext|url]` image attachments from a run's steps.
// Only image extensions are collected — non-image attachment links remain
// in-flow as openUrl-routed text anchors via WikiRenderer.
const INLINE_IMAGE_ATTACHMENT_RE = /\[([^|\]]+)\|([^\]]+)\]/g;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;

function extractInlineImageAttachments(
  text: string | undefined | null,
): Array<{ filename: string; url: string }> {
  if (!text) return [];
  const out: Array<{ filename: string; url: string }> = [];
  for (const m of text.matchAll(INLINE_IMAGE_ATTACHMENT_RE)) {
    const filename = m[1].trim();
    const url = m[2].trim();
    if (IMAGE_EXT_RE.test(filename) && /^https?:\/\//i.test(url)) {
      out.push({ filename, url });
    }
  }
  return out;
}

function collectAioImageAttachments(
  runs: AioIssueRunData[],
): Array<{ filename: string; url: string }> {
  const all: Array<{ filename: string; url: string }> = [];
  for (const item of runs) {
    for (const step of item.steps) {
      all.push(...extractInlineImageAttachments(step.step));
      all.push(...extractInlineImageAttachments(step.expectedResult));
      all.push(...extractInlineImageAttachments(step.actualResult));
    }
  }
  // Dedupe by URL — same attachment can appear in multiple steps / runs.
  const seen = new Set<string>();
  return all.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

// Grid of AIO image attachments aggregated from inline `[name.ext|url]` refs
// across every step of every linked run. Collapsible header matches the Jira
// `AttachmentsSection` style. Hidden entirely when no image attachments are
// present (no empty state — same convention as the section-level empty case).
function AioAttachmentsGrid({
  attachments,
}: {
  attachments: Array<{ filename: string; url: string }>;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (attachments.length === 0) return null;
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
  const open = lightboxIndex !== null;
  const current = open ? attachments[lightboxIndex] : null;
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-sm font-semibold mb-2 hover:text-foreground/80"
      >
        <ChevronIcon className="size-4" />
        <Paperclip className="size-3.5 text-muted-foreground" />
        AIO attachments ({attachments.length})
      </button>
      {isExpanded && (
        <div className="grid grid-cols-4 gap-2">
          {attachments.map((att, idx) => (
            <div
              key={att.url}
              role="button"
              tabIndex={0}
              aria-label={`${att.filename} - click to view full size`}
              className="w-20 h-20 rounded-md overflow-hidden bg-muted relative cursor-pointer"
              onClick={() => setLightboxIndex(idx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setLightboxIndex(idx);
                }
              }}
            >
              <AuthImage
                src={att.url}
                alt={att.filename}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
      {current && (
        <ImageLightbox
          src={current.url}
          alt={current.filename}
          open={open}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
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
          <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Step</th>
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
          <tr key={step.id} className="border-b border-border hover:bg-muted/30 transition-colors">
            <td className="px-4 py-3">
              <WikiRenderer wikiText={step.step} />
            </td>
            <td className="px-3 py-3">
              {!step.expectedResult ? '—' : <WikiRenderer wikiText={step.expectedResult} />}
            </td>
            <td className="px-3 py-3">
              <div>
                {step.status === 'NOT_EXECUTED' || !step.actualResult ? (
                  '—'
                ) : (
                  <WikiRenderer wikiText={step.actualResult} />
                )}
              </div>
              {/* Thumbnails below actual text — D-12 */}
              {(
                (step as AioTestRunStep & { attachments?: { url?: string; fileName?: string }[] })
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
          isExpanded ? `Collapse test run for ${displayName}` : `Expand test run for ${displayName}`
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

export function AioTestRunsSection({
  issueKey,
  jiraBaseUrl,
  jiraIssueId,
}: AioTestRunsSectionProps) {
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

      // Plan 54-06 Task 2 (Branch A1): direct-lookup path.
      // Branch chosen: Direct lookup available via traceability response — sub-branch A1.
      // Probe C1 confirmed the traceability endpoint embeds testRun.ID + testCycle.detail.key
      // on each item, so we can skip BOTH fetchAioCycles AND fetchAioTestRunsForCycle
      // on the success path and fetch run detail + steps directly per linked run.
      // See .planning/phases/54-aio-on-issue-detail/54-PROBE-FINDINGS.md ## Probe C.
      if (jiraNumericId !== null) {
        const projects = await fetchAioProjects(jiraBaseUrl, token);
        const aioProject = projects.find((p) => p.projectKey === projectKey);
        if (!aioProject) return null;

        // Fetch both traceability slices in parallel (defect AND requirement
        // linkage — an issue may appear in either or both).
        const [defectCases, reqCases] = await Promise.all([
          fetchAioTraceabilityTestCases(jiraBaseUrl, token, aioProject.id, jiraNumericId, 'defect'),
          fetchAioTraceabilityTestCases(
            jiraBaseUrl,
            token,
            aioProject.id,
            jiraNumericId,
            'requirement',
          ),
        ]);
        // De-duplicate by test case key (defect ∪ requirement) preserving order.
        const seen = new Set<string>();
        const linkedTestCases = [...defectCases, ...reqCases].filter((tc) =>
          seen.has(tc.key) ? false : seen.add(tc.key) || true,
        );
        if (linkedTestCases.length === 0) return null;

        // Flatten linked test cases into (testCase, runRef) pairs. Each linked
        // test case carries an embedded run reference (runId + cycleKey) from
        // the widened traceability response — no cycle scan needed.
        const runRefs = linkedTestCases.flatMap((tc) =>
          tc.runs.map((r) => ({ testCase: tc, runRef: r })),
        );
        if (runRefs.length === 0) return [];

        // Fetch run detail + steps in parallel for every linked run.
        const runData = await Promise.all(
          runRefs.map(async ({ testCase, runRef }) => {
            const detail = await fetchAioTestRunDetail(
              jiraBaseUrl,
              token,
              projectKey,
              runRef.cycleKey,
              runRef.runId,
            );
            if (!detail) return null;
            return {
              run: {
                ...detail.run,
                // Prefer the test case key from traceability — it is the
                // canonical linkage. fetchAioTestRunDetail falls back to '' when
                // the response omits testCase.key.
                testCaseKey: detail.run.testCaseKey || testCase.key,
              },
              testCase,
              steps: detail.steps,
            };
          }),
        );
        const withSteps = runData
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .filter((item) => item.steps.length > 0);
        if (withSteps.length === 0) return [];
        return withSteps;
      }

      // Legacy path: no jiraIssueId — fall back to full project scan +
      // active-cycle pagination. Tests-only / migration callers; kept intact
      // for backwards compatibility (D-04, D-06).
      const linkedTestCases: AioTestCase[] = await fetchAioTestCasesForIssue(
        jiraBaseUrl,
        token,
        projectKey,
        issueKey,
      );
      if (linkedTestCases.length === 0) return null;

      const cycles = await fetchAioCycles(jiraBaseUrl, token, projectKey);
      const activeCycle = pickLatestActiveCycle(cycles);
      if (!activeCycle) return [];

      const allRuns = await fetchAioTestRunsForCycle(
        jiraBaseUrl,
        token,
        projectKey,
        activeCycle.key,
      );
      const testCaseKeys = new Set(linkedTestCases.map((tc) => tc.key));
      const matchedRuns = allRuns.filter((r) => testCaseKeys.has(r.testCaseKey));
      if (matchedRuns.length === 0) return [];

      const runData = await Promise.all(
        matchedRuns.map(async (run) => ({
          run,
          testCase: linkedTestCases.find((tc) => tc.key === run.testCaseKey),
          steps: await fetchAioTestRunSteps(
            jiraBaseUrl,
            token,
            projectKey,
            activeCycle.key,
            run.id,
          ),
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
  // Compute attachments aggregation BEFORE any conditional returns to honour
  // the Rules of Hooks.
  const aioAttachments = useMemo(
    () =>
      stepsQuery.data && stepsQuery.data.length > 0
        ? collectAioImageAttachments(stepsQuery.data)
        : [],
    [stepsQuery.data],
  );

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
      <AioAttachmentsGrid attachments={aioAttachments} />
    </section>
  );
}
