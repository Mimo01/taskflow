import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, FlaskConical, Paperclip } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorState } from '@/components/ui/error-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { aioRunStatusPillClass } from '@/lib/statusStyles';
import type {
  AioTestCase,
  AioTestCaseWithRuns,
  AioTestRun,
  AioTestRunStep,
  AioTraceabilityRunRef,
} from '@/services/aio';
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
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
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

/**
 * Plan 54-07 Gap 1 — one row per (testCase × run) impacted execution.
 * Carries the fetched run.status (already normalised by fetchAioTestRunDetail
 * via toRunChipStatus) so the row's status chip reflects the REAL run state
 * instead of defaulting to a gray "Not Run" placeholder. Also carries the
 * fetched steps so the AIO attachments grid can aggregate from this data on
 * the no-runs path (Gap 2).
 */
interface AioImpactedExecution {
  testCase: AioTestCaseWithRuns;
  runRef: AioTraceabilityRunRef;
  status: string; // "PASS" | "FAIL" | "BLOCKED" | "NOT_EXECUTED" (normalised)
  steps: AioTestRunStep[];
}

/**
 * Plan 54-07 widened return shape — replaces the bare `[]` sentinel from 54-06.
 * - `null`           — no linked test cases at all (D-04 first case; section hidden)
 * - `{ runs, impactedExecutions }` — linked test cases exist; in-cycle runs render
 *   via `runs[]`; cross-cycle (no-active-cycle-match) runs render via
 *   `impactedExecutions[]`. The grid aggregates attachments from BOTH.
 */
type AioTestRunsQueryResult = null | {
  runs: AioIssueRunData[];
  impactedExecutions: AioImpactedExecution[];
};

// T-54-07-02 (cross-cycle fan-out cap, no-runs path):
// MAX_IMPACTED_EXECUTIONS bounds the cross-cycle slice; MAX_PARALLEL caps
// in-flight requests per chunk. NEITHER applies to the in-cycle path —
// in-cycle runs continue to use the existing uncapped Promise.all from 54-06.
const MAX_IMPACTED_EXECUTIONS = 20;
const MAX_PARALLEL = 6;

