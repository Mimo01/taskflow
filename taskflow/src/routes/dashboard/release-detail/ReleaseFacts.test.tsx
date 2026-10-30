// RELBR-02/RELBR-03 + D-08/D-15: ReleaseFacts renders every state the old
// sidebar did, as inline `Name: value` facts. Ported from ReleaseDetailSidebar.test.tsx.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { GitLabMilestone, GitLabMR } from '@/services/gitlab';
import type { JiraFixVersion } from '@/services/jira';
import type { ReleaseMatch } from '@/services/releaseLinker';
import type { MergeBackVerdict } from './mergeBackVerification';
import { MetaLine, ReleaseFacts, type ReleaseFactsProps, releaseFactItems } from './ReleaseFacts';
import type { BranchState } from './releaseBranch';

const openExternal = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
}));

vi.mock('@/lib/openExternal', () => ({
  openExternal,
}));

// LinkContextMenu calls useDetectedBrowsers -> useQuery; stub the hook rather
// than adding a QueryClientProvider to every render().
vi.mock('@/lib/useDetectedBrowsers', () => ({
  useDetectedBrowsers: () => [],
}));

function makeVersion(overrides: Partial<JiraFixVersion> = {}): JiraFixVersion {
  return {
    id: '10000',
    name: '33.5.0',
    releaseDate: '2026-07-21',
    released: false,
    ...overrides,
  };
}

const noneMatch: ReleaseMatch = { type: 'none', candidateName: '', candidateUrl: '' };
const exactMatch: ReleaseMatch = {
  type: 'exact',
  candidateName: '33.5.0',
  candidateUrl: 'https://gitlab.example/milestones/1',
};
const fuzzyMatch: ReleaseMatch = {
  type: 'fuzzy',
  candidateName: '33.5',
  candidateUrl: 'https://gitlab.example/milestones/2',
};

const milestone: GitLabMilestone = {
  id: 1,
  iid: 1,
  title: '33.5.0',
  description: '',
  start_date: null,
  due_date: null,
  state: 'active',
  web_url: 'https://gitlab.example/milestones/1',
};

function makeProps(
  overrides: Partial<ReleaseFactsProps> & { branchState: BranchState },
): ReleaseFactsProps {
  return {
    version: makeVersion(),
    gitlabConfigured: true,
    gitlabMatch: noneMatch,
    matchedMilestone: null,
    mergeBackVerdict: { kind: 'hidden' } satisfies MergeBackVerdict,
    defaultBranch: null,
    onCreateBranch: () => {},
    onCreateMilestone: () => {},
    onRetryBranchCheck: () => {},
    canCreateMilestone: true,
    milestoneMRsLoaded: false,
    labelCoverage: null,
    hasStoryPoints: false,
    storyPoints: { total: 0, completed: 0 },
    ...overrides,
  };
}

function renderFacts(overrides: { branchState: BranchState } & Partial<ReleaseFactsProps>) {
  return render(<ReleaseFacts {...makeProps(overrides)} />);
}

function makeMr(i: number): GitLabMR {
  return {
    id: i,
    iid: 1000 + i,
    title: `Fix thing ${i}`,
    state: 'merged',
    web_url: `https://gitlab.example/mr/${1000 + i}`,
    labels: [],
  } as unknown as GitLabMR;
}

