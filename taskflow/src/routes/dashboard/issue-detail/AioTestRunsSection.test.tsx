/**
 * Component test stubs for AioTestRunsSection.
 *
 * INTENDED RED STATE: This file imports AioTestRunsSection from './AioTestRunsSection'
 * which does not exist yet — it will be created in Plan 54-03.
 * All tests in this file should fail with "Cannot find module './AioTestRunsSection'"
 * until Plan 54-03 ships. This is the correct and expected outcome for the TDD RED gate.
 *
 * Tests turn GREEN in Plan 54-04 once the component is wired to real data.
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
  fetchAioCycles: vi.fn(),
  fetchAioTestRunsForCycle: vi.fn(),
  fetchAioTestRunSteps: vi.fn(),
}));

// --- Imports (after mocks) ---

import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import {
  fetchAioCycles,
  fetchAioProjects,
  fetchAioTestCasesForIssue,
  fetchAioTestRunSteps,
  fetchAioTestRunsForCycle,
} from '@/services/aio';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

// AioTestRunsSection does not exist yet — Plan 54-03 creates it (RED gate)
import { AioTestRunsSection } from './AioTestRunsSection';

// --- Test helpers ---

const mockFetchProjects = vi.mocked(fetchAioProjects);
const mockFetchTestCases = vi.mocked(fetchAioTestCasesForIssue);
const mockFetchCycles = vi.mocked(fetchAioCycles);
const mockFetchRuns = vi.mocked(fetchAioTestRunsForCycle);
const mockFetchSteps = vi.mocked(fetchAioTestRunSteps);
const mockUseSettingsStore = vi.mocked(useSettingsStore);
const mockUseAuthStore = vi.mocked(useAuthStore);
const mockUseDelayedLoading = vi.mocked(useDelayedLoading);

const JIRA_BASE_URL = 'https://jira.example.com';
const ISSUE_KEY = 'PROJ-123';
const PROJECT_KEY = 'PROJ';
const CYCLE_KEY = 'PROJ-CY-4';

const TEST_CASE = { id: 1, key: 'PROJ-TC-1', title: 'Login flow test', projectKey: PROJECT_KEY };
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

function renderSection(props: { issueKey?: string; jiraBaseUrl?: string; jiraIssueId?: string } = {}) {
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
    const defectRun = { ...TEST_RUN, testCaseKey: 'PROJ-TC-1', jiraDefectIDs: [JIRA_ISSUE_NUMERIC_ID] };

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
});
