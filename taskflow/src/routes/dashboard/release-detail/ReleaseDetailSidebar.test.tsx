// RELBR-02/RELBR-03: sidebar renders every BranchState variant with UI-SPEC copy

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { JiraFixVersion } from '@/services/jira';
import type { ReleaseMatch } from '@/services/releaseLinker';
import type { MergeBackVerdict } from './mergeBackVerification';
import type { BranchState } from './releaseBranch';
import { ReleaseDetailSidebar } from './ReleaseDetailSidebar';

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
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

function renderSidebar(overrides: { branchState: BranchState } & Record<string, unknown>) {
  return render(
    <ReleaseDetailSidebar
      width={320}
      isDragging={false}
      onResizeMouseDown={() => {}}
      handleHovered={false}
      setHandleHovered={() => {}}
      onStartEditing={() => {}}
      version={makeVersion()}
      gitlabMatch={noneMatch}
      matchedMilestone={null}
      mergeBackVerdict={{ kind: 'hidden' } satisfies MergeBackVerdict}
      defaultBranch={null}
      onCreateBranch={() => {}}
      onCreateMilestone={() => {}}
      onRetryBranchCheck={() => {}}
      canCreateMilestone={true}
      milestoneMRsLoaded={false}
      labelCoverage={null}
      mrStateCounts={{ merged: 0, opened: 0, closed: 0 }}
      hasMrs={false}
      hasIssues={false}
      issueStatusCounts={{ new: 0, indeterminate: 0, done: 0 }}
      hasStoryPoints={false}
      storyPoints={{ total: 0, completed: 0 }}
      {...overrides}
    />,
  );
}