describe('ReleaseFacts — Branch fact', () => {
  it('renders the blocked-no-milestone state', () => {
    renderFacts({ branchState: { kind: 'blocked-no-milestone' } });
    const el = screen.getByTestId('branch-status-blocked');
    expect(el).toHaveTextContent('Create the milestone first');
  });

  it('renders the unresolvable state', () => {
    renderFacts({ branchState: { kind: 'unresolvable' } });
    const el = screen.getByTestId('branch-status-unresolvable');
    expect(el.textContent).toContain('No branch name from this milestone title');
  });

  it('renders the invalid-ref state', () => {
    renderFacts({
      branchState: { kind: 'invalid-ref', branchName: 'release/33 5.0' },
    });
    expect(screen.getByTestId('branch-status-invalid-ref')).toBeInTheDocument();
  });

  it('renders the loading state', () => {
    renderFacts({ branchState: { kind: 'loading', branchName: 'release/33.5.0' } });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders the exists state', () => {
    renderFacts({ branchState: { kind: 'exists', branchName: 'release/33.5.0' } });
    expect(screen.getByTestId('branch-status-exists')).toBeInTheDocument();
    expect(screen.getByText('release/33.5.0')).toBeInTheDocument();
  });

  it('renders the missing state as a Create branch action', () => {
    // Action-only: the row label plus the offer to create already conveys the
    // absence, so there is no separate "No release branch" warning to assert.
    renderFacts({
      branchState: { kind: 'missing', branchName: 'release/33.5.0' },
      defaultBranch: 'main',
    });
    expect(screen.getByTestId('branch-status-missing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create branch' })).toBeInTheDocument();
  });

  it('states the reason instead of a dead action when the default branch has not loaded', () => {
    renderFacts({
      branchState: { kind: 'missing', branchName: 'release/33.5.0' },
      defaultBranch: null,
    });
    expect(screen.getByText('Default branch not loaded yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create branch' })).not.toBeInTheDocument();
  });

  it('renders the released state with its tag, and offers no Create action', () => {
    renderFacts({
      branchState: {
        kind: 'released',
        branchName: 'release/33.6.0',
        tagName: 'v33.6.0',
        tagChannel: 'resolved',
      },
    });
    const el = screen.getByTestId('branch-status-released');
    expect(el).toHaveTextContent('Released');
    expect(el).toHaveTextContent('v33.6.0');
    // A shipped release must not invite re-creating its merged branch.
    expect(screen.queryByRole('button', { name: /create branch/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('branch-status-missing')).not.toBeInTheDocument();
    // D-08: the row must never claim an unverified merge — the "Merged back"
    // row is the sole owner of that claim.
    expect(el.title).not.toMatch(/merged/i);
    expect(el.title).toMatch(/deleted/);
  });

  it('renders the released state without a tag — a missing tag is not evidence of drift', () => {
    renderFacts({
      branchState: {
        kind: 'released',
        branchName: 'release/33.5.0',
        tagName: null,
        tagChannel: 'resolved',
      },
    });
    const el = screen.getByTestId('branch-status-released');
    expect(el).toHaveTextContent('Released');
    expect(screen.queryByTestId('branch-status-missing')).not.toBeInTheDocument();
    expect(el.title).not.toMatch(/merged/i);
    expect(el.title).toMatch(/deleted/);
  });

  it('resolved + null tag still asserts the exact "No matching tag found" sentence', () => {
    renderFacts({
      branchState: {
        kind: 'released',
        branchName: 'release/33.5.0',
        tagName: null,
        tagChannel: 'resolved',
      },
    });
    const el = screen.getByTestId('branch-status-released');
    expect(el.title).toContain('No matching tag found');
  });

  it('does not claim "No matching tag found" while the tag channel is pending', () => {
    renderFacts({
      branchState: {
        kind: 'released',
        branchName: 'release/33.5.0',
        tagName: null,
        tagChannel: 'pending',
      },
    });
    const el = screen.getByTestId('branch-status-released');
    expect(el.title).not.toContain('No matching tag found');
    expect(el.title).toMatch(/deleted/);
    expect(el.title).not.toMatch(/merged/i);
    expect(el).toHaveTextContent('Released');
    expect(
      screen.queryByRole('button', { name: /create branch|override|dismiss|acknowledge/i }),
    ).not.toBeInTheDocument();

    // WR-03: the distinction must be VISIBLE, not hover-only. Before this the
    // row text was byte-identical in all three tag-channel states.
    expect(screen.getByTestId('branch-status-tag-pending')).toBeInTheDocument();
    expect(el).toHaveTextContent(/checking tag/i);
    expect(screen.getByTestId('branch-status-released-description')).toHaveTextContent(
      /Checking for a matching tag/i,
    );
  });

  it('does not claim "No matching tag found" while the tag channel failed', () => {
    renderFacts({
      branchState: {
        kind: 'released',
        branchName: 'release/33.5.0',
        tagName: null,
        tagChannel: 'failed',
      },
    });
    const el = screen.getByTestId('branch-status-released');
    expect(el.title).not.toContain('No matching tag found');
    expect(el.title).toMatch(/deleted/);
    expect(el.title).not.toMatch(/merged/i);
    expect(el).toHaveTextContent('Released');
    expect(
      screen.queryByRole('button', { name: /create branch|override|dismiss|acknowledge/i }),
    ).not.toBeInTheDocument();

    // WR-03: visible, not hover-only.
    expect(screen.getByTestId('branch-status-tag-failed')).toBeInTheDocument();
    expect(el).toHaveTextContent(/tag check failed/i);
    expect(screen.getByTestId('branch-status-released-description')).toHaveTextContent(
      /Couldn't check for a matching tag/i,
    );
  });

  it('WR-03: the three tag-channel states are distinguishable from visible text alone', () => {
    const visibleText = (tagChannel: 'resolved' | 'pending' | 'failed') => {
      const { unmount } = renderFacts({
        branchState: {
          kind: 'released',
          branchName: 'release/33.5.0',
          tagName: null,
          tagChannel,
        },
      });
      const text = screen.getByTestId('branch-status-released').textContent ?? '';
      unmount();
      return text;
    };

    const resolved = visibleText('resolved');
    const pending = visibleText('pending');
    const failed = visibleText('failed');

    expect(new Set([resolved, pending, failed]).size).toBe(3);
  });

  it('Test F: renders the check-failed state', () => {
    renderFacts({
      branchState: { kind: 'check-failed', branchName: 'release/33.5.0' },
    });
    const el = screen.getByTestId('branch-status-check-failed');
    expect(el).toHaveTextContent("Couldn't check");
    expect(screen.getByRole('button', { name: 'Retry branch check' })).toBeInTheDocument();
  });

  it('Test G: Retry button calls onRetryBranchCheck exactly once', async () => {
    const user = userEvent.setup();
    const onRetryBranchCheck = vi.fn();
    renderFacts({
      branchState: { kind: 'check-failed', branchName: 'release/33.5.0' },
      onRetryBranchCheck,
    });
    await user.click(screen.getByRole('button', { name: 'Retry branch check' }));
    expect(onRetryBranchCheck).toHaveBeenCalledTimes(1);
  });

  it('Test H: no Create branch button is rendered in the check-failed state', () => {
    renderFacts({
      branchState: { kind: 'check-failed', branchName: 'release/33.5.0' },
    });
    expect(screen.queryByRole('button', { name: 'Create branch' })).not.toBeInTheDocument();
  });
});

