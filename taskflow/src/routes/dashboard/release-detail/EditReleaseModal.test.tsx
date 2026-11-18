import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditReleaseModal } from './EditReleaseModal';

function renderModal(overrides: Partial<Parameters<typeof EditReleaseModal>[0]> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    editName: 'R1',
    setEditName: vi.fn(),
    editDate: '2026-11-01',
    setEditDate: vi.fn(),
    editDescription: 'desc',
    setEditDescription: vi.fn(),
    editReleased: false,
    setEditReleased: vi.fn(),
    editMilestoneTitle: 'M1',
    setEditMilestoneTitle: vi.fn(),
    editMilestoneDescription: 'mdesc',
    setEditMilestoneDescription: vi.fn(),
    isSaving: false,
    jiraError: null,
    gitlabError: null,
    showMilestoneSection: false,
    isSaveDisabled: false,
    onCancel: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
  render(<EditReleaseModal {...props} />);
  return props;
}

describe('EditReleaseModal', () => {
  it('renders title and sentence-case labels', () => {
    renderModal();
    expect(screen.getByText('Edit release')).toBeTruthy();
    for (const t of ['Name', 'Description', 'Release date']) {
      const el = screen.getByText(t, { selector: 'label' });
      expect(el.className).toContain('text-xs font-semibold text-muted-foreground');
    }
    expect(screen.getByText('Released', { selector: 'label' })).toBeTruthy();
  });

  it('puts date and switch in the aside, name and description in main', () => {
    renderModal();
    const aside = screen.getByLabelText('Release details');
    expect(aside.contains(document.getElementById('release-date'))).toBe(true);
    expect(aside.contains(screen.getByRole('switch'))).toBe(true);
    expect(aside.contains(document.getElementById('release-name'))).toBe(false);
    expect(aside.contains(document.getElementById('release-description'))).toBe(false);
  });

  it('toggles Released via the shared switch', async () => {
    const p = renderModal({ editReleased: true });
    const sw = screen.getByRole('switch');
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(sw);
    expect(p.setEditReleased).toHaveBeenCalledWith(false);
    expect(document.querySelector('.bg-green-600')).toBeNull();
  });

  it('disables the switch while saving', () => {
    renderModal({ isSaving: true });
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
  });

  it('hides the milestone section when no milestone is matched', () => {
    renderModal();
    expect(screen.queryByText('GitLab milestone')).toBeNull();
    expect(document.getElementById('milestone-title')).toBeNull();
  });

  it('shows the milestone section when matched', () => {
    renderModal({ showMilestoneSection: true });
    expect(screen.getByText('GitLab milestone')).toBeTruthy();
    expect(document.getElementById('milestone-title')).toBeTruthy();
    expect(document.getElementById('milestone-description')?.tagName).toBe('TEXTAREA');
  });

  it('uses plain textareas with no wiki editor', () => {
    renderModal({ showMilestoneSection: true });
    expect(document.getElementById('release-description')?.tagName).toBe('TEXTAREA');
    expect(screen.queryByTestId('wiki-editor-skeleton')).toBeNull();
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('shows per-source errors in the footer', () => {
    renderModal({ jiraError: 'boom', gitlabError: 'bad' });
    const jira = screen.getByText("Couldn't update the Jira version: boom. Try again.");
    expect(jira.className).toContain('text-destructive');
    expect(screen.getByText("Couldn't update the GitLab milestone: bad. Try again.")).toBeTruthy();
  });

  it('Save and Cancel call handlers', async () => {
    const p = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(p.onSave).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(p.onCancel).toHaveBeenCalled();
  });

  it('shows Saving… when pending and disables Save when isSaveDisabled', () => {
    renderModal({ isSaving: true, isSaveDisabled: true });
    const btn = screen.getByRole('button', { name: /Saving…/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Cmd+Enter saves unless disabled', () => {
    const p = renderModal();
    fireEvent.keyDown(document.getElementById('release-name') as HTMLElement, {
      key: 'Enter',
      metaKey: true,
    });
    expect(p.onSave).toHaveBeenCalledTimes(1);
  });

  it('Cmd+Enter does nothing when save is disabled', () => {
    const p = renderModal({ isSaveDisabled: true });
    fireEvent.keyDown(document.getElementById('release-name') as HTMLElement, {
      key: 'Enter',
      metaKey: true,
    });
    expect(p.onSave).not.toHaveBeenCalled();
  });

  it('X button closes via onOpenChange(false)', async () => {
    const p = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
  });
});
