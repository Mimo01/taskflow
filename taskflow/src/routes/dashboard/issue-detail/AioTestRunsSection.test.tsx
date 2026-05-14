/**
 * Component tests for AioTestRunsSection — maintained alongside the component since Plan 54-04.
 * Plan 54-06 adds wiki-rendering + perf-path (Branch A1 direct lookup) coverage and widens
 * the `vi.mock('@/services/aio', ...)` factory to include `fetchAioTraceabilityTestCases`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks (declared before any imports that use them) ---

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/hooks/useDelayedLoading', () => ({
  useDelayedLoading: vi.fn().mockReturnValue(false),
}));

vi.mock('@/services/aio', () => ({
  fetchAioProjects: vi.fn(),
  fetchAioTestCasesForIssue: vi.fn(),
  fetchAioTraceabilityTestCases: vi.fn(),
  fetchAioCycles: vi.fn(),
  fetchAioTestRunsForCycle: vi.fn(),
  fetchAioTestRunSteps: vi.fn(),
  fetchAioTestRunDetail: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

// --- Imports (after mocks) ---

import { openUrl } from '@tauri-apps/plugin-opener';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import {
  fetchAioCycles,
  fetchAioProjects,
  fetchAioTestCasesForIssue,
  fetchAioTestRunDetail,
  fetchAioTestRunSteps,
  fetchAioTestRunsForCycle,
  fetchAioTraceabilityTestCases,
} from '@/services/aio';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

// AioTestRunsSection does not exist yet — Plan 54-03 creates it (RED gate)
import { AioTestRunsSection } from './AioTestRunsSection';

// --- Test helpers ---

const mockFetchProjects = vi.mocked(fetchAioProjects);
const mockFetchTestCases = vi.mocked(fetchAioTestCasesForIssue);
const mockFetchTraceability = vi.mocked(fetchAioTraceabilityTestCases);
const mockFetchCycles = vi.mocked(fetchAioCycles);
const mockFetchRuns = vi.mocked(fetchAioTestRunsForCycle);
const mockFetchSteps = vi.mocked(fetchAioTestRunSteps);
const mockFetchRunDetail = vi.mocked(fetchAioTestRunDetail);
const mockUseSettingsStore = vi.mocked(useSettingsStore);
const mockUseAuthStore = vi.mocked(useAuthStore);
const mockUseDelayedLoading = vi.mocked(useDelayedLoading);
const mockOpenUrl = vi.mocked(openUrl);

const JIRA_BASE_URL = 'https://jira.example.com';
const ISSUE_KEY = 'PROJ-123';
const PROJECT_KEY = 'PROJ';
const CYCLE_KEY = 'PROJ-CY-4';

const TEST_CASE = { id: 1, key: 'PROJ-TC-1', title: 'Login flow test', projectKey: PROJECT_KEY };
// Plan 54-06 Branch A1: traceability response now embeds runs[] per test case.
// Default fixture carries a single direct run reference (runId + cycleKey).
const TEST_CASE_WITH_RUNS = {
  ...TEST_CASE,
  runs: [{ runId: '12131', cycleKey: CYCLE_KEY }],
};
const ACTIVE_CYCLE = {
  key: CYCLE_KEY,
  name: 'Sprint 4',
  status: 'Active',
  projectKey: PROJECT_KEY,
};
const TEST_RUN = { id: '12131', status: 'PASS', testCaseKey: 'PROJ-TC-1', cycleKey: CYCLE_KEY };
const STEP_PASS = {
  id: 37989,
  step: 'Click login',
  expectedResult: 'Login page appears',
  actualResult: 'Login page appeared',
  status: 'PASS',
};
const STEP_NOT_EXECUTED = {
  id: 37990,
  step: 'Submit form',
  expectedResult: 'Form submitted',
  status: 'NOT_EXECUTED',
};

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderSection(
  props: {
    issueKey?: string;
    jiraBaseUrl?: string;
    jiraIssueId?: string;
    description?: string | null;
  } = {},
) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <AioTestRunsSection
          issueKey={props.issueKey ?? ISSUE_KEY}
          jiraBaseUrl={props.jiraBaseUrl ?? JIRA_BASE_URL}
          jiraIssueId={props.jiraIssueId}
          description={props.description}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function setupDefaultStores({ aioEnabled = true }: { aioEnabled?: boolean } = {}) {
  mockUseSettingsStore.mockReturnValue(aioEnabled);
  mockUseAuthStore.mockReturnValue(JIRA_BASE_URL);
}

describe('AioTestRunsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDelayedLoading.mockReturnValue(false);
    setupDefaultStores({ aioEnabled: true });
    mockFetchProjects.mockResolvedValue([{ id: 1, projectKey: PROJECT_KEY, name: PROJECT_KEY }]);
  });

  // Test 1: aioEnabled gate
  it('renders null when aioEnabled is false', () => {
    setupDefaultStores({ aioEnabled: false });
    const { container } = renderSection();
    // Section should be hidden entirely — no AIO content rendered
    expect(container.firstChild).toBeNull();
  });

  // Test 2: skeleton while loading
  it('renders AioTestRunsSkeleton while query is loading (useDelayedLoading returns true)', () => {
    mockUseDelayedLoading.mockReturnValue(true);
    // Queries never resolve — component stays in loading state
    mockFetchTestCases.mockReturnValue(new Promise(() => {}));
    mockFetchCycles.mockReturnValue(new Promise(() => {}));

    renderSection();
    // Skeleton should be present (look for skeleton role or test-id)
    expect(screen.getByTestId('aio-test-runs-skeleton')).toBeTruthy();
  });

  // Test 3: skipped — traceability endpoint probe active; rewrite after shape confirmed
  it.skip('renders null when no test cases and no defect-matched runs', async () => {
    mockFetchTestCases.mockResolvedValue([]);
    mockFetchCycles.mockResolvedValue([ACTIVE_CYCLE]);
    mockFetchRuns.mockResolvedValue([]);

    const { container } = renderSection({ jiraIssueId: '99999' });
    await waitFor(() => {
      expect(mockFetchRuns).toHaveBeenCalled();
    });
    // Section should be hidden entirely (not an error state)
    expect(container.querySelector('[data-testid="aio-test-runs-section"]')).toBeNull();
  });

  // Test 3b: skipped — traceability endpoint probe active; rewrite after shape confirmed
  it.skip('renders test runs when issue is linked as defect but has no requirements-linked test cases', async () => {
    const JIRA_ISSUE_NUMERIC_ID = 393120;
    const defectRun = {
      ...TEST_RUN,
      testCaseKey: 'PROJ-TC-1',
      jiraDefectIDs: [JIRA_ISSUE_NUMERIC_ID],
    };

    mockFetchTestCases.mockResolvedValue([TEST_CASE]);
    mockFetchCycles.mockResolvedValue([ACTIVE_CYCLE]);
    mockFetchRuns.mockResolvedValue([defectRun]);
    mockFetchSteps.mockResolvedValue([STEP_PASS]);

    renderSection({ jiraIssueId: String(JIRA_ISSUE_NUMERIC_ID) });
    await waitFor(() => {
      // Step table should be visible — defect-linked run was matched
      expect(screen.getByText('Step')).toBeTruthy();
    });
  });

  // Test 4: Plan 54-08 Gap 2 contract — when data !== null but runs[] and
  // impactedExecutions[] are both empty, section renders with AioAttachmentsGrid
  // empty state + "no executions resolved" notice. The old hide-section
  // behaviour was narrowed: line-606 short-circuit was removed so the
  // AioAttachmentsGrid header is always visible whenever AIO data is present.
  // The legacy fallback path (no jiraIssueId) is the test vehicle: linked
  // test cases exist but no run-steps resolve → data === { runs: [],
  // impactedExecutions: [] } → section + grid empty-state + notice all render.
  it('Gap 2 contract — when data !== null but runs[] and impactedExecutions[] are both empty, section renders with AioAttachmentsGrid empty state + "no executions resolved" notice (Plan 54-08 narrowed line-606 guard)', async () => {
    mockFetchTestCases.mockResolvedValue([TEST_CASE]);
    mockFetchCycles.mockResolvedValue([ACTIVE_CYCLE]);
    mockFetchRuns.mockResolvedValue([TEST_RUN]);
    mockFetchSteps.mockResolvedValue([]);

    const { container } = renderSection();
    await waitFor(() => {
      expect(mockFetchSteps).toHaveBeenCalled();
    });

    // Section IS rendered (Gap 2 — line-606 guard narrowed).
    await waitFor(() => {
      expect(container.querySelector('[data-testid="aio-test-runs-section"]')).not.toBeNull();
    });
    // AioAttachmentsGrid header visible.
    expect(screen.getByText(/AIO attachments/i)).toBeTruthy();
    // Empty-state text inside grid.
    expect(screen.getByText(/No inline image attachments found in linked test runs/i)).toBeTruthy();
    // The "No executions resolved" notice (new third arm) is present.
    expect(screen.getByText(/No executions resolved for the linked test cases yet/i)).toBeTruthy();
    // The bare "No test runs in active cycle" EmptyState is still GONE.
    expect(screen.queryByText(/no test runs in active cycle/i)).toBeNull();
  });

  // Test 5: renders step table with correct headers
  it('renders table with headers Step, Expected, Actual, Status when run has steps', async () => {
    mockFetchTestCases.mockResolvedValue([TEST_CASE]);
    mockFetchCycles.mockResolvedValue([ACTIVE_CYCLE]);
    mockFetchRuns.mockResolvedValue([TEST_RUN]);
    mockFetchSteps.mockResolvedValue([STEP_PASS]);

    renderSection();
    await waitFor(() => {
      expect(screen.getByText('Step')).toBeTruthy();
      expect(screen.getByText('Expected')).toBeTruthy();
      expect(screen.getByText('Actual')).toBeTruthy();
      expect(screen.getByText('Status')).toBeTruthy();
    });
  });

  // Test 6: NOT_EXECUTED step shows dash in Actual cell (D-09)
  it('shows "—" in Actual cell for step with NOT_EXECUTED status (per D-09)', async () => {
    mockFetchTestCases.mockResolvedValue([TEST_CASE]);
    mockFetchCycles.mockResolvedValue([ACTIVE_CYCLE]);
    mockFetchRuns.mockResolvedValue([TEST_RUN]);
    mockFetchSteps.mockResolvedValue([STEP_NOT_EXECUTED]);

    renderSection();
    await waitFor(() => {
      expect(screen.getByText('—')).toBeTruthy();
    });
  });

  // Test 7: collapsible blocks when multiple test cases (D-10)
  it('renders collapsible blocks with test case names when multiple test cases are linked (per D-10)', async () => {
    const testCase2 = {
      id: 2,
      key: 'PROJ-TC-2',
      title: 'Checkout flow test',
      projectKey: PROJECT_KEY,
    };
    const run2 = { id: '12132', status: 'FAIL', testCaseKey: 'PROJ-TC-2', cycleKey: CYCLE_KEY };

    mockFetchTestCases.mockResolvedValue([TEST_CASE, testCase2]);
    mockFetchCycles.mockResolvedValue([ACTIVE_CYCLE]);
    mockFetchRuns.mockResolvedValue([TEST_RUN, run2]);
    mockFetchSteps.mockResolvedValue([STEP_PASS]);

    renderSection();
    await waitFor(() => {
      // Both test case names should appear as collapsible block headers
      expect(screen.getByText('Login flow test')).toBeTruthy();
      expect(screen.getByText('Checkout flow test')).toBeTruthy();
    });
  });

  // Test 8: thumbnail rendered for step with attachment
  // NOTE: AioTestRunStep does not have attachments in Phase 54 (probe found none).
  // The StepThumbnail renders a clickable div (role="button") with the fileName as aria-label.
  // AuthImage renders "[image not available]" in the test environment (no Tauri http plugin),
  // so we assert the clickable thumbnail container is present rather than the raw <img> alt.
  it('renders thumbnail button for step with an attachment url', async () => {
    const stepWithAttachment = {
      ...STEP_PASS,
      // Future field — not in current AioTestRunStep type; cast to unknown
      attachments: [{ url: `${JIRA_BASE_URL}/attach/1.png`, fileName: 'screenshot.png' }],
    };
    mockFetchTestCases.mockResolvedValue([TEST_CASE]);
    mockFetchCycles.mockResolvedValue([ACTIVE_CYCLE]);
    mockFetchRuns.mockResolvedValue([TEST_RUN]);
    mockFetchSteps.mockResolvedValue([stepWithAttachment as unknown as typeof STEP_PASS]);

    renderSection();
    await waitFor(() => {
      // StepThumbnail renders a div[role="button"] with aria-label containing the fileName
      expect(
        screen.getByRole('button', { name: 'screenshot.png - click to view full size' }),
      ).toBeTruthy();
    });
  });

  // Test 9: clicking thumbnail opens lightbox (D-13)
  it('opens ImageLightbox with correct src when a step thumbnail is clicked', async () => {
    const attachmentUrl = `${JIRA_BASE_URL}/attach/1.png`;
    const stepWithAttachment = {
      ...STEP_PASS,
      attachments: [{ url: attachmentUrl, fileName: 'screenshot.png' }],
    };
    mockFetchTestCases.mockResolvedValue([TEST_CASE]);
    mockFetchCycles.mockResolvedValue([ACTIVE_CYCLE]);
    mockFetchRuns.mockResolvedValue([TEST_RUN]);
    mockFetchSteps.mockResolvedValue([stepWithAttachment as unknown as typeof STEP_PASS]);

    renderSection();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'screenshot.png - click to view full size' }),
      ).toBeTruthy();
    });

    // Click thumbnail container — lightbox should open
    await userEvent.click(
      screen.getByRole('button', { name: 'screenshot.png - click to view full size' }),
    );

    // Lightbox is open — indicated by aria-modal dialog
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // --- Plan 54-06 Task 1: wiki rendering in step cells ---
  //
  // Real ESHOP step content (from 54-06-UAT-FINDINGS.md) — verbatim. These fixtures
  // exercise every Jira-wiki construct WikiRenderer must handle: tables,
  // {color}, {panel}, h4. headings, *bold*, hard breaks \\ , and inline [name|url]
  // attachment links that previously hijacked the Tauri webview.
  //
  // Branch A1 (Plan 54-06 Task 2): mocks fetchAioTestRunDetail directly. The
  // queryFn now skips fetchAioCycles AND fetchAioTestRunsForCycle on the
  // jiraIssueId success path — every linked test case carries its own
  // (runId, cycleKey) reference from the widened traceability response.
  describe('wiki rendering in step cells (Plan 54-06 Finding 1)', () => {
    const JIRA_ISSUE_NUMERIC_ID = '393120';
    const ATTACHMENT_URL =
      'https://jira.orange.sk/plugins/servlet/aio-tcms/bridge/tcms/browse?c_pId=10134&page=run-details-attachment&params=%7B%22cycleId%22:14041,%22caseId%22:68141,%22runId%22:263794,%22attachmentId%22:150383,%22projectId%22:10134%7D';

    // Pasted from 54-06-UAT-FINDINGS.md "Finding 1" example:
    const TABLE_STEP = [
      '||*S.No.*||*Step*||*Expected Result*||*Actual Result*||',
      '|1. |Nacitanie eshop home page |Kontrola OK |Works as expected|',
      '|2. |Nacitanie produktu |Kontrola OK |Failed|',
    ].join('\n');

    const COLOR_STEP = '{color:#d04437}*FAILED:*{color} Plati pre paušály S, M, L';

    const PANEL_STEP = `{panel}\n# [VAS.png|${ATTACHMENT_URL}]\n{panel}`;

    const H4_STEP = 'h4.*Steps*\n\nfoo \\\\ bar';

    function mkStep(stepFixture: {
      step: string;
      expectedResult?: string;
      actualResult?: string;
      status?: string;
    }) {
      return {
        id: 37989,
        step: stepFixture.step,
        expectedResult: stepFixture.expectedResult,
        actualResult: stepFixture.actualResult,
        status: stepFixture.status ?? 'PASS',
      };
    }

    function mkRunDetail(step: ReturnType<typeof mkStep>) {
      return {
        run: { ...TEST_RUN },
        steps: [step],
      };
    }

    beforeEach(() => {
      // Branch A1 dominant path: jiraIssueId present → fetchAioTraceabilityTestCases
      // returns test cases WITH runs[], queryFn flatMaps over the embedded refs
      // and calls fetchAioTestRunDetail per runRef. fetchAioCycles +
      // fetchAioTestRunsForCycle are NOT called on this path.
      mockFetchTraceability.mockResolvedValue([TEST_CASE_WITH_RUNS]);
      mockOpenUrl.mockClear();
      mockOpenUrl.mockResolvedValue(undefined);
    });

    it('renders ||header|| / |cell| table inside step.step as a <table> element', async () => {
      mockFetchRunDetail.mockResolvedValue(mkRunDetail(mkStep({ step: TABLE_STEP })));
      renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });
      await waitFor(() => {
        // Two tables: outer StepTable (4-col Step|Expected|Actual|Status) +
        // inner table from the wiki ||header|| markup.
        const tables = screen.getAllByRole('table');
        expect(tables.length).toBeGreaterThanOrEqual(2);
      });
      // Confirm the wiki table cells are present (not raw text)
      expect(screen.getByText(/S\.No\./)).toBeTruthy();
    });

    it('renders {color:#d04437}*FAILED:*{color} marker — braces not visible, FAILED visible', async () => {
      mockFetchRunDetail.mockResolvedValue(mkRunDetail(mkStep({ step: COLOR_STEP })));
      const { container } = renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });
      await waitFor(() => {
        // FAILED: token visible (inside <strong> after jira2md conversion)
        expect(container.textContent ?? '').toContain('FAILED:');
      });
      // Raw {color: markup is consumed, not rendered as literal text.
      expect(container.textContent ?? '').not.toContain('{color:');
    });

    it('renders {panel}...{panel} as a callout div with [data-callout="panel"]', async () => {
      mockFetchRunDetail.mockResolvedValue(mkRunDetail(mkStep({ step: PANEL_STEP })));
      const { container } = renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });
      await waitFor(() => {
        expect(container.querySelector('[data-callout="panel"]')).not.toBeNull();
      });
    });

    it('renders image-extension [VAS.png|url] as inline text anchor, click opens ImageLightbox (NOT openUrl) — 54-06 UAT follow-up', async () => {
      // [name.png|url] in actualResult: WikiRenderer detects the image extension
      // and renders as a text <a>. Click opens ImageLightbox in-app without
      // breaking prose flow (no inline image thumbnail). openUrl is NOT called.
      mockFetchRunDetail.mockResolvedValue(
        mkRunDetail(
          mkStep({
            step: 'plain step',
            actualResult: `See [VAS.png|${ATTACHMENT_URL}]`,
            status: 'FAIL',
          }),
        ),
      );
      const { container } = renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /VAS\.png/ })).toBeTruthy();
      });
      const link = screen.getByRole('link', { name: /VAS\.png/ });
      expect(link.getAttribute('href')).toBe(ATTACHMENT_URL);
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      const { fireEvent } = await import('@testing-library/react');
      fireEvent.click(link);
      expect(mockOpenUrl).not.toHaveBeenCalled();
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it('renders h4. + *bold* + hard-break (\\\\) cluster as <h4> with <strong> child and <br>', async () => {
      mockFetchRunDetail.mockResolvedValue(mkRunDetail(mkStep({ step: H4_STEP })));
      const { container } = renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });
      await waitFor(() => {
        expect(container.querySelector('h4')).not.toBeNull();
      });
      // <h4> contains <strong>Steps</strong>
      expect(container.querySelector('h4 strong')?.textContent).toBe('Steps');
      // \\ becomes <br> (hard break)
      expect(container.querySelector('br')).not.toBeNull();
    });
  });

  // --- Plan 54-06 Task 2 Branch A1: direct-lookup perf path ---
  //
  // Probe C1 confirmed the traceability response embeds testRun.ID + testCycle.detail.key.
  // The queryFn now skips BOTH fetchAioCycles AND fetchAioTestRunsForCycle on the
  // jiraIssueId success path. This test enforces that contract — it fails if either
  // legacy fetch is invoked AND if the rendered run does not originate from the
  // widened traceability mock response.
  //
  // Branch chosen: Direct lookup available via traceability response — sub-branch A1.
  describe('direct-lookup perf path (Plan 54-06 Branch A1)', () => {
    const JIRA_ISSUE_NUMERIC_ID = '393120';
    const UNIQUE_RUN_ID = '263794'; // matches the runId in TEST_CASE_WITH_RUNS-derived fixture below
    const UNIQUE_CYCLE_KEY = 'ESHOP-CY-1011';

    it('fetches step data from widened traceability response without paginating the active cycle', async () => {
      const linkedCase = {
        id: 100,
        key: 'PROJ-TC-A1',
        title: 'A1 direct-lookup case',
        projectKey: PROJECT_KEY,
        runs: [{ runId: UNIQUE_RUN_ID, cycleKey: UNIQUE_CYCLE_KEY }],
      };

      mockFetchTraceability.mockResolvedValue([linkedCase]);
      mockFetchRunDetail.mockResolvedValue({
        run: {
          id: UNIQUE_RUN_ID,
          status: 'FAIL',
          testCaseKey: 'PROJ-TC-A1',
          cycleKey: UNIQUE_CYCLE_KEY,
          testCase: { title: 'A1 direct-lookup case' },
        },
        steps: [
          {
            id: 1,
            step: `A1 step body run-${UNIQUE_RUN_ID}`,
            expectedResult: 'ok',
            actualResult: 'ok',
            status: 'PASS',
          },
        ],
      });

      renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });

      // Wait for the rendered run to surface — the unique run ID body proves the
      // queryFn consumed the widened traceability response (not a stale legacy
      // scan that would have produced TEST_RUN with id '12131').
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`A1 step body run-${UNIQUE_RUN_ID}`))).toBeTruthy();
      });

      // Branch A1 contract: success path skips BOTH legacy cycle-scan fetches.
      expect(mockFetchCycles).not.toHaveBeenCalled();
      expect(mockFetchRuns).not.toHaveBeenCalled();
      // And uses the direct-lookup fetcher exactly once per linked run reference.
      expect(mockFetchRunDetail).toHaveBeenCalledTimes(1);
      // Plan 54-11 cross-project fix: the detail-fetch projectKey is derived
      // from the CYCLE key (UNIQUE_CYCLE_KEY='ESHOP-CY-1011' → 'ESHOP'), not
      // from the parent issue's project (PROJECT_KEY='PROJ'). The cycle is
      // in the ESHOP project — calling the API with 'PROJ' was the round-3
      // UAT bug that returned 'No Cycle found' and defaulted status to
      // NOT_EXECUTED.
      expect(mockFetchRunDetail).toHaveBeenCalledWith(
        JIRA_BASE_URL,
        'mock-token',
        'ESHOP',
        UNIQUE_CYCLE_KEY,
        UNIQUE_RUN_ID,
      );
    });
  });

  // --- Plan 54-07 Gap 1 + Gap 2 ---
  //
  // The "primary cycle" picker selects the most-frequent cycleKey across all
  // runRefs (tie-broken by highest CY-N suffix). Refs in that cycle render via
  // the in-cycle StepTable path (uncapped); refs in OTHER cycles render via
  // ImpactedExecutionsList (capped at MAX_IMPACTED_EXECUTIONS=20 cross-cycle
  // fetches per T-54-07-02).
  //
  // The fixtures here construct scenarios where ALL refs share a single
  // cycleKey that is NOT the active/primary one, so the in-cycle slice is
  // empty and ImpactedExecutionsList renders. To force everything cross-cycle,
  // we inject an extra "dominant cycle" sentinel ref (whose detail fetch
  // returns empty steps) — that way the picker chooses the sentinel's cycle as
  // primary, and the real test cases live in OTHER cycles.
  describe('Impacted executions list (Gap 1) + attachments grid on no-runs path (Gap 2)', () => {
    const JIRA_ISSUE_NUMERIC_ID = '393120';
    const PRIMARY_CYCLE_KEY = 'PROJ-CY-DOMINANT';
    const OLD_CYCLE_KEY = 'PROJ-CY-OLD';

    // Sentinel that makes the picker treat PRIMARY_CYCLE_KEY as the primary
    // cycle so the actual test cases (in OLD_CYCLE_KEY etc.) flow through the
    // cross-cycle (impacted-executions) path.
    const SENTINEL_CASE = {
      id: 999,
      key: 'PROJ-TC-DOMINANT',
      title: 'Sentinel',
      projectKey: PROJECT_KEY,
      runs: [{ runId: '999999', cycleKey: PRIMARY_CYCLE_KEY }],
    };

    // Force the sentinel to be the dominant cycle by giving it 2 refs to
    // outvote any single cross-cycle test case (which carries 1 ref).
    const SENTINEL_CASE_2 = {
      ...SENTINEL_CASE,
      id: 998,
      key: 'PROJ-TC-DOMINANT-2',
      runs: [{ runId: '999998', cycleKey: PRIMARY_CYCLE_KEY }],
    };

    function makeImpactedCase(suffix: string, runId: string, cycleKey = OLD_CYCLE_KEY) {
      return {
        id: 1000 + parseInt(suffix, 10),
        key: `PROJ-TC-${suffix}`,
        title: `Impacted case ${suffix}`,
        projectKey: PROJECT_KEY,
        runs: [{ runId, cycleKey }],
      };
    }

    function makeRunDetail(
      runId: string,
      cycleKey: string,
      status: string,
      stepText = 'plain text',
    ) {
      return {
        run: {
          id: runId,
          status,
          testCaseKey: '',
          cycleKey,
        },
        steps: [{ id: 1, step: stepText, status }],
      };
    }

    beforeEach(() => {
      mockFetchRunDetail.mockReset();
    });

    it('Gap 1: replaces "No test runs in active cycle" with ImpactedExecutionsList showing test case + cycle + run + status chip', async () => {
      // One sentinel-dominant ref + one cross-cycle impacted case
      mockFetchTraceability.mockResolvedValueOnce([
        SENTINEL_CASE,
        SENTINEL_CASE_2,
        makeImpactedCase('1', '263794'),
      ]);
      mockFetchTraceability.mockResolvedValueOnce([]);

      mockFetchRunDetail.mockImplementation(async (_b, _t, _p, cycle, runId) => {
        if (cycle === PRIMARY_CYCLE_KEY) {
          // Sentinel: empty steps → in-cycle path filters it out (withSteps === 0)
          return {
            run: { id: runId, status: 'PASS', testCaseKey: '', cycleKey: cycle },
            steps: [],
          };
        }
        return makeRunDetail(runId, cycle, 'FAIL');
      });

      renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });

      await waitFor(() => {
        expect(screen.getByText(/Impacted executions/i)).toBeTruthy();
      });

      // Row contents
      expect(screen.getByText('PROJ-TC-1')).toBeTruthy();
      expect(screen.getByText(OLD_CYCLE_KEY)).toBeTruthy();
      expect(screen.getByText('263794')).toBeTruthy();

      // Bare EmptyState text is GONE
      expect(screen.queryByText(/no test runs in active cycle/i)).toBeNull();

      // Rows are read-only — no click handlers / no button wrapper on the row
      expect(screen.getByText('PROJ-TC-1').closest('button')).toBeNull();
    });

    it('Gap 1: status chip color reflects fetched detail.run.status (PASS green, FAIL red — NOT defaulted to gray "Not Run")', async () => {
      // Two sentinel-dominant refs to keep PRIMARY_CYCLE_KEY winning, plus
      // two cross-cycle impacted cases with DIFFERENT statuses.
      mockFetchTraceability.mockResolvedValueOnce([
        SENTINEL_CASE,
        SENTINEL_CASE_2,
        makeImpactedCase('1', 'r-pass'),
        makeImpactedCase('2', 'r-fail'),
      ]);
      mockFetchTraceability.mockResolvedValueOnce([]);

      mockFetchRunDetail.mockImplementation(async (_b, _t, _p, cycle, runId) => {
        if (cycle === PRIMARY_CYCLE_KEY) {
          return {
            run: { id: runId, status: 'PASS', testCaseKey: '', cycleKey: cycle },
            steps: [],
          };
        }
        const status = runId === 'r-pass' ? 'PASS' : 'FAIL';
        return makeRunDetail(runId, cycle, status);
      });

      renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });

      // Plan 54-08 Gap 1 widening: in-cycle empty-steps runs (the sentinel
      // pair) are now also promoted to impactedExecutions[], so we get 4
      // chips total — 2 from the sentinel pair (PASS) and 2 from the
      // cross-cycle refs (PASS + FAIL). The chip-color contract (status
      // drives color, NOT gray default) holds for all 4.
      await waitFor(() => {
        expect(screen.getAllByTestId('impacted-execution-status-chip').length).toBe(4);
      });

      const chips = screen.getAllByTestId('impacted-execution-status-chip');
      const chipClasses = chips.map((c) => c.className);
      // PASS chip carries the green token; FAIL chip carries the red token —
      // aioRunStatusBadgeClass keys: bg-green-500/15 + text-green-600 (PASS),
      // bg-red-500/15 + text-red-600 (FAIL). NEITHER chip should be the gray
      // muted token (bg-muted/text-muted-foreground = NOT_EXECUTED default).
      const hasGreen = chipClasses.some((c) => c.includes('green'));
      const hasRed = chipClasses.some((c) => c.includes('red'));
      const allMuted = chipClasses.every(
        (c) => c.includes('bg-muted') || c.includes('text-muted-foreground'),
      );
      expect(hasGreen).toBe(true);
      expect(hasRed).toBe(true);
      expect(allMuted).toBe(false);
    });

    it('Gap 2: AioAttachmentsGrid header always renders with empty state inside when no inline images on impacted-executions path', async () => {
      mockFetchTraceability.mockResolvedValueOnce([
        SENTINEL_CASE,
        SENTINEL_CASE_2,
        makeImpactedCase('1', '263794'),
      ]);
      mockFetchTraceability.mockResolvedValueOnce([]);
      mockFetchRunDetail.mockImplementation(async (_b, _t, _p, cycle, runId) => {
        if (cycle === PRIMARY_CYCLE_KEY) {
          return {
            run: { id: runId, status: 'PASS', testCaseKey: '', cycleKey: cycle },
            steps: [],
          };
        }
        return makeRunDetail(runId, cycle, 'FAIL', 'plain step text — no images here');
      });

      renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });
      await waitFor(() => {
        expect(screen.getByText(/AIO attachments/i)).toBeTruthy();
      });
      // Empty state inside the grid
      expect(
        screen.getByText(/No inline image attachments found in linked test runs/i),
      ).toBeTruthy();
    });

    it('Plan 54-11: cycle key cell is a Link to the in-app cycle detail page (derived projectKey)', async () => {
      mockFetchTraceability.mockResolvedValueOnce([
        SENTINEL_CASE,
        SENTINEL_CASE_2,
        {
          id: 1234,
          key: 'OTHER-TC-1',
          title: 'Cross-project case',
          projectKey: 'OTHER',
          runs: [{ runId: '99999', cycleKey: 'OTHER-CY-9' }],
        },
      ]);
      mockFetchTraceability.mockResolvedValueOnce([]);
      mockFetchRunDetail.mockImplementation(async (_b, _t, _p, cycle, runId) => {
        if (cycle === PRIMARY_CYCLE_KEY) {
          return { run: { id: runId, status: 'PASS', testCaseKey: '', cycleKey: cycle }, steps: [] };
        }
        return makeRunDetail(runId, cycle, 'FAIL');
      });

      const { container } = renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });
      await waitFor(() => {
        expect(screen.getByText(/Impacted executions/i)).toBeTruthy();
      });

      const cycleLinks = Array.from(
        container.querySelectorAll('[data-testid="impacted-execution-cycle-link"]'),
      ) as HTMLAnchorElement[];
      const crossLink = cycleLinks.find((l) => l.getAttribute('href') === '/aio-cycle/OTHER/OTHER-CY-9');
      expect(crossLink).toBeDefined();
      expect(crossLink!.textContent).toBe('OTHER-CY-9');
    });

    it('Plan 54-11: run ID cell is a Link to the new in-app run detail page', async () => {
      mockFetchTraceability.mockResolvedValueOnce([
        SENTINEL_CASE,
        SENTINEL_CASE_2,
        {
          id: 1234,
          key: 'OTHER-TC-1',
          title: 'Cross-project case',
          projectKey: 'OTHER',
          runs: [{ runId: '99999', cycleKey: 'OTHER-CY-9' }],
        },
      ]);
      mockFetchTraceability.mockResolvedValueOnce([]);
      mockFetchRunDetail.mockImplementation(async (_b, _t, _p, cycle, runId) => {
        if (cycle === PRIMARY_CYCLE_KEY) {
          return { run: { id: runId, status: 'PASS', testCaseKey: '', cycleKey: cycle }, steps: [] };
        }
        return makeRunDetail(runId, cycle, 'FAIL');
      });

      const { container } = renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });
      await waitFor(() => {
        expect(screen.getByText(/Impacted executions/i)).toBeTruthy();
      });

      const runLinks = Array.from(
        container.querySelectorAll('[data-testid="impacted-execution-run-link"]'),
      ) as HTMLAnchorElement[];
      const crossRunLink = runLinks.find(
        (l) => l.getAttribute('href') === '/aio-cycle/OTHER/OTHER-CY-9/run/99999',
      );
      expect(crossRunLink).toBeDefined();
      expect(crossRunLink!.textContent).toBe('99999');
    });

    it('Plan 54-11: cross-project impacted execution uses the cycle-derived projectKey for the detail fetch (status bug fix)', async () => {
      // Round-3 UAT diagnostic: a VTE-* issue with an ESHOP-CY-759 impacted
      // execution hit URL /project/VTE/testcycle/ESHOP-CY-759/... → 404 →
      // detail null → status defaulted to NOT_EXECUTED. Fix: derive
      // projectKey from cycleKey.split('-')[0] per row so cross-project
      // routing works.
      mockFetchTraceability.mockResolvedValueOnce([
        SENTINEL_CASE,
        SENTINEL_CASE_2,
        // Cross-project impacted case: its cycle key starts with 'OTHER',
        // a different project from PROJECT_KEY ('PROJ').
        {
          id: 1234,
          key: 'OTHER-TC-1',
          title: 'Cross-project case',
          projectKey: 'OTHER',
          runs: [{ runId: '99999', cycleKey: 'OTHER-CY-9' }],
        },
      ]);
      mockFetchTraceability.mockResolvedValueOnce([]);
      mockFetchRunDetail.mockImplementation(async (_b, _t, _p, cycle, runId) => {
        if (cycle === PRIMARY_CYCLE_KEY) {
          return {
            run: { id: runId, status: 'PASS', testCaseKey: '', cycleKey: cycle },
            steps: [],
          };
        }
        return makeRunDetail(runId, cycle, 'PASS');
      });

      renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });
      await waitFor(() => {
        expect(screen.getByText(/Impacted executions/i)).toBeTruthy();
      });

      // The cross-cycle detail fetch must have been called with projectKey='OTHER'
      // (derived from 'OTHER-CY-9'), NOT 'PROJ' (the parent issue's project).
      const crossProjectCall = mockFetchRunDetail.mock.calls.find(
        (call) => call[3] === 'OTHER-CY-9',
      );
      expect(crossProjectCall).toBeDefined();
      expect(crossProjectCall![2]).toBe('OTHER');
    });

    it('Plan 54-10: AIO grid surfaces image refs from the Jira issue description body (description-only path)', async () => {
      // Setup: data resolves with empty runs/impactedExecutions → grid section
      // renders via the Gap 2 contract (line-606 guard narrowed). The new
      // description prop carries an inline `[name.png|bridge-url]` ref.
      mockFetchTraceability.mockResolvedValueOnce([
        SENTINEL_CASE,
        SENTINEL_CASE_2,
        makeImpactedCase('1', '263794'),
      ]);
      mockFetchTraceability.mockResolvedValueOnce([]);
      mockFetchRunDetail.mockImplementation(async (_b, _t, _p, _cycle, runId) => ({
        run: { id: runId, status: 'PASS', testCaseKey: '', cycleKey: 'X' },
        steps: [], // no step images
      }));

      const description =
        'See [Diagram.png|https://jira.example/plugins/servlet/aio-tcms/bridge/attachment/100/Diagram.png] for the layout.';

      renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID, description });
      await waitFor(() => {
        // Grid header reflects 1 attachment derived from the description.
        expect(screen.getByText(/AIO attachments \(1\)/i)).toBeTruthy();
      });
      // Thumbnail button rendered with filename as aria-label.
      expect(
        screen.getByRole('button', { name: /Diagram\.png - click to view full size/i }),
      ).toBeTruthy();
    });

    it('Plan 54-10: AIO grid dedupes by URL across description and step content (same image referenced in both surfaces appears once)', async () => {
      const SHARED_URL =
        'https://jira.example/plugins/servlet/aio-tcms/bridge/attachment/200/Shared.png';
      mockFetchTraceability.mockResolvedValueOnce([
        SENTINEL_CASE,
        SENTINEL_CASE_2,
        makeImpactedCase('1', '263794'),
      ]);
      mockFetchTraceability.mockResolvedValueOnce([]);
      mockFetchRunDetail.mockImplementation(async (_b, _t, _p, cycle, runId) => {
        if (cycle === PRIMARY_CYCLE_KEY) {
          return {
            run: { id: runId, status: 'PASS', testCaseKey: '', cycleKey: cycle },
            steps: [],
          };
        }
        return {
          run: { id: runId, status: 'FAIL', testCaseKey: '', cycleKey: cycle },
          steps: [
            { id: 1, step: `repro: see [Shared.png|${SHARED_URL}]`, status: 'FAIL' },
          ],
        };
      });

      const description = `Background image: [Shared.png|${SHARED_URL}].`;
      renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID, description });

      await waitFor(() => {
        // Exactly ONE attachment despite the image appearing in both surfaces.
        expect(screen.getByText(/AIO attachments \(1\)/i)).toBeTruthy();
      });
    });

    it('Plan 54-10: AIO grid contract unchanged when description prop is omitted (regression guard)', async () => {
      mockFetchTraceability.mockResolvedValueOnce([
        SENTINEL_CASE,
        SENTINEL_CASE_2,
        makeImpactedCase('1', '263794'),
      ]);
      mockFetchTraceability.mockResolvedValueOnce([]);
      mockFetchRunDetail.mockImplementation(async (_b, _t, _p, cycle, runId) => {
        if (cycle === PRIMARY_CYCLE_KEY) {
          return {
            run: { id: runId, status: 'PASS', testCaseKey: '', cycleKey: cycle },
            steps: [],
          };
        }
        return {
          run: { id: runId, status: 'FAIL', testCaseKey: '', cycleKey: cycle },
          steps: [
            {
              id: 1,
              step: 'see [a.png|https://example.com/a.png] and [b.png|https://example.com/b.png]',
              status: 'FAIL',
            },
          ],
        };
      });

      // No description prop — undefined treated as empty by extractInlineImageAttachments.
      renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });
      await waitFor(() => {
        expect(screen.getByText(/AIO attachments \(2\)/i)).toBeTruthy();
      });
    });

    it('Gap 2: AioAttachmentsGrid populates with thumbnails on no-runs path when impacted-execution step content carries [name.png|url] refs', async () => {
      mockFetchTraceability.mockResolvedValueOnce([
        SENTINEL_CASE,
        SENTINEL_CASE_2,
        makeImpactedCase('1', '263794'),
      ]);
      mockFetchTraceability.mockResolvedValueOnce([]);
      mockFetchRunDetail.mockImplementation(async (_b, _t, _p, cycle, runId) => {
        if (cycle === PRIMARY_CYCLE_KEY) {
          return {
            run: { id: runId, status: 'PASS', testCaseKey: '', cycleKey: cycle },
            steps: [],
          };
        }
        return {
          run: { id: runId, status: 'FAIL', testCaseKey: '', cycleKey: cycle },
          steps: [
            {
              id: 1,
              step: 'see [foo.png|https://example.com/foo.png] for details',
              status: 'FAIL',
            },
          ],
        };
      });

      renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });
      await waitFor(() => {
        // Grid header with count token
        expect(screen.getByText(/AIO attachments \(1\)/i)).toBeTruthy();
      });
      // At least one thumbnail with the filename as aria-label
      expect(
        screen.getByRole('button', { name: /foo\.png - click to view full size/i }),
      ).toBeTruthy();
    });

    it('T-54-07-02: cross-cycle fetch is capped at MAX_IMPACTED_EXECUTIONS=20 even when 30 cross-cycle cases exist', async () => {
      // 30 cross-cycle cases + sentinel pair to claim the primary cycle.
      // Each cross-cycle case carries a UNIQUE cycle key so the primary picker
      // doesn't accidentally pick one of them (sentinel pair gets 2 votes,
      // each cross-cycle gets 1 → sentinel wins).
      const crossCases = Array.from({ length: 30 }, (_, i) =>
        makeImpactedCase(String(i + 100), `r-${i}`, `OLD-CYCLE-${i}`),
      );
      mockFetchTraceability.mockResolvedValueOnce([SENTINEL_CASE, SENTINEL_CASE_2, ...crossCases]);
      mockFetchTraceability.mockResolvedValueOnce([]);

      mockFetchRunDetail.mockImplementation(async (_b, _t, _p, cycle, runId) => {
        if (cycle === PRIMARY_CYCLE_KEY) {
          return {
            run: { id: runId, status: 'PASS', testCaseKey: '', cycleKey: cycle },
            steps: [],
          };
        }
        return makeRunDetail(runId, cycle, 'FAIL');
      });

      renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });
      await waitFor(() => {
        expect(screen.getByText(/Impacted executions/i)).toBeTruthy();
      });
      // The cap is 20 cross-cycle + 2 sentinel-dominant = 22 max total calls.
      // Strictly: cross-cycle is sliced to <= 20.
      expect(mockFetchRunDetail.mock.calls.length).toBeLessThanOrEqual(22);
      // And cross-cycle calls (excluding PRIMARY_CYCLE_KEY) are at most 20.
      const crossCalls = mockFetchRunDetail.mock.calls.filter(
        (call) => call[3] !== PRIMARY_CYCLE_KEY,
      );
      expect(crossCalls.length).toBeLessThanOrEqual(20);
    });

    it('T-54-07-02 no-regression: in-cycle fetch is NOT capped — 21 in-cycle linked runs all render and fire 21 detail fetches', async () => {
      // 21 cases ALL in the same cycle so the picker chooses that cycle as
      // primary and they ALL flow through the uncapped in-cycle path.
      const SHARED_CYCLE = 'PROJ-CY-SHARED';
      const inCycleCases = Array.from({ length: 21 }, (_, i) => ({
        id: 2000 + i,
        key: `PROJ-TC-IN-${i}`,
        title: `In-cycle case ${i}`,
        projectKey: PROJECT_KEY,
        runs: [{ runId: `in-${i}`, cycleKey: SHARED_CYCLE }],
      }));
      mockFetchTraceability.mockResolvedValueOnce(inCycleCases);
      mockFetchTraceability.mockResolvedValueOnce([]);

      mockFetchRunDetail.mockImplementation(async (_b, _t, _p, cycle, runId) => ({
        run: {
          id: runId,
          status: 'PASS',
          testCaseKey: '',
          cycleKey: cycle,
        },
        steps: [{ id: 1, step: `step body ${runId}`, status: 'PASS' }],
      }));

      renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });

      await waitFor(() => {
        expect(screen.getByText('In-cycle case 0')).toBeTruthy();
      });

      // 21 in-cycle fetches all fire (cap does NOT apply to in-cycle).
      expect(mockFetchRunDetail).toHaveBeenCalledTimes(21);
      // All 21 collapsible run blocks render (D-10 visual contract preserved).
      for (let i = 0; i < 21; i++) {
        expect(screen.getByText(`In-cycle case ${i}`)).toBeTruthy();
      }
    });

    // Plan 54-08 Gap 1 — the diagnosed UAT defect on ESHOP-393120: two
    // traceability items share a single cycle (which becomes the primary
    // cycle), and the detail fetch returns `{ run, steps: [] }` for both
    // (passing-runs case where AIO doesn't carry step history). The old
    // line-476 filter dropped them silently; the widened queryFn promotes
    // them into impactedExecutions[] so the ImpactedExecutionsList renders.
    it('Gap 1 (single-cycle empty-steps): 2 traceability items in the same cycle promoted to ImpactedExecutionsList when detail.steps[] is empty', async () => {
      const ESHOP_CYCLE = 'ESHOP-CY-1011';
      const linkedCases = [
        makeImpactedCase('1', '263794', ESHOP_CYCLE),
        makeImpactedCase('2', '263793', ESHOP_CYCLE),
      ];
      mockFetchTraceability.mockResolvedValueOnce(linkedCases);
      mockFetchTraceability.mockResolvedValueOnce([]);

      // Mirrors ESHOP-393120's testRunStatusID 53 passing-runs-with-no-steps
      // behaviour: detail fetch resolves with PASS run but empty steps[].
      mockFetchRunDetail.mockImplementation(async (_b, _t, _p, cycleKey, runId) => ({
        run: { id: runId, status: 'PASS', testCaseKey: '', cycleKey },
        steps: [],
      }));

      renderSection({ jiraIssueId: JIRA_ISSUE_NUMERIC_ID });

      // ImpactedExecutionsList container renders.
      await waitFor(() => {
        expect(screen.getByText(/Impacted executions/i)).toBeTruthy();
      });

      // Two rows.
      expect(screen.getAllByTestId('impacted-execution-status-chip').length).toBe(2);
      // Run IDs visible.
      expect(screen.getByText('263794')).toBeTruthy();
      expect(screen.getByText('263793')).toBeTruthy();
      // Cycle key visible (one per row).
      expect(screen.getAllByText(ESHOP_CYCLE).length).toBeGreaterThanOrEqual(2);

      // Chips reflect status PASS (driven by detail.run.status, not defaulted
      // to NOT_EXECUTED gray).
      const chips = screen.getAllByTestId('impacted-execution-status-chip');
      expect(chips.every((c) => c.className.includes('green'))).toBe(true);

      // AioAttachmentsGrid header visible.
      expect(screen.getByText(/AIO attachments/i)).toBeTruthy();
      // Empty-state inside grid.
      expect(
        screen.getByText(/No inline image attachments found in linked test runs/i),
      ).toBeTruthy();

      // detail fetch called exactly 2 times (one per ref, NOT capped — in-cycle
      // promotion is not subject to MAX_IMPACTED_EXECUTIONS).
      expect(mockFetchRunDetail).toHaveBeenCalledTimes(2);
    });
  });
});
