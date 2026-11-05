import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReleaseGraphGrid } from './ReleaseGraphGrid';

function renderGrid(band: boolean) {
  return render(
    <ReleaseGraphGrid
      band={band}
      burnup={<div data-testid="g-burnup" />}
      status={<div data-testid="g-status" />}
      mrs={<div data-testid="g-mrs" />}
      type={<div data-testid="g-type" />}
      assignee={(h) => <div data-testid="g-assignee" data-fit={h ?? 'none'} />}
    />,
  );
}

const follows = (a: HTMLElement, b: HTMLElement) =>
  !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('ReleaseGraphGrid', () => {
  it('band: burnup, status over type, assignee, MRs last', () => {
    renderGrid(true);
    const ids = ['g-burnup', 'g-status', 'g-type', 'g-assignee', 'g-mrs'].map((i) =>
      screen.getByTestId(i),
    );
    for (let i = 0; i < ids.length - 1; i++) expect(follows(ids[i], ids[i + 1])).toBe(true);
    expect(screen.getByTestId('release-graph-grid').className).toContain('items-start');
  });

  it('status and type share one stacked cell in every layout; MRs stay outside it', () => {
    for (const band of [true, false]) {
      const { unmount } = renderGrid(band);
      const lists = screen.getByTestId('release-graph-lists');
      expect(lists).toContainElement(screen.getByTestId('g-status'));
      expect(lists).toContainElement(screen.getByTestId('g-type'));
      expect(follows(screen.getByTestId('g-status'), screen.getByTestId('g-type'))).toBe(true);
      expect(lists).not.toContainElement(screen.getByTestId('g-mrs'));
      unmount();
    }
  });

  it('non-band: burnup | lists then assignee | MRs; one column under 440', () => {
    renderGrid(false);
    const grid = screen.getByTestId('release-graph-grid');
    expect(grid.className).toContain('@max-[640px]/page:grid-cols-[minmax(0,1fr)_auto]');
    expect(grid.className).toContain('@max-[440px]/page:grid-cols-1');
    const order = ['g-burnup', 'g-status', 'g-type', 'g-assignee', 'g-mrs'].map((i) =>
      screen.getByTestId(i),
    );
    for (let i = 0; i < order.length - 1; i++) expect(follows(order[i], order[i + 1])).toBe(true);
  });

  it('assignee gets no fit height until the neighbours are measured (jsdom has no layout)', () => {
    renderGrid(true);
    expect(screen.getByTestId('g-assignee')).toHaveAttribute('data-fit', 'none');
  });
});
