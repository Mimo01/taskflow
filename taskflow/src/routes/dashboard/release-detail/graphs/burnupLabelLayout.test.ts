import { describe, expect, it } from 'vitest';
import { type Box, burnupPlotBox, layoutBurnupLabels } from './burnupLabelLayout';

const hit = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function run(W: number, H: number, todayX: number | null, relX: number | null) {
  const plot = burnupPlotBox(W, H);
  const markers: { kind: 'today' | 'release'; x: number }[] = [];
  if (todayX !== null) markers.push({ kind: 'today', x: todayX });
  if (relX !== null) markers.push({ kind: 'release', x: relX });
  const out = layoutBurnupLabels({ chartWidth: W, chartHeight: H, plot, markers });
  return { out, plot };
}

describe('layoutBurnupLabels examples', () => {
  const W = 400;
  const H = 110;
  const { right } = burnupPlotBox(W, H);

  it('merges TODAY and RELEASE on the same day into one label', () => {
    const { out } = run(W, H, right, right);
    expect(out.markers).toHaveLength(1);
    expect(out.markers[0].text).toBe('TODAY · RELEASE');
    expect(out.markers[0].kind).toBe('both');
  });
  it('gives TODAY and RELEASE one day apart a row each, on their own lines', () => {
    const { right, left } = burnupPlotBox(W, H);
    const day = (right - left) / 30;
    const { out } = run(W, H, right - day, right);
    expect(out.rows).toBe(2);
    expect(out.markers.map((m) => m.kind)).toEqual(['today', 'release']);
    expect(out.markers[0].x).toBeCloseTo(right - day - 3);
    expect(out.markers[1].x).toBeCloseTo(right - 3);
    expect(out.markers[1].y).toBeGreaterThan(out.markers[0].y);
  });
  it('keeps one row and one merged label only on the same day', () => {
    const { out } = run(W, H, right, right);
    expect(out.rows).toBe(1);
  });
  it('splits near markers to opposite sides of their lines', () => {
    const { out } = run(W, 110 + 90, 200, 215);
    expect(out.markers.map((m) => m.text)).toEqual(['TODAY', 'RELEASE']);
    expect(out.markers[0].anchor).toBe('end');
    expect(out.markers[1].anchor).toBe('start');
    expect(out.markers.map((m) => m.kind)).toEqual(['today', 'release']);
  });
  it('anchors a marker against its line at the chart edge instead of clipping', () => {
    const { out } = run(W, H, null, W - 5);
    const b = out.markers[0].box;
    expect(b.x + b.w).toBeLessThanOrEqual(W);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(out.markers[0].anchor).toBe('end');
  });
});

describe('layoutBurnupLabels properties', () => {
  it('markers never overlap or leave the chart, for the full matrix', () => {
    const widths = [280, 400, 560, 760, 1100];
    const heights = [110, 150, 160, 196, 240];
    let cases = 0;
    for (const W of widths) {
      for (const H of heights) {
        const plot = burnupPlotBox(W, H);
        const span = plot.right - plot.left;
        const xs = [0, 0.01, 0.02, 0.05, 0.1, 0.5, 0.9, 0.97, 0.98, 1].map(
          (f) => plot.left + f * span,
        );
        for (const tx of [null, ...xs]) {
          for (const rx of [null, ...xs]) {
            const { out } = run(W, H, tx, rx);
            cases++;
            for (const m of out.markers) {
              const b = m.box;
              expect(b.x).toBeGreaterThanOrEqual(0);
              expect(b.x + b.w).toBeLessThanOrEqual(W);
              expect(b.y).toBeGreaterThanOrEqual(0);
              expect(b.y + b.h).toBeLessThanOrEqual(burnupPlotBox(W, H, out.rows).top);
              expect(['today', 'release', 'both']).toContain(m.kind);
              // Every split label is anchored on its own marker line.
              if (m.kind !== 'both') {
                const x = m.kind === 'today' ? tx : rx;
                expect(x).not.toBeNull();
                expect(Math.abs(m.x - (x as number))).toBeLessThanOrEqual(3);
              }
            }
            if (out.markers.length === 2) {
              expect(hit(out.markers[0].box, out.markers[1].box)).toBe(false);
            }
          }
        }
      }
    }
    expect(cases).toBeGreaterThan(1000);
  });
});