interface AioTestRunsSectionProps {
  issueKey: string;
  jiraBaseUrl: string;
  jiraIssueId?: string; // Jira numeric issue ID (e.g. "186227") for jiraRequirementIDs filtering
  // Plan 54-10: Jira issue description body. When present, inline `[name.ext|url]`
  // image refs in the description are aggregated into AioAttachmentsGrid alongside
  // test-run step content (deduped by URL).
  description?: string | null;
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
      {isExpanded &&
        (attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No inline image attachments found in linked test runs.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {attachments.map((att, idx) => (
              <button
                key={att.url}
                type="button"
                aria-label={`${att.filename} - click to view full size`}
                className="w-20 h-20 rounded-md overflow-hidden bg-muted relative cursor-pointer border border-border p-0"
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
              </button>
            ))}
          </div>
        ))}
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
      <button
        type="button"
        aria-label={`${fileName} - click to view full size`}
        className="h-12 w-auto rounded-md overflow-hidden bg-muted relative cursor-pointer p-0"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <AuthImage src={url} alt={fileName} className="h-full w-auto object-contain" />
      </button>
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
          // Plan 54-08 Gap 3: min-w-0 on each <td> wrapper (Step/Expected/Actual)
          // releases the column's min-content floor so the WikiRenderer
          // overflow-x-auto wrapper (added in WikiRenderer.tsx
          // markdownComponents.table) can actually contract and scroll.
          // Without min-w-0, the inner wiki table's min-content width forces
          // the outer column wider than the layout allows.
          <tr key={step.id} className="border-b border-border hover:bg-muted/30 transition-colors">
            <td className="px-4 py-3 min-w-0">
              <WikiRenderer wikiText={step.step} />
            </td>
            <td className="px-3 py-3 min-w-0">
              {!step.expectedResult ? '—' : <WikiRenderer wikiText={step.expectedResult} />}
            </td>
            <td className="px-3 py-3 min-w-0">
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
                    <StepThumbnail
                      // biome-ignore lint/suspicious/noArrayIndexKey: attachment list has no stable id
                      key={idx}
                      url={att.url ?? ''}
                      fileName={att.fileName ?? ''}
                    />
                  ))}
                </div>
              )}
            </td>
            <td className="px-3 py-3">
              <span className={aioRunStatusPillClass(step.status ?? 'NOT_EXECUTED')}>
                {normalizeStatusLabel(step.status)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Collapsible block for in-cycle runs — collapsed for PASS, expanded for FAIL/BLOCKED (D-10).
// Plan 54-11 round-4 follow-up: header now shows cycle key + run ID as Links
// (cycle → /aio-cycle/.../...; run → /aio-cycle/.../.../run/{runId}) for
// symmetry with ImpactedExecutionsList. Both targets use the cycle-derived
// projectKey so cross-project navigation works. Each Link also passes
// `state={ from: { type: 'issue', issueKey } }` so the destination page can
// render an issue-rooted breadcrumb (user feedback: clicking from the issue
// should breadcrumb back to that issue, not to the cycle).
function CollapsibleRunBlock({
  run,
  testCase,
  steps,
  issueKey,
}: AioIssueRunData & { issueKey: string }) {
  const [isExpanded, setIsExpanded] = useState(run.status !== 'PASS');
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
  const displayName = testCase?.title ?? run.testCase?.title ?? run.testCaseKey;
  const cycleProjectKey = run.cycleKey.split('-')[0] || '';
  const cycleHref = `/aio-cycle/${cycleProjectKey}/${run.cycleKey}`;
  const runHref = `${cycleHref}/run/${run.id}`;
  const navigate = useNavigate();
  const breadcrumbReset = useBreadcrumbStore((s) => s.reset);
  const breadcrumbPush = useBreadcrumbStore((s) => s.push);

  // Plan 54-11 follow-up: push the originating issue onto the shared
  // breadcrumb trail before navigating, so the destination page renders the
  // app's existing breadcrumb header (matches IssueDetailPage / ReleaseDetailPage
  // convention). breadcrumbReset() clears any stale trail so the issue is the
  // first segment.
  const navigateFromIssue = (href: string) => {
    breadcrumbReset();
    breadcrumbPush({ path: `/issue/${issueKey}`, label: issueKey });
    navigate(href);
  };

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center gap-2 min-h-[44px] px-4 py-2 hover:bg-muted/30">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={
            isExpanded
              ? `Collapse test run for ${displayName}`
              : `Expand test run for ${displayName}`
          }
          className="flex items-center gap-2 cursor-pointer text-left flex-1 min-w-0"
        >
          <ChevronIcon className="size-4 shrink-0" />
          <FlaskConical className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm truncate">{displayName}</span>
        </button>
        <button
          type="button"
          onClick={() => navigateFromIssue(cycleHref)}
          data-testid="in-cycle-run-cycle-link"
          className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline shrink-0"
        >
          {run.cycleKey}
        </button>
        <button
          type="button"
          onClick={() => navigateFromIssue(runHref)}
          data-testid="in-cycle-run-run-link"
          className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline shrink-0"
        >
          {run.id}
        </button>
        <span className={aioRunStatusPillClass(run.status)}>
          {normalizeStatusLabel(run.status)}
        </span>
      </div>
      {isExpanded && <StepTable steps={steps} />}
    </div>
  );
}

