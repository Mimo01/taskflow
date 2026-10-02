import { cleanup, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STATUS_CATEGORY_COLOR } from '@/lib/statusStyles';
import { averageForecasts, type EpicForecast, formatFinishDate } from '@/lib/epic-progress';
import { type ChartDatum, cfdRows, EpicChartTooltip, timeRows } from './EpicChartTooltip';
import { ForecastLegend } from './EpicCfdChart';

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
  it('renders a history datum with a year-less title (current year) and fixed-order CFD rows', () => {
    const { container, getByText } = render(
      <EpicChartTooltip
        active
        payload={[{ payload: history }]}
        metric="count"
        rows={cfdRows('count')}
        today="2026-09-30"
      />,
    );
    expect(getByText('Sep 15')).toBeInTheDocument();
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

  it("adds the year to the title when it differs from today's year", () => {
    const { getByText } = render(
      <EpicChartTooltip
        active
        payload={[{ payload: history }]}
        metric="count"
        rows={cfdRows('count')}
        today="2027-01-10"
      />,
    );
    expect(getByText('Sep 15, 2026')).toBeInTheDocument();
  });

  it("a history datum on today's date has no Forecast row", () => {
    const onToday: ChartDatum = { ...history, forecast: 3, band: [3, 3] };
    const { container } = render(
      <EpicChartTooltip
        active
        payload={[{ payload: onToday }]}
        metric="count"
        rows={cfdRows('count')}
        today="2026-09-15"
      />,
    );
    expect(rowsOf(container).some((r) => r.textContent?.startsWith('Forecast'))).toBe(false);
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

  it('shows a From today row with working days, and flags non-working days', () => {
    const base: ChartDatum = {
      date: '2026-10-07',
      t: Date.UTC(2026, 9, 7),
      remaining: null,
      forecast: 2,
      band: [1, 3.5],
    };
    const view = (d: ChartDatum) =>
      rowsOf(
        render(
          <EpicChartTooltip
            active
            payload={[{ payload: d }]}
            metric="count"
            rows={cfdRows('count')}
          />,
        ).container,
      );
    const working = view({ ...base, wd: 7, workingDay: true });
    expect(working.map((r) => r.textContent)).toEqual([
      'Forecast2',
      'Range1–3.5',
      'From today7 working days',
    ]);
    expect(working[2].children[0]).toHaveAttribute('data-marker', 'icon');
    const off = view({ ...base, wd: 7, workingDay: false });
    expect(off[2].textContent).toContain('non-working day');
    expect(view({ ...base, wd: 0, workingDay: true }).map((r) => r.textContent)).toEqual([
      'Forecast2',
      'Range1–3.5',
    ]);
  });

  it('line series rows use a line marker', () => {
    const { container } = render(
      <EpicChartTooltip
        active
        payload={[{ payload: history }]}
        metric="count"
        rows={cfdRows('count')}
      />,
    );
    const rows = rowsOf(container);
    expect(rows[3].children[0]).toHaveClass('h-0.5');
    expect(rows[0].children[0]).not.toHaveClass('h-0.5');
  });

  it('notes a clipped latest bound on future points', () => {
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
    expect(getByText('Latest falls after Nov 29')).toBeInTheDocument();
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

  it('uses neutral markers for non-status rows and status swatches only for statuses', () => {
    const cfd = rowsOf(
      render(
        <EpicChartTooltip
          active
          payload={[{ payload: history }]}
          metric="count"
          rows={cfdRows('count')}
        />,
      ).container,
    );
    // Remaining is the one status-coloured line shared by both charts (261001-sqm): In progress.
    expect(cfd.map((r) => r.children[0].getAttribute('data-marker'))).toEqual([
      'status',
      'status',
      'status',
      'status-line',
    ]);
    expect((cfd[3].children[0] as HTMLElement).style.background).toBe(
      STATUS_CATEGORY_COLOR.indeterminate,
    );
    const t: ChartDatum = { date: '2026-09-15', t: 0, estimate: 3, logged: 1, remaining: 2 };
    const time = rowsOf(
      render(
        <EpicChartTooltip
          active
          payload={[{ payload: t }]}
          metric="time"
          rows={timeRows((h) => `${h}h`)}
        />,
      ).container,
    );
    // Estimate keeps a distinct filled-area glyph (not the forecast 'band') — 261001-rtw WR-02.
    expect(time.map((r) => r.children[0].getAttribute('data-marker'))).toEqual([
      'status-area',
      'status-line',
      'status-line',
    ]);
    expect(time.map((r) => (r.children[0] as HTMLElement).style.background)).toEqual([
      STATUS_CATEGORY_COLOR.new,
      STATUS_CATEGORY_COLOR.done,
      STATUS_CATEGORY_COLOR.indeterminate,
    ]);
    const future: ChartDatum = {
      date: '2026-10-07',
      t: 0,
      remaining: null,
      forecast: 2,
      band: [1, 3],
      wd: 3,
      workingDay: true,
    };
    const fut = rowsOf(
      render(
        <EpicChartTooltip
          active
          payload={[{ payload: future }]}
          metric="count"
          rows={cfdRows('count')}
        />,
      ).container,
    );
    expect(fut.map((r) => r.children[0].getAttribute('data-marker'))).toEqual([
      'dashed',
      'band',
      'icon',
    ]);
  });

  describe('key dates from the shared finish', () => {
    const f: EpicForecast = {
      state: 'ok',
      remaining: 5,
      ratePerWeek: 1,
      scopeRatePerWeek: 0,
      windowDays: 14,
      completions: 5,
      nLikely: 5,
      nOpt: 4,
      nPess: 8,
      likely: '2026-10-07',
      optimistic: '2026-10-06',
      pessimistic: '2026-10-12',
      confidence: 'high',
      explanation: '',
    };
    const TODAY = '2026-09-30';
    const finish = averageForecasts([{ metric: 'count', forecast: f }], TODAY);
    it('merges the key-date label into the title and adds no key-date rows', () => {
      const cases = [
        ['Likely', finish.likely],
        ['Earliest', finish.optimistic],
        ['Latest', finish.pessimistic],
      ] as const;
      for (const [label, date] of cases) {
        const d: ChartDatum = {
          date: date as string,
          t: 0,
          remaining: null,
          forecast: 0,
          band: [0, 0],
        };
        const { container, getByText } = render(
          <EpicChartTooltip
            active
            payload={[{ payload: d }]}
            metric="count"
            rows={cfdRows('count')}
            finish={finish}
            today={TODAY}
          />,
        );
        expect(
          getByText(`${formatFinishDate(date as string, TODAY)} \u00b7 ${label} finish`),
        ).toBeInTheDocument();
        const rows = rowsOf(container);
        expect(rows.map((r) => r.textContent?.slice(0, 5))).toEqual(['Forec', 'Range']);
        cleanup();
      }
    });
  });
});

describe('ForecastLegend review fixes (261001-rtw)', () => {
  it('still names the shared finish when this view has nothing left to project', () => {
    const f: EpicForecast = {
      state: 'ok',
      remaining: 5,
      ratePerWeek: 1,
      scopeRatePerWeek: 0,
      windowDays: 14,
      completions: 5,
      nLikely: 5,
      nOpt: 4,
      nPess: 8,
      likely: '2026-10-07',
      optimistic: '2026-10-06',
      pessimistic: '2026-10-12',
      confidence: 'high',
      explanation: '',
    };
    const finish = averageForecasts([{ metric: 'count', forecast: f }], '2026-09-30');
    const { container } = render(<ForecastLegend finish={finish} hasProjection={false} />);
    expect(container.textContent).toContain('Forecast:');
    expect(container.textContent).toContain('Forecast: Oct 7');
    expect(container.textContent).not.toContain('nothing left');
  });
});

describe('EpicChartTooltip confidence and blank rows (261001-sqm)', () => {
  const f: EpicForecast = {
    state: 'ok',
    remaining: 5,
    ratePerWeek: 1,
    scopeRatePerWeek: 0,
    windowDays: 14,
    completions: 5,
    nLikely: 5,
    nOpt: 4,
    nPess: 8,
    likely: '2026-10-07',
    optimistic: '2026-10-06',
    pessimistic: '2026-10-12',
    confidence: 'medium',
    explanation: '',
  };
  const finish = averageForecasts([{ metric: 'count', forecast: f }], '2026-09-30');
  const future: ChartDatum = {
    date: '2026-10-07',
    t: 0,
    remaining: null,
    forecast: 2,
    band: [1, 3],
    wd: 5,
    workingDay: true,
  };

  it('a future datum shows no Confidence row and no reason', () => {
    const { container } = render(
      <EpicChartTooltip
        active
        payload={[{ payload: future }]}
        metric="count"
        rows={cfdRows('count')}
        finish={finish}
        today="2026-09-30"
      />,
    );
    expect(rowsOf(container).some((r) => r.textContent?.startsWith('Confidence'))).toBe(false);
    expect(container.querySelector('[data-testid="confidence-meter"]')).toBeNull();
    expect(container.textContent).not.toContain('Only 14 working days of history');
  });

  it('no Confidence row when the finish has no confidence', () => {
    const { container } = render(
      <EpicChartTooltip
        active
        payload={[{ payload: future }]}
        metric="count"
        rows={cfdRows('count')}
        finish={{ ...finish, confidence: null }}
        today="2026-09-30"
      />,
    );
    expect(rowsOf(container).some((r) => r.textContent?.startsWith('Confidence'))).toBe(false);
  });

  it('history rows get no Confidence row', () => {
    const { container } = render(
      <EpicChartTooltip
        active
        payload={[{ payload: history }]}
        metric="count"
        rows={cfdRows('count')}
        finish={finish}
        today="2026-09-30"
      />,
    );
    expect(rowsOf(container).some((r) => r.textContent?.startsWith('Confidence'))).toBe(false);
  });

  it('renders nothing for a padded blank datum', () => {
    const blank: ChartDatum = {
      date: '2026-10-20',
      t: 0,
      remaining: null,
      forecast: null,
      band: null,
    };
    const { container } = render(
      <EpicChartTooltip
        active
        payload={[{ payload: blank }]}
        metric="count"
        rows={cfdRows('count')}
        finish={finish}
        today="2026-09-30"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('chart tooltip budget (261002-0xf)', () => {
  const words = (t: string) => t.trim().split(/\s+/).length;
  const noteOf = (c: HTMLElement) => c.querySelector('[data-slot="tooltip-note"]');

  it('a history datum has at most 4 rows and no note', () => {
    const { container } = render(
      <EpicChartTooltip
        active
        payload={[{ payload: history }]}
        metric="count"
        rows={cfdRows('count')}
        today="2026-09-30"
      />,
    );
    expect(rowsOf(container).length).toBeLessThanOrEqual(4);
    expect(noteOf(container)).toBeNull();
  });

  it('a future datum has at most 4 rows and a note of at most 8 words', () => {
    const future: ChartDatum = {
      date: '2026-11-29',
      t: Date.UTC(2026, 10, 29),
      remaining: null,
      forecast: 4,
      band: [0, 6],
      wd: 5,
      workingDay: false,
    };
    const { container } = render(
      <EpicChartTooltip
        active
        payload={[{ payload: future }]}
        metric="count"
        rows={cfdRows('count')}
        clippedAfter="2026-11-29"
        today="2026-09-30"
      />,
    );
    expect(rowsOf(container).length).toBeLessThanOrEqual(4);
    const note = noteOf(container);
    expect(note).not.toBeNull();
    expect(words(note?.textContent ?? '')).toBeLessThanOrEqual(8);
  });
});
