import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STATUS_CATEGORY_COLOR } from '@/lib/statusStyles';
import { type ChartDatum, cfdRows, EpicChartTooltip, timeRows } from './EpicChartTooltip';

const rowsOf = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-slot="tooltip-row"]')] as HTMLElement[];

const history: ChartDatum = {
  date: '2026-09-15',
  t: Date.UTC(2026, 8, 15),
  done: 3,
  inProgress: 2,
  todo: 1,
  remaining: 3,
};

describe('EpicChartTooltip', () => {
  it('renders a history datum with a full-date title and fixed-order CFD rows', () => {
    const { container, getByText } = render(
      <EpicChartTooltip
        active
        payload={[{ payload: history }]}
        metric="count"
        rows={cfdRows('count')}
      />,
    );
    expect(getByText('Sep 15, 2026')).toBeInTheDocument();
    const rows = rowsOf(container);
    expect(rows.map((r) => r.textContent)).toEqual([
      'Completed3',
      'In progress2',
      'To do1',
      'Remaining3',
    ]);
    const swatch = (i: number) => (rows[i].children[0] as HTMLElement).style.background;
    expect(swatch(0)).toBe(STATUS_CATEGORY_COLOR.done);
    expect(swatch(1)).toBe(STATUS_CATEGORY_COLOR.indeterminate);
    expect(swatch(2)).toBe(STATUS_CATEGORY_COLOR.new);
  });

  it('formats values in the active metric (SP)', () => {
    const { container } = render(
      <EpicChartTooltip active payload={[{ payload: history }]} metric="sp" rows={cfdRows('sp')} />,
    );
    expect(rowsOf(container)[0].textContent).toBe('Completed3 SP');
  });

  it('shows Forecast and Range rows (dashed swatch) and no CFD rows for a future datum', () => {
    const future: ChartDatum = {
      date: '2026-10-07',
      t: Date.UTC(2026, 9, 7),
      done: null,
      remaining: null,
      forecast: 2,
      band: [1, 3.5],
    };
    const { container } = render(
      <EpicChartTooltip
        active
        payload={[{ payload: future }]}
        metric="count"
        rows={cfdRows('count')}
      />,
    );
    const rows = rowsOf(container);
    expect(rows.map((r) => r.textContent)).toEqual(['Forecast2', 'Range1–3.5']);
    expect((rows[0].children[0] as HTMLElement).className).toContain('border-dashed');
  });

  it('notes a clipped pessimistic bound on future points', () => {
    const future: ChartDatum = {
      date: '2026-11-29',
      t: Date.UTC(2026, 10, 29),
      remaining: null,
      forecast: 4,
      band: [0, 6],
    };
    const { getByText } = render(
      <EpicChartTooltip
        active
        payload={[{ payload: future }]}
        metric="count"
        rows={cfdRows('count')}
        clippedAfter="2026-11-29"
      />,
    );
    expect(getByText('pessimistic after Nov 29')).toBeInTheDocument();
  });

  it('time rows format hours via the supplied formatter', () => {
    const d: ChartDatum = {
      date: '2026-09-15',
      t: 0,
      estimate: 3,
      logged: 1.5,
      remaining: 1.5,
    };
    const { container } = render(
      <EpicChartTooltip
        active
        payload={[{ payload: d }]}
        metric="time"
        rows={timeRows((h) => `${h}h`)}
      />,
    );
    expect(rowsOf(container).map((r) => r.textContent)).toEqual([
      'Estimate3h',
      'Logged1.5h',
      'Remaining1.5h',
    ]);
  });

  it('renders nothing when inactive or empty', () => {
    const a = render(
      <EpicChartTooltip
        active={false}
        payload={[{ payload: history }]}
        metric="count"
        rows={cfdRows('count')}
      />,
    );
    expect(a.container).toBeEmptyDOMElement();
    const b = render(
      <EpicChartTooltip active payload={[]} metric="count" rows={cfdRows('count')} />,
    );
    expect(b.container).toBeEmptyDOMElement();
  });
});
