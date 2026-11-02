import { describe, expect, it } from 'vitest';
import { type Box, burnupPlotBox, layoutBurnupLabels } from './burnupLabelLayout';

const hit = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function run(
  W: number,
  H: number,
  scope: number,
  done: number,
  todayX: number | null,
  relX: number | null,
) {
  const plot = burnupPlotBox(W, H);
  const top = Math.max(
    5,
    Math.ceil(scope / 3 / 5) * 5 * Math.ceil(scope / Math.max(5, Math.ceil(scope / 3 / 5) * 5)),
  );
  const yOf = (v: number) => plot.bottom - (v / top) * (plot.bottom - plot.top);
  const markers: { kind: 'today' | 'release'; x: number }[] = [];
  if (todayX !== null) markers.push({ kind: 'today', x: todayX });
  if (relX !== null) markers.push({ kind: 'release', x: relX });
  const lastX = todayX ?? plot.right;
  const out = layoutBurnupLabels({
    chartWidth: W,
    chartHeight: H,
    plot,
    markers,
    end: { x: lastX, scopeY: yOf(scope), doneY: yOf(done), scope, done },
  });
  return { out, plot };
}

describe('layoutBurnupLabels examples', () => {
  const W = 400;
  const H = 110;
  const { right } = burnupPlotBox(W, H);

  it('merges TODAY and RELEASE on the same day into one label', () => {
    const { out } = run(W, H, 30, 12, right, right);
    expect(out.markers).toHaveLength(1);
    expect(out.markers[0].text).toBe('TODAY · RELEASE');
  });
  it('splits near markers to opposite sides of their lines', () => {
    const { out } = run(W, 110 + 90, 30, 12, 200, 215);
    expect(out.markers.map((m) => m.text)).toEqual(['TODAY', 'RELEASE']);
    expect(out.markers[0].anchor).toBe('end');
    expect(out.markers[1].anchor).toBe('start');
  });
  it('anchors a marker against its line at the chart edge instead of clipping', () => {
    const { out } = run(W, H, 30, 12, null, W - 5);
    const b = out.markers[0].box;
    expect(b.x + b.w).toBeLessThanOrEqual(W);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(out.markers[0].anchor).toBe('end');
  });
  it('merges scope == done into one end label', () => {
    const { out } = run(W, H, 22, 22, 200, null);
    expect(out.ends).toHaveLength(1);
    expect(out.ends[0].text).toBe('22 scope · done');
  });
  it('flips end labels left when they do not fit right of the last point', () => {
    const { out } = run(W, H, 30, 12, right, null);
    for (const e of out.ends) expect(e.anchor).toBe('end');
  });
  it('keeps scope above done when they differ by 1 and when done is on the axis', () => {
    for (const [s, d] of [
      [22, 21],
      [28, 0],
      [1, 0],
    ]) {
      const { out } = run(W, H, s, d, 200, null);
      const [a, b] = out.ends;
      expect(hit(a.box, b.box)).toBe(false);
      expect(a.box.y).toBeLessThan(b.box.y);
    }
  });
  it('uses the real plot height: taller plots put the labels at their own lines', () => {
    const small = run(W, 110, 30, 12, 200, null).out.ends[1].box.y;
    const tall = run(W, 240, 30, 12, 200, null).out.ends[1].box.y;
    expect(tall).not.toBe(small);
  });
});

describe('layoutBurnupLabels properties', () => {
  it('never overlaps or leaves the chart, for the full matrix', () => {
    const widths = [280, 400, 560, 760, 1100];
    const heights = [110, 140, 160, 196, 240];
    const scopes = [1, 2, 5, 9, 10, 49, 50, 123, 450, 999];
    let cases = 0;
    for (const W of widths) {
      for (const H of heights) {
        const plot = burnupPlotBox(W, H);
        const span = plot.right - plot.left;
        const xs = [0, 0.01, 0.02, 0.05, 0.1, 0.5, 0.9, 0.97, 0.98, 1].map(
          (f) => plot.left + f * span,
        );
        for (const scope of scopes) {
          for (const done of new Set(
            [0, 1, Math.floor(scope / 2), scope - 1, scope].filter((d) => d >= 0 && d <= scope),
          )) {
            for (const tx of [null, ...xs]) {
              for (const rx of [null, ...xs]) {
                const { out, plot: p } = run(W, H, scope, done, tx, rx);
                cases++;
                const boxes = [...out.markers.map((m) => m.box), ...out.ends.map((e) => e.box)];
                expect(out.ends.length).toBe(scope === done ? 1 : 2);
                for (const b of boxes) {
                  expect(b.x).toBeGreaterThanOrEqual(0);
                  expect(b.x + b.w).toBeLessThanOrEqual(W);
                  expect(b.y).toBeGreaterThanOrEqual(0);
                  expect(b.y + b.h).toBeLessThanOrEqual(H);
                }
                for (const e of out.ends) {
                  expect(e.box.x).toBeGreaterThanOrEqual(p.left);
                  expect(e.box.y).toBeGreaterThanOrEqual(p.top);
                  expect(e.box.y + e.box.h).toBeLessThanOrEqual(p.bottom);
                }
                for (let i = 0; i < boxes.length; i++) {
                  for (let j = i + 1; j < boxes.length; j++) {
                    expect(hit(boxes[i], boxes[j])).toBe(false);
                  }
                }
              }
            }
          }
        }
      }
    }
    expect(cases).toBeGreaterThan(10000);
  }, 60000);
});
