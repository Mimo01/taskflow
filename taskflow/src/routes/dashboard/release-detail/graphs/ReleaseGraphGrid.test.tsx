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
      assignee={<div data-testid="g-assignee" />}
    />,
  );
}

const follows = (a: HTMLElement, b: HTMLElement) =>
  !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('ReleaseGraphGrid', () => {
  it('band: burnup, MRs, status over type, assignee in order', () => {
    renderGrid(true);
    const ids = ['g-burnup', 'g-mrs', 'g-status', 'g-type', 'g-assignee'].map((i) =>
      screen.getByTestId(i),
    );
    for (let i = 0; i < ids.length - 1; i++) expect(follows(ids[i], ids[i + 1])).toBe(true);
    expect(screen.getByTestId('release-graph-grid').className).toContain('items-stretch');
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

  it('non-band: burnup | MRs then assignee | lists; MRs beside lists under 640, one column under 440', () => {
    renderGrid(false);
    const grid = screen.getByTestId('release-graph-grid');
    expect(grid.className).not.toContain('items-stretch');
    expect(grid.className).toContain('@max-[640px]/page:grid-cols-[auto_minmax(0,1fr)]');
    expect(grid.className).toContain('@max-[440px]/page:grid-cols-1');
    expect(follows(screen.getByTestId('g-burnup'), screen.getByTestId('g-mrs'))).toBe(true);
    expect(follows(screen.getByTestId('g-mrs'), screen.getByTestId('g-assignee'))).toBe(true);
    expect(follows(screen.getByTestId('g-assignee'), screen.getByTestId('g-status'))).toBe(true);
    expect(screen.getByTestId('release-graph-lists').parentElement?.className).toContain(
      '@max-[640px]/page:order-3',
    );
    expect(screen.getByTestId('g-assignee').parentElement?.className).toContain(
      '@max-[640px]/page:order-4',
    );
  });
});
