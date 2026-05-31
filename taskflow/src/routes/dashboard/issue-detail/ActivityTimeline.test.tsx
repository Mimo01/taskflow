/**
 * ActivityTimeline — PERF-DETAIL-02 skeleton guard tests.
 *
 * Asserts:
 *   (a) changelog={undefined} → the 3 Skeleton placeholders render
 *   (b) changelog={[]}        → no skeleton (empty/normal state renders)
 */

// --- Mocks (vi.mock calls must be hoisted before imports) ---

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock('@/services/jira', () => ({
  mergeTimeline: vi.fn().mockReturnValue([]),
  filterTimeline: vi.fn().mockReturnValue([]),
  countByType: vi.fn().mockReturnValue({ all: 0, comment: 0, change: 0, worklog: 0 }),
}));

// --- Imports ---

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as jiraService from '@/services/jira';
import { useSettingsStore } from '@/stores/settings.store';

import { ActivityTimeline } from './ActivityTimeline';

// --- Helpers ---

const mockUseSettingsStore = vi.mocked(useSettingsStore);

function setupSettingsStore() {
  mockUseSettingsStore.mockImplementation((selector?: unknown) => {
    const store = { commentSortOrder: 'newest' };
    if (typeof selector === 'function') return selector(store);
    return store;
  });
}

// Minimal stub for the CommentCard prop — ActivityTimeline requires it but
// we never reach comment rendering in these skeleton tests.
const StubCommentCard = () => null;

// Minimal required props (excluding changelog which varies per test)
const BASE_PROPS = {
  comments: [],
  worklogs: [],
  issueKey: 'PROJ-1',
  jiraBaseUrl: 'https://jira.example.com',
  jiraUserDisplayName: 'Alice',
  attachmentMap: {},
  userMap: {},
  editingCommentId: null,
  editText: '',
  onEditStart: () => {},
  onEditChange: () => {},
  onEditSave: () => {},
  onEditCancel: () => {},
  onDelete: () => {},
  editError: null,
  deleteError: null,
  deletingCommentId: null,
  editPending: false,
  CommentCard: StubCommentCard as never,
  editingWorklogId: null,
  editDuration: '',
  editWorklogComment: '',
  onWorklogEditStart: () => {},
  onWorklogEditDurationChange: () => {},
  onWorklogEditCommentChange: () => {},
  onWorklogEditSave: () => {},
  onWorklogEditCancel: () => {},
  onWorklogDelete: () => {},
  worklogEditPending: false,
  worklogEditError: null,
};

// --- Tests ---

describe('ActivityTimeline — changelog skeleton guard (PERF-DETAIL-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSettingsStore();
  });

  it('renders 3 Skeleton placeholders when changelog is undefined', () => {
    render(<ActivityTimeline {...BASE_PROPS} changelog={undefined} />);

    // The skeleton block renders a <section> with three Skeleton children.
    // Each Skeleton renders as a div with the class "animate-pulse" (shadcn/ui Skeleton).
    // We assert exactly 3 are present, confirming the undefined-guard fires.
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3);

    // The normal "Activity" heading must NOT be present (skeleton replaces it)
    expect(screen.queryByText('Activity')).toBeNull();
  });

  it('renders no Skeleton placeholders when changelog is an empty array', () => {
    render(<ActivityTimeline {...BASE_PROPS} changelog={[]} />);

    // No skeleton should appear — the component falls through to the empty-state path
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(0);

    // The normal "Activity" section heading IS present
    expect(screen.getByText('Activity')).toBeTruthy();

    // The empty-state message confirms normal rendering path
    expect(screen.getByText('No activity yet')).toBeTruthy();
  });

  it('renders no Skeleton placeholders when changelog has entries', () => {
    const entry = {
      id: 'h1',
      created: '2026-01-01T00:00:00.000Z',
      author: { displayName: 'Alice', name: 'alice' },
      items: [{ field: 'status', fromString: 'Open', toString: 'Done' }],
    };

    // Override the module-level mocks for this test
    vi.mocked(jiraService.mergeTimeline).mockReturnValue([
      { type: 'change', data: entry },
    ] as never);
    vi.mocked(jiraService.filterTimeline).mockReturnValue([
      { type: 'change', data: entry },
    ] as never);
    vi.mocked(jiraService.countByType).mockReturnValue({
      all: 1,
      comment: 0,
      change: 1,
      worklog: 0,
    });

    render(<ActivityTimeline {...BASE_PROPS} changelog={[entry as never]} />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(0);

    // Section heading present — not in skeleton mode
    expect(screen.getByText('Activity')).toBeTruthy();
  });
});