export function AioTestRunsSection({
  issueKey,
  jiraBaseUrl,
  jiraIssueId,
  description,
}: AioTestRunsSectionProps) {
  // aioEnabled gate — must be first, before all hooks (Rules of Hooks: conditional return after hook reads)
  const aioEnabled = useSettingsStore((s) => s.aioEnabled);

  const queryClient = useQueryClient();
  const stepsQuery = useQuery({
    queryKey: ['aio', jiraBaseUrl, 'issue-steps', issueKey],
    queryFn: async (): Promise<AioTestRunsQueryResult> => {
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
      //
      // Plan 54-07: widened return shape carries both in-cycle runs[] and
      // cross-cycle impactedExecutions[]. The latter populates the no-runs path
      // (Gap 1) and feeds the attachments grid (Gap 2). Cross-cycle fetch is
      // capped per T-54-07-02; in-cycle fetch stays uncapped.
      if (jiraNumericId !== null) {
        const projects = await fetchAioProjects(jiraBaseUrl, token);
        const aioProject = projects.find((p) => p.projectKey === projectKey);
        if (!aioProject) return null;

        const linkedTestCases = await fetchAioTraceabilityTestCases(
          jiraBaseUrl,
          token,
          aioProject.id,
          jiraNumericId,
          'defect',
        );
        if (linkedTestCases.length === 0) return null;

        // Flatten linked test cases into (testCase, runRef) pairs. Each linked
        // test case carries an embedded run reference (runId + cycleKey) from
        // the widened traceability response — no cycle scan needed.
        const allRefs = linkedTestCases.flatMap((tc) =>
          tc.runs.map((r) => ({ testCase: tc, runRef: r })),
        );
        if (allRefs.length === 0) {
          return { runs: [], impactedExecutions: [] };
        }

        // T-54-07-02: partition refs by "primary" cycle (most frequent
        // cycleKey, tie-broken by highest CY-N numeric suffix). In-cycle
        // refs (cycleKey === primaryCycleKey) are fetched UNCAPPED via the
        // existing Promise.all from 54-06 — preserving today's behaviour
        // where every in-cycle linked run renders. Cross-cycle refs are
        // capped at MAX_IMPACTED_EXECUTIONS=20 and fetched in chunks of
        // MAX_PARALLEL=6 to bound fan-out on pathological traceability
        // responses (no-runs path; see threat register).
        const cycleCounts = new Map<string, number>();
        for (const { runRef } of allRefs) {
          cycleCounts.set(runRef.cycleKey, (cycleCounts.get(runRef.cycleKey) ?? 0) + 1);
        }
        const cycleNum = (key: string) => {
          const m = key.match(/CY-(\d+)$/);
          return m ? parseInt(m[1], 10) : -1;
        };
        const primaryCycleKey =
          [...cycleCounts.entries()].sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return cycleNum(b[0]) - cycleNum(a[0]);
          })[0]?.[0] ?? '';

        const inCycleRefs = allRefs.filter((r) => r.runRef.cycleKey === primaryCycleKey);
        const crossCycleRefs = allRefs
          .filter((r) => r.runRef.cycleKey !== primaryCycleKey)
          .slice(0, MAX_IMPACTED_EXECUTIONS); // T-54-07-02 cap (cross-cycle ONLY)

        // In-cycle: uncapped Promise.all (54-06 behaviour preserved).
        // Plan 54-11 status-bug fix: the detail-fetch projectKey must be
        // derived from the cycle key (e.g. ESHOP-CY-759 → 'ESHOP'), NOT from
        // the parent issue's projectKey. Round-3 UAT diagnostic confirmed:
        // a VTE-* issue with an ESHOP-CY-759 impacted execution hit URL
        // `/project/VTE/testcycle/ESHOP-CY-759/...` → 'No Cycle found' → null
        // → status defaulted to NOT_EXECUTED ('Not Run') on every cross-project
        // row. Derive per-cycle so cross-project routing works.
        const inCycleResults = await Promise.all(
          inCycleRefs.map(async ({ testCase, runRef }) => {
            const cycleProjectKey = runRef.cycleKey.split('-')[0] || projectKey;
            const detail = await fetchAioTestRunDetail(
              jiraBaseUrl,
              token,
              cycleProjectKey,
              runRef.cycleKey,
              runRef.runId,
            );
            return { testCase, runRef, detail };
          }),
        );

        // Cross-cycle: chunked-parallel, MAX_PARALLEL=6 in flight per slice.
        // T-54-07-02 mitigation — prevents runaway fan-out on the no-runs
        // path when traceability returns many cross-cycle items.
        const crossCycleResults: Array<{
          testCase: AioTestCaseWithRuns;
          runRef: AioTraceabilityRunRef;
          detail: { run: AioTestRun; steps: AioTestRunStep[] } | null;
        }> = [];
        for (let i = 0; i < crossCycleRefs.length; i += MAX_PARALLEL) {
          const chunk = crossCycleRefs.slice(i, i + MAX_PARALLEL);
          const chunkResults = await Promise.all(
            chunk.map(async ({ testCase, runRef }) => {
              // Plan 54-11: per-cycle projectKey (see in-cycle comment above).
              const cycleProjectKey = runRef.cycleKey.split('-')[0] || projectKey;
              const detail = await fetchAioTestRunDetail(
                jiraBaseUrl,
                token,
                cycleProjectKey,
                runRef.cycleKey,
                runRef.runId,
              );
              return { testCase, runRef, detail };
            }),
          );
          crossCycleResults.push(...chunkResults);
        }

        // Plan 54-08 Gap 1: split inCycleResults into withSteps (→ data.runs,
        // rendered via StepTable / CollapsibleRunBlock) and withoutSteps
        // (→ data.impactedExecutions, rendered via ImpactedExecutionsList).
        // The old behaviour silently dropped detail===null OR
        // detail.steps.length===0 results at this point — that hid the whole
        // section on single-cycle issues whose runs have empty testRunSteps[]
        // (e.g. ESHOP-393120 passing runs). Promoting them into
        // impactedExecutions[] keeps the row rendered with a status chip
        // driven by detail.run.status (NOT defaulted to gray "Not Run").
        const inCycleWithSteps = inCycleResults.filter(
          (
            r,
          ): r is typeof r & {
            detail: NonNullable<typeof r.detail>;
          } => r.detail !== null && r.detail.steps.length > 0,
        );
        const inCycleWithoutSteps = inCycleResults.filter(
          (r) => r.detail === null || (r.detail !== null && r.detail.steps.length === 0),
        );

        const runs: AioIssueRunData[] = inCycleWithSteps.map((r) => ({
          run: {
            ...r.detail.run,
            testCaseKey: r.detail.run.testCaseKey || r.testCase.key,
          },
          testCase: r.testCase,
          steps: r.detail.steps,
        }));

        // Cross-cycle results (unchanged) + in-cycle promotions (Plan 54-08
        // Gap 1) → render via ImpactedExecutionsList on the no-runs path.
        // Status is sourced from detail.run.status (already normalised by
        // toRunChipStatus); when the detail fetch returned null (404),
        // default to NOT_EXECUTED so the row still renders with a sensible
        // chip. Order: cross-cycle FIRST (preserves Plan 54-07 ordering),
        // in-cycle promotions appended after.
        const inCycleAsImpacted: AioImpactedExecution[] = inCycleWithoutSteps.map((r) => ({
          testCase: r.testCase,
          runRef: r.runRef,
          status: r.detail?.run.status ?? 'NOT_EXECUTED',
          steps: r.detail?.steps ?? [],
        }));

        const impactedExecutions: AioImpactedExecution[] = [
          ...crossCycleResults.map((r) => ({
            testCase: r.testCase,
            runRef: r.runRef,
            status: r.detail?.run.status ?? 'NOT_EXECUTED',
            steps: r.detail?.steps ?? [],
          })),
          ...inCycleAsImpacted,
        ];

        return { runs, impactedExecutions };
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
      if (!activeCycle) return { runs: [], impactedExecutions: [] };

      const allRuns = await fetchAioTestRunsForCycle(
        jiraBaseUrl,
        token,
        projectKey,
        activeCycle.key,
      );
      const testCaseKeys = new Set(linkedTestCases.map((tc) => tc.key));
      const matchedRuns = allRuns.filter((r) => testCaseKeys.has(r.testCaseKey));
      if (matchedRuns.length === 0) return { runs: [], impactedExecutions: [] };

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
      return { runs: withSteps, impactedExecutions: [] };
    },
    enabled: !!jiraBaseUrl && !!issueKey && !!aioEnabled,
    staleTime: 30_000,
  });

  const showSkeleton = useDelayedLoading(stepsQuery.isLoading);
  // Plan 54-07 Gap 2: aggregate inline image attachments from BOTH the in-cycle
  // runs (data.runs) AND the cross-cycle impacted-executions step data. The
  // grid then populates uniformly on both render paths; T-54-07-02 cap on the
  // cross-cycle fetch ensures the aggregation set is bounded.
  // Computed BEFORE any conditional returns to honour the Rules of Hooks.
  const aioAttachments = useMemo(() => {
    // Plan 54-10: extract image refs from the Jira issue description body too,
    // so the grid is a unified surface for "all AIO images on this issue" (not
    // just test-run step content). Description-derived refs are listed first
    // so the dedup-by-URL chain prefers the description as the canonical
    // source when an image appears in both surfaces.
    const descriptionImages = extractInlineImageAttachments(description);
    const data = stepsQuery.data;
    if (!data) return descriptionImages;
    // Adapt impactedExecutions to the AioIssueRunData shape collectAioImageAttachments
    // expects. Run shape is synthesised from runRef + status; only `steps` is
    // consulted by the collector.
    const impactedAsRunData: AioIssueRunData[] = data.impactedExecutions.map((ie) => ({
      run: {
        id: ie.runRef.runId,
        status: ie.status,
        testCaseKey: ie.testCase.key,
        cycleKey: ie.runRef.cycleKey,
      },
      testCase: ie.testCase,
      steps: ie.steps,
    }));
    const runImages = collectAioImageAttachments([...data.runs, ...impactedAsRunData]);
    const seen = new Set<string>();
    return [...descriptionImages, ...runImages].filter((a) => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });
  }, [stepsQuery.data, description]);

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

  const hasInCycleRuns = data.runs.length > 0;
  const hasImpactedExecutions = data.impactedExecutions.length > 0;

  // Data available — render section. AioAttachmentsGrid is rendered on ALL
  // THREE render arms (single call site) so the header is always visible
  // whenever AIO data is present (Gap 2 contract — Plan 54-08 narrowed the
  // line-606 guard). The grid's internal empty-state covers the case where
  // no inline image refs were found. The "No executions resolved" third arm
  // (linked cases exist but neither in-cycle runs nor impacted executions
  // resolved — transient 404 or missing testRun.ID) is the new contract-
  // honesty branch.
  return (
    <section aria-label="AIO Test Runs" className="mt-6" data-testid="aio-test-runs-section">
      <div className="flex items-center gap-1.5 text-sm font-semibold mb-2">
        <FlaskConical className="size-3.5 text-muted-foreground" />
        AIO Test Runs
      </div>
      {hasInCycleRuns ? (
        // Plan 54-11 follow-up: render single-run case via CollapsibleRunBlock
        // too (user request 2026-05-14) so the UX is consistent — collapsible
        // header + status chip whether there's 1 run or many. PASS runs start
        // collapsed (D-10); FAIL/BLOCKED start expanded.
        <div>
          {data.runs.map((item) => (
            <CollapsibleRunBlock key={item.run.id} {...item} issueKey={issueKey} />
          ))}
        </div>
      ) : hasImpactedExecutions ? (
        <ImpactedExecutionsList rows={data.impactedExecutions} issueKey={issueKey} />
      ) : (
        <p className="text-xs text-muted-foreground italic" data-testid="aio-no-executions-notice">
          No executions resolved for the linked test cases yet.
        </p>
      )}
      <AioAttachmentsGrid attachments={aioAttachments} />
    </section>
  );
}

