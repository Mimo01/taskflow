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
  it('band: burnup, donut pair (status then MRs), type, assignee in order', () => {
    renderGrid(true);
    const ids = ['g-burnup', 'g-status', 'g-mrs', 'g-type', 'g-assignee'].map((i) =>
      screen.getByTestId(i),
    );
    for (let i = 0; i < ids.length - 1; i++) expect(follows(ids[i], ids[i + 1])).toBe(true);
    expect(screen.getByTestId('release-graph-grid').className).toContain('items-stretch');
  });

  it('the donut pair wraps both donuts in every layout', () => {
    for (const band of [true, false]) {
      const { unmount } = renderGrid(band);
      const pair = screen.getByTestId('release-graph-donuts');
      expect(pair).toContainElement(screen.getByTestId('g-status'));
      expect(pair).toContainElement(screen.getByTestId('g-mrs'));
      expect(pair).not.toContainElement(screen.getByTestId('g-type'));
      unmount();
    }
  });

  it('non-band: burnup | pair then assignee | type, one column under 640', () => {
    renderGrid(false);
    const grid = screen.getByTestId('release-graph-grid');
    expect(grid.className).not.toContain('items-stretch');
    expect(grid.className).toContain('@max-[640px]/page:grid-cols-1');
    expect(follows(screen.getByTestId('g-burnup'), screen.getByTestId('g-mrs'))).toBe(true);
    expect(follows(screen.getByTestId('g-mrs'), screen.getByTestId('g-assignee'))).toBe(true);
    expect(follows(screen.getByTestId('g-assignee'), screen.getByTestId('g-type'))).toBe(true);
    // below 640 the stack reads burnup, pair, type, assignee
    expect(screen.getByTestId('g-type').parentElement?.className).toContain(
      '@max-[640px]/page:order-3',
    );
    expect(screen.getByTestId('g-assignee').parentElement?.className).toContain(
      '@max-[640px]/page:order-4',
    );
  });
});
