import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReleasesSkeleton } from '../ReleasesSkeleton';
import { ReleaseGroupLabel, ReleaseListHeader, ReleaseListRow } from './ReleaseListRow';

const version = { id: '10001', name: '2.1.0', releaseDate: '2026-11-01', released: false };

function renderRow(overrides: Partial<Parameters<typeof ReleaseListRow>[0]> = {}) {
  const onOpen = vi.fn();
  render(
    <ReleaseListRow
      version={version}
      pill={{ tone: 'muted', label: 'In 3 days' }}
      showPackage={false}
      pkg={null}
      pkgLoading={false}
      breakdown={{ done: 1, indeterminate: 0, new: 1 }}
      graphLoading={false}
      graphError={false}
      onOpen={onOpen}
      {...overrides}
    />,
  );
  return { onOpen, row: screen.getByTestId('release-row') };
}

describe('ReleaseListRow', () => {
  it('has one overlay button, no anchors, and opens by id', () => {
    const { onOpen, row } = renderRow();
    const buttons = within(row).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName('Open release 2.1.0');
    expect(row.querySelectorAll('a')).toHaveLength(0);
    fireEvent.click(buttons[0]);
    expect(onOpen).toHaveBeenCalledWith('10001');
  });

  it('truncates the name with a title', () => {
    renderRow();
    const name = screen.getByText('2.1.0');
    expect(name).toHaveAttribute('title', '2.1.0');
    expect(name).toHaveClass('truncate');
  });

  it('renders the package cell only when showPackage', () => {
    const { row } = renderRow({ showPackage: false });
    expect(within(row).queryByTestId('row-deployment-package')).toBeNull();
  });

  it('renders the package cell when showPackage is true', () => {
    const { row } = renderRow({ showPackage: true });
    expect(within(row).getByTestId('row-deployment-package')).toBeInTheDocument();
  });

  it('shows the date, or a dash when undated', () => {
    renderRow();
    expect(screen.getByText('2026-11-01')).toBeInTheDocument();
  });

  it('shows a dash for an undated version', () => {
    renderRow({ version: { ...version, releaseDate: undefined } });
    expect(screen.getAllByText('–').length).toBeGreaterThan(0);
  });

  it('has exactly one status pill', () => {
    const { row } = renderRow();
    expect(within(row).getAllByTestId('release-status-pill')).toHaveLength(1);
    expect(within(row).getByText('In 3 days')).toBeInTheDocument();
  });
});

describe('ReleaseListHeader', () => {
  it('lists all columns with the package column', () => {
    render(<ReleaseListHeader showPackage />);
    for (const t of ['Version', 'Package', 'Date', 'Status', 'Issues']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
  });

  it('omits Package when not shown', () => {
    render(<ReleaseListHeader showPackage={false} />);
    expect(screen.queryByText('Package')).toBeNull();
    expect(screen.getByText('Version')).toBeInTheDocument();
  });
});

describe('ReleaseGroupLabel', () => {
  it('renders label and count', () => {
    render(<ReleaseGroupLabel label="Upcoming" count={3} />);
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('ReleasesSkeleton', () => {
  it('renders 5 skeleton rows', () => {
    render(<ReleasesSkeleton />);
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(5);
  });
});
