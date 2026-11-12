import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  APPROVED_EXAMPLE,
  V4_NESTED,
  V12_PROSE_TRAILER,
} from '@/lib/release-notes/__fixtures__/samples';
import { ReleaseNotesBody } from './ReleaseNotesBody';

describe('ReleaseNotesBody', () => {
  it('renders headline, group labels and titles with details hidden', () => {
    render(<ReleaseNotesBody notes={APPROVED_EXAMPLE} />);
    expect(screen.getByText('Notifications got a full redesign.')).toBeInTheDocument();
    for (const label of ['New', 'Improved', 'Fixed']) {
      expect(screen.getByRole('heading', { level: 4, name: label })).toBeInTheDocument();
    }
    expect(screen.getByText('Notification panel')).toBeInTheDocument();
    expect(screen.queryByText('stacks per issue, quick actions')).not.toBeInTheDocument();
  });

  it('expands a bullet with a detail on click; bullets without detail are not buttons', () => {
    render(<ReleaseNotesBody notes={APPROVED_EXAMPLE} />);
    const btn = screen.getByRole('button', { name: /Notification panel/ });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('stacks per issue, quick actions')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Epic picker on stories/ }),
    ).not.toBeInTheDocument();
  });

  it('shows nested children when expanded', () => {
    render(<ReleaseNotesBody notes={V4_NESTED} />);
    expect(screen.queryByText('Grouping')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Issue detail/ }));
    expect(screen.getByText('Grouping')).toBeInTheDocument();
  });

  it('falls back to raw markdown for unstructured notes', () => {
    render(<ReleaseNotesBody notes={V12_PROSE_TRAILER} />);
    expect(screen.getByText(/Fix the thing that was broken/)).toBeInTheDocument();
    expect(screen.queryByText(/Co-Authored-By/)).not.toBeInTheDocument();
  });

  it('shows "No release notes" when empty', () => {
    render(<ReleaseNotesBody notes="" />);
    expect(screen.getByText('No release notes')).toBeInTheDocument();
  });

  it('collapses a Fixed section of more than 3 items into "N fixes"', () => {
    const notes = 'H.\n\n### Fixed\n- one\n- two\n- three\n- four';
    render(<ReleaseNotesBody notes={notes} />);
    expect(screen.queryByText('one')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /4 fixes/ }));
    expect(screen.getByText('four')).toBeInTheDocument();
  });

  it('filterKinds hides other sections', () => {
    render(<ReleaseNotesBody notes={APPROVED_EXAMPLE} filterKinds={['fixed']} />);
    expect(screen.queryByText('Notification panel')).not.toBeInTheDocument();
    expect(screen.getByText(/Duplicate notifications/)).toBeInTheDocument();
  });

  it('highlight auto-expands bullets whose detail matches', () => {
    render(<ReleaseNotesBody notes={APPROVED_EXAMPLE} highlight="quick actions" />);
    expect(screen.getByText('stacks per issue, quick actions')).toBeInTheDocument();
  });
});
