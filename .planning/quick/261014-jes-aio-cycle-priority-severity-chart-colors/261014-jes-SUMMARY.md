---
status: complete
---
# 261014-jes Summary

Priority and severity donut colours in `src/lib/aio-cycle-charts.ts` are now one oklch colour per level, in the hue of the Jira priority icon (red, orange, amber, blue). Chroma falls and lightness rises with every step down, so the more critical a level the louder it is. Severity reuses the same colours (label first, then the number prefix). Tests updated, plus new `severityChartColor` tests.

Palette iterations: Tailwind ramp -> muted -> 4 tiers -> per-level shades -> oklch scale -> more vibrant -> wider steps. Final code commit f3f7cac1. Tuned without seeing the rendered donuts; the palette is light-theme only.
