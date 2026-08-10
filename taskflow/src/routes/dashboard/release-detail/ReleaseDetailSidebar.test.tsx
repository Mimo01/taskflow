// RELBR-02/RELBR-03: sidebar renders every BranchState variant with UI-SPEC copy

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { JiraFixVersion } from '@/services/jira';
import type { ReleaseMatch } from '@/services/releaseLinker';
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
    expect(el.textContent).toContain("can't be derived");
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

  it('renders the missing state', () => {
    renderSidebar({ branchState: { kind: 'missing', branchName: 'release/33.5.0' } });
    const el = screen.getByTestId('branch-status-missing');
    expect(el).toHaveTextContent('No release branch');
  });

  it('renders the released state with its tag, and offers no Create action', () => {
    renderSidebar({
      branchState: { kind: 'released', branchName: 'release/33.6.0', tagName: 'v33.6.0' },
    });
    const el = screen.getByTestId('branch-status-released');
    expect(el).toHaveTextContent('Released');
    expect(el).toHaveTextContent('v33.6.0');
    // A shipped release must not invite re-creating its merged branch.
    expect(screen.queryByRole('button', { name: /create branch/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('branch-status-missing')).not.toBeInTheDocument();
  });

  it('renders the released state without a tag — a missing tag is not evidence of drift', () => {
    renderSidebar({
      branchState: { kind: 'released', branchName: 'release/33.5.0', tagName: null },
    });
    const el = screen.getByTestId('branch-status-released');
    expect(el).toHaveTextContent('Released');
    expect(screen.queryByTestId('branch-status-missing')).not.toBeInTheDocument();
  });

  it('Test F: renders the check-failed state', () => {
    renderSidebar({
      branchState: { kind: 'check-failed', branchName: 'release/33.5.0' },
    });
    const el = screen.getByTestId('branch-status-check-failed');
    expect(el).toHaveTextContent("Couldn't check the release branch");
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
