---
quick_id: 260521-wbm
status: complete
commit: 03daabd5
---

## Summary

Replaced the dashboard background SVG curves with the 8-path AMBIENT_CURVES spec.

**What changed:**
- `taskflow/src/routes/dashboard/index.tsx`: Replaced 10 hard-coded cubic-Bezier paths with 8 quadratic-Bezier paths driven by AMBIENT_CURVES array
- SVG `viewBox` updated from `0 0 1200 800` → `0 0 1200 900`
- `preserveAspectRatio` changed from `xMidYMid slice` → `none` (curves stretch edge-to-edge)
- `strokeOpacity` replaced with `opacity` per spec
- Colors: orange = `#f97316`, blue = `#06b6d4`
- Curve layout: 3 orange arcs (top band), 3 blue arcs (bottom band), 1 faint orange + 1 faint blue in mid-band (opacity 0.14)

**Commit:** `03daabd5` — feat(260521-wbm-01): replace dashboard SVG curves with AMBIENT_CURVES spec