/**
 * Plan 54-07 Gap 1 — list of cross-cycle impacted executions.
 * Rendered in place of the bare "No test runs in active cycle" EmptyState
 * when linked test cases exist but none of their runs are in the active
 * (primary) cycle. Each row shows test case key + title, cycle key, run ID,
 * and a status chip whose color is driven by the per-row fetched status
 * (NOT defaulted to gray "Not Run" on the render layer). Plan 54-11: two
 * click targets per row — cycle key cell links to the in-app cycle detail
 * page; run ID cell links to the new in-app run detail page. Both targets
 * derive the projectKey from `cycleKey.split('-')[0]` so cross-project
 * navigation works correctly (the parent issue's projectKey can differ
 * from the cycle's project — round-3 UAT bug fix).
 */
function ImpactedExecutionsList({
  rows,
  issueKey,
}: {
  rows: AioImpactedExecution[];
  issueKey: string;
}) {
  const navigate = useNavigate();
  const breadcrumbReset = useBreadcrumbStore((s) => s.reset);
  const breadcrumbPush = useBreadcrumbStore((s) => s.push);
  const navigateFromIssue = (href: string) => {
    breadcrumbReset();
    breadcrumbPush({ path: `/issue/${issueKey}`, label: issueKey });
    navigate(href);
  };
  return (
    <div className="border border-border rounded-md">
      <div className="px-4 py-2 border-b border-border bg-muted/10 text-xs font-semibold text-muted-foreground">
        Impacted executions (across all cycles)
      </div>
      <table className="w-full text-sm" aria-label="Impacted executions">
        <thead className="sr-only">
          <tr>
            <th>Test case</th>
            <th>Cycle</th>
            <th>Run</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            // Plan 54-11 cross-project routing: derive the cycle's project
            // from the cycle key (e.g. ESHOP-CY-759 → 'ESHOP'). The parent
            // issue's projectKey is NOT correct for cross-project cycles.
            const cycleProjectKey = row.runRef.cycleKey.split('-')[0] || '';
            const cycleHref = `/aio-cycle/${cycleProjectKey}/${row.runRef.cycleKey}`;
            const runHref = `${cycleHref}/run/${row.runRef.runId}`;
            return (
              <tr
                key={`${row.testCase.key}:${row.runRef.runId}`}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    <FlaskConical className="size-3.5 text-muted-foreground" />
                    <span className="font-mono text-xs">{row.testCase.key}</span>
                    {row.testCase.title && (
                      <span className="text-muted-foreground text-xs">— {row.testCase.title}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => navigateFromIssue(cycleHref)}
                    data-testid="impacted-execution-cycle-link"
                    className="hover:text-foreground hover:underline"
                  >
                    {row.runRef.cycleKey}
                  </button>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => navigateFromIssue(runHref)}
                    data-testid="impacted-execution-run-link"
                    className="hover:text-foreground hover:underline"
                  >
                    {row.runRef.runId}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <span
                    data-testid="impacted-execution-status-chip"
                    className={aioRunStatusPillClass(row.status)}
                  >
                    {normalizeStatusLabel(row.status)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