describe('ReleaseFacts — Merged back fact (MERGE-01)', () => {
  const baseBranchState: BranchState = { kind: 'exists', branchName: 'release/33.5.0' };

  it('hides the row entirely for the hidden verdict', () => {
    renderFacts({
      branchState: baseBranchState,
      mergeBackVerdict: { kind: 'hidden' },
    });
    expect(screen.queryByTestId('release-fact-merged-back')).toBeNull();
    expect(screen.queryByTestId('merge-back-loading')).toBeNull();
    expect(screen.queryByTestId('merge-back-merged')).toBeNull();
    expect(screen.queryByTestId('merge-back-likely-not-merged')).toBeNull();
    expect(screen.queryByTestId('merge-back-couldnt-verify')).toBeNull();
  });

  it('renders the loading verdict', () => {
    renderFacts({
      branchState: baseBranchState,
      mergeBackVerdict: { kind: 'loading' },
    });
    const el = screen.getByTestId('merge-back-loading');
    expect(el).toHaveTextContent('Loading...');
  });

  it('renders the merged/tracking-mr verdict with a mergedAt date', () => {
    renderFacts({
      branchState: baseBranchState,
      mergeBackVerdict: {
        kind: 'merged',
        via: 'tracking-mr',
        defaultBranch: 'develop',
        mrIid: 4821,
        mrUrl: 'https://gitlab.example.com/mr/4821',
        mergedAt: '2026-07-21T10:00:00Z',
      },
    });
    const el = screen.getByTestId('merge-back-merged');
    expect(el).toHaveTextContent('into develop');
    expect(el).toHaveTextContent('21 Jul');
    expect(el.title).toBe('via !4821, merged 21.07.2026');
  });

  it('renders the merged/tracking-mr verdict with mergedAt: null (P-03)', () => {
    renderFacts({
      branchState: baseBranchState,
      mergeBackVerdict: {
        kind: 'merged',
        via: 'tracking-mr',
        defaultBranch: 'develop',
        mrIid: 4821,
        mrUrl: 'https://gitlab.example.com/mr/4821',
        mergedAt: null,
      },
    });
    const el = screen.getByTestId('merge-back-merged');
    expect(el.textContent).toContain('into develop');
    expect(el.textContent).not.toContain('·');
    expect(el.title).toBe('via !4821');
  });

  it('renders the merged/content-compare verdict (P-02)', () => {
    renderFacts({
      branchState: baseBranchState,
      mergeBackVerdict: {
        kind: 'merged',
        via: 'content-compare',
        defaultBranch: 'develop',
        tagName: 'v33.7.0',
      },
    });
    const el = screen.getByTestId('merge-back-merged');
    expect(el).toHaveTextContent('into develop');
    expect(el.title).toBe('no diff between v33.7.0 and develop');
  });

  it('renders the likely-not-merged verdict, with no button in the row (D-12 lock)', () => {
    renderFacts({
      branchState: baseBranchState,
      mergeBackVerdict: {
        kind: 'likely-not-merged',
        defaultBranch: 'develop',
        tagName: 'v33.7.0',
        commitsNotInDefault: 12,
      },
    });
    const el = screen.getByTestId('merge-back-likely-not-merged');
    expect(el).toHaveTextContent('Likely not into develop');
    expect(el.title).toBe('v33.7.0 has 12 commits not in develop');
    // WR-05: scope to the row via the stable label-derived test hook rather
    // than a Tailwind class selector — a className/layout change to MetaRow
    // must not silently disable this lock.
    const row = screen.getByTestId('release-fact-merged-back');
    // D-12 forbids an override/dismiss/acknowledge/confirm control in ANY
    // form, not only a <button> — check every interactive element kind.
    expect(within(row).queryAllByRole('button')).toHaveLength(0);
    expect(
      row.querySelectorAll(
        'input, select, textarea, [role="checkbox"], [role="switch"], [role="menuitem"]',
      ),
    ).toHaveLength(0);
    expect(row.textContent).not.toMatch(/override|dismiss|acknowledge|confirm/i);
  });

  it('renders the couldnt-verify verdict, with no button or override control in the row (D-12 lock)', () => {
    renderFacts({
      branchState: baseBranchState,
      mergeBackVerdict: {
        kind: 'couldnt-verify',
        reason: 'no-mr-no-tag',
        // WR-08: the resolver now carries the BARE version — the form
        // `findReleaseTag` actually matches, with or without a `v`.
        expectedTagName: '33.7.0',
      },
    });
    const row = screen.getByTestId('release-fact-merged-back');
    expect(within(row).queryAllByRole('button')).toHaveLength(0);
    expect(
      row.querySelectorAll(
        'input, select, textarea, [role="checkbox"], [role="switch"], [role="menuitem"]',
      ),
    ).toHaveLength(0);
    expect(row.textContent).not.toMatch(/override|dismiss|acknowledge|confirm/i);
  });

  it('renders the couldnt-verify/no-mr-no-tag verdict', () => {
    renderFacts({
      branchState: baseBranchState,
      mergeBackVerdict: {
        kind: 'couldnt-verify',
        reason: 'no-mr-no-tag',
        // WR-08: the resolver now carries the BARE version — the form
        // `findReleaseTag` actually matches, with or without a `v`.
        expectedTagName: '33.7.0',
      },
    });
    const el = screen.getByTestId('merge-back-couldnt-verify');
    expect(el).toHaveTextContent("Couldn't verify");
    expect(el.title).toBe(
      'no tracking MR and no tag matching 33.7.0 (with or without a leading v) found',
    );
  });

  it('renders the couldnt-verify/check-failed verdict', () => {
    renderFacts({
      branchState: baseBranchState,
      mergeBackVerdict: {
        kind: 'couldnt-verify',
        reason: 'check-failed',
        // WR-08: the resolver now carries the BARE version — the form
        // `findReleaseTag` actually matches, with or without a `v`.
        expectedTagName: '33.7.0',
      },
    });
    const el = screen.getByTestId('merge-back-couldnt-verify');
    expect(el.title).toBe('the merge-back check could not be completed');
  });
});

