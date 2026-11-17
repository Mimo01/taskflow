import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ModeToggle } from './ModeToggle';

describe('ModeToggle', () => {
  it('marks the active segment and switches on click', () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="rich" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Rich' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Source' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('radio', { name: 'Source' }));
    expect(onChange).toHaveBeenCalledWith('source');
  });

  it('clicking the active segment does nothing', () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="rich" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Rich' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables Rich when richDisabled', () => {
    const onChange = vi.fn();
    render(<ModeToggle mode="source" onChange={onChange} richDisabled />);
    const rich = screen.getByRole('radio', { name: 'Rich' });
    expect(rich).toBeDisabled();
    fireEvent.click(rich);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps editor focus on mousedown', () => {
    render(<ModeToggle mode="rich" onChange={vi.fn()} />);
    expect(fireEvent.mouseDown(screen.getByRole('radio', { name: 'Source' }))).toBe(false);
  });

  it('shows the switch tooltip with keycaps', async () => {
    const user = userEvent.setup();
    render(<ModeToggle mode="rich" onChange={vi.fn()} />);
    await user.hover(screen.getByRole('radio', { name: 'Source' }));
    expect(await screen.findByText('Switch to source', {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.getAllByText('M', { selector: 'kbd' }).length).toBeGreaterThan(0);
  });

  it('shows the D-07 copy on the disabled Rich segment', async () => {
    const user = userEvent.setup();
    render(<ModeToggle mode="source" onChange={vi.fn()} richDisabled />);
    const trigger = screen.getByRole('radio', { name: 'Rich' }).parentElement as HTMLElement;
    await user.hover(trigger);
    expect(
      await screen.findByText(
        "This text can't be edited in rich view without risking its formatting.",
        {},
        { timeout: 2000 },
      ),
    ).toBeTruthy();
  });
});