describe('ReleaseDetailSidebar — Release Branch row', () => {
  it('renders the blocked-no-milestone state', () => {
    renderSidebar({ branchState: { kind: 'blocked-no-milestone' } });
    const el = screen.getByTestId('branch-status-blocked');
    expect(el).toHaveTextContent('Create the milestone first');
  });

  it('renders the unresolvable state', () => {
    renderSidebar({ branchState: { kind: 'unresolvable' } });
    const el = screen.getByTestId('branch-status-unresolvable');
    expect(el.textContent).toContain('No branch name from this milestone title');
  });

  it('renders the invalid-ref state', () => {
    renderSidebar({
      branchState: { kind: 'invalid-ref', branchName: 'release/33 5.0' },
    });
    expect(screen.getByTestId('branch-status-invalid-ref')).toBeInTheDocument();
  });

  it('renders the loading state', () => {
    renderSidebar({ branchState: { kind: 'loading', branchName: 'release/33.5.0' } });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders the exists state', () => {
    renderSidebar({ branchState: { kind: 'exists', branchName: 'release/33.5.0' } });
    expect(screen.getByTestId('branch-status-exists')).toBeInTheDocument();
    expect(screen.getByText('release/33.5.0')).toBeInTheDocument();
  });

  it('renders the missing state as a Create branch action', () => {
    // Action-only: the row label plus the offer to create already conveys the
    // absence, so there is no separate "No release branch" warning to assert.
    renderSidebar({
      branchState: { kind: 'missing', branchName: 'release/33.5.0' },
      defaultBranch: 'main',
    });
    expect(screen.getByTestId('branch-status-missing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create branch' })).toBeInTheDocument();
  });

  it('states the reason instead of a dead action when the default branch has not loaded', () => {
    renderSidebar({
      branchState: { kind: 'missing', branchName: 'release/33.5.0' },
      defaultBranch: null,
    });
    expect(screen.getByText('Default branch not loaded yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create branch' })).not.toBeInTheDocument();
  });

  it('renders the released state with its tag, and offers no Create action', () => {
    renderSidebar({
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
    renderSidebar({
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
    renderSidebar({
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
    renderSidebar({
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
  });

  it('does not claim "No matching tag found" while the tag channel failed', () => {
    renderSidebar({
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
  });

  it('Test F: renders the check-failed state', () => {
    renderSidebar({
      branchState: { kind: 'check-failed', branchName: 'release/33.5.0' },
    });
    const el = screen.getByTestId('branch-status-check-failed');
    expect(el).toHaveTextContent("Couldn't check");
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('Test G: Retry button calls onRetryBranchCheck exactly once', async () => {
    const user = userEvent.setup();
    const onRetryBranchCheck = vi.fn();
    renderSidebar({
      branchState: { kind: 'check-failed', branchName: 'release/33.5.0' },
      onRetryBranchCheck,
    });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetryBranchCheck).toHaveBeenCalledTimes(1);
  });

  it('Test H: no Create branch button is rendered in the check-failed state', () => {
    renderSidebar({
      branchState: { kind: 'check-failed', branchName: 'release/33.5.0' },
    });
    expect(screen.queryByRole('button', { name: 'Create branch' })).not.toBeInTheDocument();
  });
});

describe('ReleaseDetailSidebar — Merged back row (MERGE-01)', () => {
  const baseBranchState: BranchState = { kind: 'exists', branchName: 'release/33.5.0' };

  it('hides the row entirely for the hidden verdict', () => {
    renderSidebar({
      branchState: baseBranchState,
      mergeBackVerdict: { kind: 'hidden' },
    });
    expect(screen.queryByText('Merged back')).toBeNull();
    expect(screen.queryByTestId('merge-back-loading')).toBeNull();
    expect(screen.queryByTestId('merge-back-merged')).toBeNull();
    expect(screen.queryByTestId('merge-back-likely-not-merged')).toBeNull();
    expect(screen.queryByTestId('merge-back-couldnt-verify')).toBeNull();
  });

  it('renders the loading verdict', () => {
    renderSidebar({
      branchState: baseBranchState,
      mergeBackVerdict: { kind: 'loading' },
    });
    const el = screen.getByTestId('merge-back-loading');
    expect(el).toHaveTextContent('Loading...');
  });

  it('renders the merged/tracking-mr verdict with a mergedAt date', () => {
    renderSidebar({
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
    expect(el).toHaveTextContent('Merged into develop');
    expect(el).toHaveTextContent('21 Jul');
    expect(el.title).toBe('via !4821, merged 21.07.2026');
  });

  it('renders the merged/tracking-mr verdict with mergedAt: null (P-03)', () => {
    renderSidebar({
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
    expect(el.textContent).toContain('Merged into develop');
    expect(el.textContent).not.toContain('·');
    expect(el.title).toBe('via !4821');
  });

  it('renders the merged/content-compare verdict (P-02)', () => {
    renderSidebar({
      branchState: baseBranchState,
      mergeBackVerdict: {
        kind: 'merged',
        via: 'content-compare',
        defaultBranch: 'develop',
        tagName: 'v33.7.0',
      },
    });
    const el = screen.getByTestId('merge-back-merged');
    expect(el).toHaveTextContent('Merged into develop');
    expect(el.title).toBe('no diff between v33.7.0 and develop');
  });

  it('renders the likely-not-merged verdict, with no button in the row (D-12 lock)', () => {
    renderSidebar({
      branchState: baseBranchState,
      mergeBackVerdict: {
        kind: 'likely-not-merged',
        defaultBranch: 'develop',
        tagName: 'v33.7.0',
        commitsNotInDefault: 12,
      },
    });
    const el = screen.getByTestId('merge-back-likely-not-merged');
    expect(el).toHaveTextContent('Likely not merged into develop');
    expect(el.title).toBe('v33.7.0 has 12 commits not in develop');
    // WR-05: scope to the row via the stable label-derived test hook rather
    // than a Tailwind class selector — a className/layout change to MetaRow
    // must not silently disable this lock.
    const row = screen.getByTestId('meta-row-merged-back');
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
    renderSidebar({
      branchState: baseBranchState,
      mergeBackVerdict: {
        kind: 'couldnt-verify',
        reason: 'no-mr-no-tag',
        // WR-08: the resolver now carries the BARE version — the form
        // `findReleaseTag` actually matches, with or without a `v`.
        expectedTagName: '33.7.0',
      },
    });
    const row = screen.getByTestId('meta-row-merged-back');
    expect(within(row).queryAllByRole('button')).toHaveLength(0);
    expect(
      row.querySelectorAll(
        'input, select, textarea, [role="checkbox"], [role="switch"], [role="menuitem"]',
      ),
    ).toHaveLength(0);
    expect(row.textContent).not.toMatch(/override|dismiss|acknowledge|confirm/i);
  });

  it('renders the couldnt-verify/no-mr-no-tag verdict', () => {
    renderSidebar({
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
    renderSidebar({
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