describe('ReleaseFacts — Milestone fact', () => {
  const blocked: BranchState = { kind: 'blocked-no-milestone' };

  it('renders Missing + Create milestone action when none matched and creatable', async () => {
    const user = userEvent.setup();
    const onCreateMilestone = vi.fn();
    renderFacts({ branchState: blocked, onCreateMilestone });
    const el = screen.getByTestId('gitlab-link-none');
    expect(el).toHaveTextContent('Missing');
    await user.click(screen.getByRole('button', { name: 'Create milestone' }));
    expect(onCreateMilestone).toHaveBeenCalledTimes(1);
  });

  it('states the reason and offers no button when no release date is set', () => {
    renderFacts({ branchState: blocked, canCreateMilestone: false });
    expect(screen.getByTestId('gitlab-link-none')).toHaveTextContent('Set a release date first');
    expect(screen.queryByRole('button', { name: 'Create milestone' })).not.toBeInTheDocument();
  });

  it('opens the exact milestone web_url externally', async () => {
    const user = userEvent.setup();
    renderFacts({ branchState: blocked, gitlabMatch: exactMatch, matchedMilestone: milestone });
    await user.click(screen.getByTestId('gitlab-link-exact'));
    expect(openExternal).toHaveBeenCalledWith('https://gitlab.example/milestones/1');
  });

  it('renders a fuzzy match with a dashed underline, orange tone and the candidate named', () => {
    renderFacts({ branchState: blocked, gitlabMatch: fuzzyMatch });
    const el = screen.getByTestId('gitlab-link-fuzzy');
    expect(el).toHaveClass('border-dashed');
    expect(el.className).toContain('text-orange-600');
    expect(el).toHaveAttribute('title', 'Fuzzy match: 33.5');
  });
});

