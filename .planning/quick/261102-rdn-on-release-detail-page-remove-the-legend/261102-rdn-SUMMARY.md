---
phase: quick-261102-rdn
plan: 01
tags: [release-detail, mr-donut]
key-files:
  modified:
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/GraphSlot.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.test.tsx
---
# Quick 261102-rdn: Drop MR donut legend, enlarge ring

Removed the state legend under the release detail MR donut and raised DONUT_GRAPH_SIZE and COMPACT_DONUT_SIZE to 148px. Slice detail stays in the AioDonut hover tooltip and the aria-label. The test now asserts that no legend renders.

Commit: af5ec978. Full vitest suite, tsc and biome passed in the pre-commit hook.

Deviations: none.
