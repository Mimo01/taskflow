import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FixVersionField } from './FixVersionField';

const versions = [
  { id: '1', name: 'Alpha', released: false },
  { id: '2', name: 'Beta', released: true, releaseDate: '2026-01-01' },
];

const hook = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useProjectFixVersions', () => ({ useProjectFixVersions: hook }));

beforeEach(() => {
  hook.mockReturnValue({ data: versions, isLoading: false, isError: false });
});

describe('FixVersionField', () => {
  it("loads the modal's project versions (WR-04)", () => {
    render(<FixVersionField id="fv" value={[]} dispatch={vi.fn()} open projectKey="OTHER" />);
    expect(hook).toHaveBeenCalledWith(true, 'OTHER');
  });

  it('shows None when empty and joined names when selected', () => {
    const { rerender } = render(<FixVersionField id="fv" value={[]} dispatch={vi.fn()} open />);
    expect(screen.getByText('None')).toBeTruthy();
    rerender(
      <FixVersionField
        id="fv"
        value={[
          { id: '1', name: 'Alpha' },
          { id: '2', name: 'Beta' },
        ]}
        dispatch={vi.fn()}
        open
      />,
    );
    expect(screen.getByText('Alpha, Beta')).toBeTruthy();
  });

  it('lists versions with a check on selected and toggles', () => {
    const dispatch = vi.fn();
    render(
      <FixVersionField id="fv" value={[{ id: '1', name: 'Alpha' }]} dispatch={dispatch} open />,
    );
    fireEvent.click(screen.getByRole('button'));
    const alphas = screen.getAllByText('Alpha');
    const alphaRow = alphas[alphas.length - 1].closest('button');
    expect(alphaRow?.querySelector('svg.lucide-check')).toBeTruthy();
    fireEvent.click(screen.getByText('Beta'));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_FIELD',
      field: 'fixVersions',
      value: [
        { id: '1', name: 'Alpha' },
        { id: '2', name: 'Beta' },
      ],
    });
    fireEvent.click(screen.getAllByText('Alpha')[screen.getAllByText('Alpha').length - 1]);
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'SET_FIELD',
      field: 'fixVersions',
      value: [],
    });
  });

  it('disables the trigger', () => {
    render(<FixVersionField id="fv" value={[]} dispatch={vi.fn()} open disabled />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