describe('ReleaseFacts — presence and separators', () => {
  const exists: BranchState = { kind: 'exists', branchName: 'release/33.5.0' };

  it('hides Milestone / Branch / Merged back / MR labels when GitLab is not configured', () => {
    const { container } = renderFacts({
      branchState: exists,
      gitlabConfigured: false,
      gitlabMatch: exactMatch,
      mergeBackVerdict: { kind: 'loading' },
      hasStoryPoints: true,
      storyPoints: { total: 12, completed: 5 },
    });
    for (const id of ['milestone', 'branch', 'merged-back', 'mr-labels']) {
      expect(screen.queryByTestId(`release-fact-${id}`)).not.toBeInTheDocument();
    }
    expect(screen.getByTestId('release-fact-story-points')).toBeInTheDocument();
    // single item -> no separator
    expect(container.textContent).not.toContain('·');
  });

  it('orders the items milestone, branch, merged-back, mr-labels, story-points', () => {
    const items = releaseFactItems(
      makeProps({
        branchState: exists,
        gitlabMatch: exactMatch,
        mergeBackVerdict: { kind: 'loading' },
        hasStoryPoints: true,
        storyPoints: { total: 3, completed: 1 },
      }),
    );
    expect(items.map((i) => i.id)).toEqual([
      'milestone',
      'branch',
      'merged-back',
      'mr-labels',
      'story-points',
    ]);
  });

  it('MetaLine renders n-1 separators for n items and none for one item', () => {
    const { container, rerender } = render(
      <MetaLine
        items={[
          { id: 'a', node: <span>A</span> },
          { id: 'b', node: <span>B</span> },
          { id: 'c', node: <span>C</span> },
        ]}
      />,
    );
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
    rerender(<MetaLine items={[{ id: 'a', node: <span>A</span> }]} />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it('does not use font-medium on facts (weight 400)', () => {
    // The outline action Button primitive carries its own weight; assert on
    // the fact text spans only.
    renderFacts({ branchState: exists });
    const fact = screen.getByTestId('release-fact-branch');
    expect(fact.className).not.toContain('font-medium');
    for (const span of fact.querySelectorAll('span')) {
      expect(span.className).not.toContain('font-medium');
    }
  });
});

describe('ReleaseFacts — MR labels fact (D-15)', () => {
  const exists: BranchState = { kind: 'exists', branchName: 'release/33.5.0' };

  it('is hidden when no milestone matched', () => {
    renderFacts({ branchState: exists, gitlabMatch: noneMatch });
    expect(screen.queryByTestId('release-fact-mr-labels')).not.toBeInTheDocument();
  });

  it('shows Loading… until MRs are loaded with coverage', () => {
    renderFacts({ branchState: exists, gitlabMatch: exactMatch, milestoneMRsLoaded: false });
    expect(screen.getByTestId('release-fact-mr-labels')).toHaveTextContent('Loading…');
  });

  it('is hidden when MRs are loaded but the milestone has none', () => {
    renderFacts({
      branchState: exists,
      gitlabMatch: exactMatch,
      milestoneMRsLoaded: true,
      labelCoverage: null,
    });
    expect(screen.queryByTestId('release-fact-mr-labels')).not.toBeInTheDocument();
  });

  it('shows a green "All N labeled" when every MR is labeled', () => {
    renderFacts({
      branchState: exists,
      gitlabMatch: exactMatch,
      milestoneMRsLoaded: true,
      labelCoverage: { total: 23, labeled: 23, unlabeled: [], allLabeled: true },
    });
    const el = screen.getByTestId('release-fact-mr-labels');
    expect(el).toHaveTextContent('All 23 labeled');
    expect(el.innerHTML).toContain('text-green-600');
  });

  it('shows "N/M missing" and a tooltip listing 3 MRs plus "+2 more", with no links or buttons', async () => {
    const user = userEvent.setup();
    const unlabeled = [1, 2, 3, 4, 5].map(makeMr);
    renderFacts({
      branchState: exists,
      gitlabMatch: exactMatch,
      milestoneMRsLoaded: true,
      labelCoverage: { total: 8, labeled: 3, unlabeled, allLabeled: false },
    });
    const fact = screen.getByTestId('release-fact-mr-labels');
    expect(fact).toHaveTextContent('5/8 missing');
    expect(fact.innerHTML).toContain('text-orange-600');
    await user.hover(within(fact).getByText('5/8 missing'));
    const tip = await screen.findByTestId('mr-labels-unlabeled-tooltip');
    expect(tip).toHaveTextContent('!1001');
    expect(tip).toHaveTextContent('Fix thing 3');
    expect(tip).not.toHaveTextContent('!1004');
    expect(tip).toHaveTextContent('+2 more');
    expect(tip.querySelectorAll('a')).toHaveLength(0);
    expect(within(tip).queryAllByRole('button')).toHaveLength(0);
  });
});

describe('ReleaseFacts — Story points and removed counts', () => {
  const exists: BranchState = { kind: 'exists', branchName: 'release/33.5.0' };

  it('renders "{total} SP" with a Done / Total tooltip', async () => {
    const user = userEvent.setup();
    renderFacts({
      branchState: exists,
      hasStoryPoints: true,
      storyPoints: { total: 21, completed: 8 },
    });
    const fact = screen.getByTestId('release-fact-story-points');
    expect(fact).toHaveTextContent('21 SP');
    await user.hover(within(fact).getByText('21 SP'));
    const tip = await screen.findByText('Done');
    expect(tip.closest('[data-slot="tooltip-content"]')).toHaveTextContent('Total');
  });

  it('is absent when there are no story points', () => {
    renderFacts({ branchState: exists, hasStoryPoints: false });
    expect(screen.queryByTestId('release-fact-story-points')).not.toBeInTheDocument();
  });

  it('renders no MR-state or issue-status counts (D-06)', () => {
    const { container } = renderFacts({
      branchState: exists,
      gitlabMatch: exactMatch,
      milestoneMRsLoaded: true,
      labelCoverage: { total: 2, labeled: 2, unlabeled: [], allLabeled: true },
    });
    expect(container.textContent).not.toMatch(/\d+ (merged|open|closed|new|in progress|done)/);
  });

  it('keeps Milestone and Branch facts and renders no Status/Date/Edit', () => {
    renderFacts({ branchState: { kind: 'absent' } as unknown as BranchState });
    expect(screen.queryByText('Status')).toBeNull();
    expect(screen.queryByText('Date')).toBeNull();
    expect(screen.getByText('Milestone:')).toBeInTheDocument();
    expect(screen.getByText('Branch:')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('truncates the branch name and exposes the full name in a title', () => {
    renderFacts({ branchState: { kind: 'exists', branchName: 'release/33.5.0' } });
    const name = screen.getByTestId('branch-name');
    expect(name).toHaveClass('truncate');
    expect(name).toHaveAttribute('title', 'release/33.5.0');
  });

  it('truncates the tag name with a title', () => {
    renderFacts({
      branchState: {
        kind: 'released',
        branchName: 'release/33.5.0',
        tagName: 'v33.5.0',
        tagChannel: 'resolved',
      } as BranchState,
    });
    const tag = screen.getByText('v33.5.0');
    expect(tag).toHaveClass('truncate');
    expect(tag).toHaveAttribute('title', 'v33.5.0');
  });
});
