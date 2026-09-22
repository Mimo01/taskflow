import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from './date-picker';

describe('DatePicker', () => {
  it('renders placeholder text when value is empty', () => {
    render(<DatePicker value="" onChange={vi.fn()} placeholder="Pick a date" />);
    expect(screen.getByText('Pick a date')).toBeTruthy();
  });

  it('renders the formatted date when value is set', () => {
    render(<DatePicker value="2026-09-22" onChange={vi.fn()} />);
    expect(screen.getByText(/Sep 22, 2026/)).toBeTruthy();
  });

  it('opens a calendar grid when the trigger is clicked', async () => {
    render(<DatePicker value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('grid')).toBeTruthy();
  });

  it('calls onChange with the clicked day and closes the popover', async () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-09-01" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Sep 1, 2026/ }));
    await screen.findByRole('grid');

    const dayButton = await screen.findByRole('button', { name: /September 22nd, 2026/i });
    fireEvent.click(dayButton);

    expect(onChange).toHaveBeenCalledWith('2026-09-22');
  });

  it('does not reveal a grid when disabled trigger is clicked', () => {
    render(<DatePicker value="" onChange={vi.fn()} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('renders a clear control when clearable and a value is set, which calls onChange with empty string', () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-09-22" onChange={onChange} clearable />);
    const clearBtn = screen.getByRole('button', { name: /clear date/i });
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('round-trips the clicked day to the same YYYY-MM-DD string (TZ regression)', async () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-09-01" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Sep 1, 2026/ }));
    await screen.findByRole('grid');

    const dayButton = await screen.findByRole('button', { name: /September 15th, 2026/i });
    fireEvent.click(dayButton);

    expect(onChange).toHaveBeenCalledWith('2026-09-15');
  });
});
