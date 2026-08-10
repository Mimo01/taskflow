import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreateBranchDialog } from './CreateBranchDialog';

describe('CreateBranchDialog', () => {
  it('renders the title and description when open', () => {
    render(
      <CreateBranchDialog
        open
        onOpenChange={() => {}}
        branchName="release/33.5.0"
        defaultBranch="develop"
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText('Create release branch')).toBeInTheDocument();
    const description = screen.getByText(/off/);
    expect(description.textContent).toContain('release/33.5.0');
    expect(description.textContent).toContain('develop');
  });

  it('calls onConfirm exactly once when Create branch is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <CreateBranchDialog
        open
        onOpenChange={() => {}}
        branchName="release/33.5.0"
        defaultBranch="develop"
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Create branch' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows Creating… and disables the primary button while pending', () => {
    render(
      <CreateBranchDialog
        open
        onOpenChange={() => {}}
        branchName="release/33.5.0"
        defaultBranch="develop"
        onConfirm={() => {}}
        isPending
      />,
    );
    const button = screen.getByRole('button', { name: 'Creating…' });
    expect(button).toBeDisabled();
  });

  it('renders the error message inside the dialog and stays open (D-16)', () => {
    render(
      <CreateBranchDialog
        open
        onOpenChange={() => {}}
        branchName="release/33.5.0"
        defaultBranch="develop"
        onConfirm={() => {}}
        errorMessage="Branch already exists"
      />,
    );
    expect(screen.getByText(/Branch already exists/)).toBeInTheDocument();
    expect(screen.getByText('Create release branch')).toBeInTheDocument();
  });
});
