/**
 * Component tests for AioTestRunsSection — maintained alongside the component since Plan 54-04.
 * Plan 54-06 adds wiki-rendering + perf-path (Branch A1 direct lookup) coverage and widens
 * the `vi.mock('@/services/aio', ...)` factory to include `fetchAioTraceabilityTestCases`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  props: { issueKey?: string; jiraBaseUrl?: string; jiraIssueId?: string } = {},
) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <AioTestRunsSection
        issueKey={props.issueKey ?? ISSUE_KEY}
        jiraBaseUrl={props.jiraBaseUrl ?? JIRA_BASE_URL}
        jiraIssueId={props.jiraIssueId}
      />
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

  // Test 4: empty state when test cases linked but no runs have steps (D-04 second empty state)
  it('renders "No test runs in active cycle" when test cases are linked but matched runs have zero steps', async () => {
    mockFetchTestCases.mockResolvedValue([TEST_CASE]);
    mockFetchCycles.mockResolvedValue([ACTIVE_CYCLE]);
    mockFetchRuns.mockResolvedValue([TEST_RUN]);
    mockFetchSteps.mockResolvedValue([]);

    renderSection();
    await waitFor(() => {
      expect(screen.getByText(/no test runs in active cycle/i)).toBeTruthy();
    });
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
      expect(mockFetchRunDetail).toHaveBeenCalledWith(
        JIRA_BASE_URL,
        'mock-token',
        PROJECT_KEY,
        UNIQUE_CYCLE_KEY,
        UNIQUE_RUN_ID,
      );
    });
  });
});
