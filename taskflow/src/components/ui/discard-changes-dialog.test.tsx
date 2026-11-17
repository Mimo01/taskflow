import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DiscardChangesDialog } from './discard-changes-dialog';

describe('DiscardChangesDialog', () => {
  it('renders copy and buttons in order, Keep editing focused', async () => {
    render(<DiscardChangesDialog open onKeepEditing={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByText('Discard changes?')).toBeTruthy();
    expect(screen.getByText('Your unsaved changes will be lost.')).toBeTruthy();
    const buttons = screen.getAllByRole('button').filter((b) => b.textContent);
    expect(buttons.map((b) => b.textContent)).toEqual(['Keep editing', 'Discard']);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Keep editing')));
  });

  it('Keep editing and Esc call onKeepEditing only', async () => {
    const keep = vi.fn();
    const discard = vi.fn();
    render(<DiscardChangesDialog open onKeepEditing={keep} onDiscard={discard} />);
    await userEvent.click(screen.getByText('Keep editing'));
    expect(keep).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    expect(keep).toHaveBeenCalledTimes(2);
    expect(discard).not.toHaveBeenCalled();
  });

  it('Discard calls onDiscard only', async () => {
    const keep = vi.fn();
    const discard = vi.fn();
    render(<DiscardChangesDialog open onKeepEditing={keep} onDiscard={discard} />);
    await userEvent.click(screen.getByText('Discard'));
    expect(discard).toHaveBeenCalledOnce();
    expect(keep).not.toHaveBeenCalled();
  });

  it('Esc inside a parent dialog closes only the discard dialog', async () => {
    const parentChange = vi.fn();
    const keep = vi.fn();
    render(
      <Dialog open onOpenChange={parentChange}>
        <DialogContent>
          <p>parent</p>
          <DiscardChangesDialog open onKeepEditing={keep} onDiscard={vi.fn()} />
        </DialogContent>
      </Dialog>,
    );
    await userEvent.keyboard('{Escape}');
    expect(keep).toHaveBeenCalled();
    expect(parentChange).not.toHaveBeenCalled();
  });
});
