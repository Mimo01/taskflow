import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreateMilestoneDialog } from './CreateMilestoneDialog';

const RECENT_MILESTONES = [
  { title: '33.5.0 (21.07.2026)', project_id: 1, due_date: '2026-07-21' },
  { title: '33.4.0 (14.07.2026)', project_id: 1, due_date: '2026-07-14' },
];

describe('CreateMilestoneDialog', () => {
  it('renders the locked copy and prefills a valid title from the version name and release date (WR-01 Test G)', () => {
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={() => {}}
        releaseDate="2026-07-21"
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={1}
        onConfirm={() => {}}
        versionName="33.6.0"
      />,
    );
    expect(screen.getByText('Create GitLab milestone')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Create a milestone for this release. Recent milestones are listed below for reference.',
      ),
    ).toBeInTheDocument();
    const input = screen.getByLabelText('Milestone title') as HTMLInputElement;
    expect(input.value).toBe('33.6.0 (21.07.2026)');
    expect(screen.getByText('Format: X.Y.Z (DD.MM.YYYY)')).toBeInTheDocument();
    expect(
      screen.queryByText('Title must match X.Y.Z (DD.MM.YYYY), e.g. 33.5.0 (21.07.2026)'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create milestone' })).toBeEnabled();
  });

  it('extracts the version from a v-prefixed Jira version name (WR-01 Test H)', () => {
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={() => {}}
        releaseDate="2026-07-21"
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={1}
        onConfirm={() => {}}
        versionName="v33.6.0"
      />,
    );
    const input = screen.getByLabelText('Milestone title') as HTMLInputElement;
    expect(input.value).toBe('33.6.0 (21.07.2026)');
  });

  it('prefills the empty string when no X.Y.Z version can be extracted (WR-01 Test I)', () => {
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={() => {}}
        releaseDate="2026-07-21"
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={1}
        onConfirm={() => {}}
        versionName="Backlog"
      />,
    );
    const input = screen.getByLabelText('Milestone title') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('prefills the empty string when releaseDate is null (WR-01 Test J)', () => {
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={() => {}}
        releaseDate={null}
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={1}
        onConfirm={() => {}}
        versionName="33.5.0"
      />,
    );
    const input = screen.getByLabelText('Milestone title') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('blocks submit and shows "GitLab project not configured" when the project is unconfigured (WR-10 Test K)', () => {
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={() => {}}
        releaseDate="2026-07-21"
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={null}
        onConfirm={() => {}}
        versionName="33.6.0"
      />,
    );
    expect(screen.getByText('GitLab project not configured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create milestone' })).toBeDisabled();
  });

  it('lists recent milestones read-only, newest first', () => {
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={() => {}}
        releaseDate="2026-07-21"
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={1}
        onConfirm={() => {}}
        versionName="33.5.0"
      />,
    );
    expect(screen.getByText('Recent milestones')).toBeInTheDocument();
    const rows = screen.getAllByText(/^33\./);
    expect(rows[0].textContent).toBe('33.5.0 (21.07.2026)');
    expect(rows[1].textContent).toBe('33.4.0 (14.07.2026)');
    // Read-only — not clickable buttons.
    expect(screen.queryAllByRole('button', { name: /33\./ })).toHaveLength(0);
  });

  it('shows the format error and disables submit for a bare-semver title (D-01)', async () => {
    const user = userEvent.setup();
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={() => {}}
        releaseDate="2026-07-21"
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={1}
        onConfirm={() => {}}
        versionName="33.5.0"
      />,
    );
    const input = screen.getByLabelText('Milestone title');
    await user.clear(input);
    await user.type(input, '1.1.0');
    expect(
      screen.getByText('Title must match X.Y.Z (DD.MM.YYYY), e.g. 33.5.0 (21.07.2026)'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create milestone' })).toBeDisabled();
  });

  it('enables submit for a valid non-duplicate title', async () => {
    const user = userEvent.setup();
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={() => {}}
        releaseDate="2026-07-21"
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={1}
        onConfirm={() => {}}
        versionName="33.5.0"
      />,
    );
    const input = screen.getByLabelText('Milestone title');
    await user.clear(input);
    await user.type(input, '33.6.0 (28.07.2026)');
    expect(screen.getByRole('button', { name: 'Create milestone' })).toBeEnabled();
  });

  it('blocks a normalized-duplicate title and shows the duplicate message (RELMS-04)', async () => {
    const user = userEvent.setup();
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={() => {}}
        releaseDate="2026-07-21"
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={1}
        onConfirm={() => {}}
        versionName="33.5.0"
      />,
    );
    const input = screen.getByLabelText('Milestone title');
    await user.clear(input);
    await user.type(input, '33.5.0  (21.07.2026)');
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' &&
          element.textContent ===
            "A milestone named '33.5.0  (21.07.2026)' already exists in this project.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create milestone' })).toBeDisabled();
  });

  it('renders a server error inline and keeps the dialog usable (D-08/D-16)', () => {
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={() => {}}
        releaseDate="2026-07-21"
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={1}
        onConfirm={() => {}}
        versionName="33.5.0"
        errorMessage="Title has already been taken"
      />,
    );
    expect(screen.getByText('Title has already been taken')).toBeInTheDocument();
    expect(screen.getByText('Create GitLab milestone')).toBeInTheDocument();
  });

  it('shows Creating… and disables the primary button while pending', () => {
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={() => {}}
        releaseDate="2026-07-21"
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={1}
        onConfirm={() => {}}
        versionName="33.5.0"
        isPending
      />,
    );
    const button = screen.getByRole('button', { name: 'Creating…' });
    expect(button).toBeDisabled();
  });

  it('WR-03 Test L: disables Cancel while pending', () => {
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={() => {}}
        releaseDate="2026-07-21"
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={1}
        onConfirm={() => {}}
        versionName="33.5.0"
        isPending
      />,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('WR-03 Test M: Escape does not call onOpenChange while pending', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={onOpenChange}
        releaseDate="2026-07-21"
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={1}
        onConfirm={() => {}}
        versionName="33.5.0"
        isPending
      />,
    );
    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('WR-03 Test N: Escape calls onOpenChange(false) when not pending', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={onOpenChange}
        releaseDate="2026-07-21"
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={1}
        onConfirm={() => {}}
        versionName="33.5.0"
      />,
    );
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });

  it('WR-03 Test O: clicking Create milestone while pending does not call onConfirm again', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={() => {}}
        releaseDate="2026-07-21"
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={1}
        onConfirm={onConfirm}
        versionName="33.6.0"
        isPending
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Creating…' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm with the exact typed title, unnormalized', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <CreateMilestoneDialog
        open
        onOpenChange={() => {}}
        releaseDate="2026-07-21"
        recentMilestones={RECENT_MILESTONES}
        activeGitlabProject={1}
        onConfirm={onConfirm}
        versionName="33.5.0"
      />,
    );
    const input = screen.getByLabelText('Milestone title');
    await user.clear(input);
    await user.type(input, '33.6.0 (28.07.2026)');
    await user.click(screen.getByRole('button', { name: 'Create milestone' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('33.6.0 (28.07.2026)');
  });
});
