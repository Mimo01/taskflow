// GitLab-style label pill colours: a soft tint of the label colour for the
// background, a readable shade of the same hue for the text. Computed for both
// themes so a pill reads on white and on the dark background.

type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
// Page background in dark mode (oklch(0.145 0 0) is about #0a0a0a).
const DARK_BG: Rgb = [10, 10, 10];
const TINT_ALPHA = 0.15;
const MIN_CONTRAST = 4.5;

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function over(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as Rgb;
}

function toHex(c: Rgb): string {
  return `#${c
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Move the colour toward black (t < 0) or white (t > 0) by |t|. */
function shift(c: Rgb, t: number): Rgb {
  const target = t < 0 ? 0 : 255;
  const k = Math.abs(t);
  return c.map((v) => v + (target - v) * k) as Rgb;
}

/** Step toward black/white until the text meets the contrast target on the tint. */
function readable(base: Rgb, bg: Rgb, dir: -1 | 1): Rgb {
  const tint = over(base, TINT_ALPHA, bg);
  for (let step = 0; step <= 20; step++) {
    const c = shift(base, dir * (step / 20));
    if (contrast(c, tint) >= MIN_CONTRAST) return c;
  }
  return dir < 0 ? [0, 0, 0] : [255, 255, 255];
}

export interface LabelPillColors {
  /** The label's own colour, used for the tint and the border. */
  base: string;
  /** Text colour on a light page. */
  light: string;
  /** Text colour on a dark page. */
  dark: string;
}

/**
 * Pill colours for a GitLab label colour. Text is a darker (light page) or
 * lighter (dark page) shade of the label colour with at least 4.5:1 contrast on
 * the 15% tint. Unparseable colours fall back to neutral greys.
 */
export function labelPillColors(hex: string): LabelPillColors {
  const base = parseHex(hex);
  if (!base) return { base: '#888888', light: '#404040', dark: '#d4d4d4' };
  return {
    base: toHex(base),
    light: toHex(readable(base, WHITE, -1)),
    dark: toHex(readable(base, DARK_BG, 1)),
  };
}

/** Contrast of the text on the tint (for tests): returns [light, dark] ratios. */
export function pillContrast(hex: string): [number, number] | null {
  const base = parseHex(hex);
  if (!base) return null;
  const c = labelPillColors(hex);
  const light = parseHex(c.light) as Rgb;
  const dark = parseHex(c.dark) as Rgb;
  return [
    contrast(light, over(base, TINT_ALPHA, WHITE)),
    contrast(dark, over(base, TINT_ALPHA, DARK_BG)),
  ];
}
