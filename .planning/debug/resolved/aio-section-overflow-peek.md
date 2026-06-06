---
slug: aio-section-overflow-peek
status: resolved
trigger: "on the issue preview, AIO section html layout is broken, it overflows to the right"
created: 2026-06-06
updated: 2026-06-06
---

# Debug Session: AIO section overflows to the right in issue peek

## Symptoms

- **Expected behavior:** The AIO section in the issue preview (peek) should lay out within the panel width, no horizontal overflow.
- **Actual behavior:** The AIO section's HTML layout is broken and overflows to the right.
- **Location:** Test Runs / cycles block specifically suspected; possibly the whole AIO section.
- **Error messages:** None (visual/layout bug).
- **Timeline:** Just noticed — no known regression point.
- **Reproduction:** Open an issue preview/peek that has AIO test management data.

## Current Focus

- hypothesis: CONFIRMED — StepTable and ImpactedExecutionsList had no overflow-x-auto wrapper around fixed-width tables.
- test: n/a (visual/layout)
- expecting: overflow-x-auto allows tables to scroll internally
- next_action: DONE

## Evidence

- timestamp: 2026-06-06T00:00:00Z
  file: src/routes/dashboard/issue-detail/AioTestRunsSection.tsx
  note: |
    StepTable (line 244) renders <table className="w-full text-sm"> with:
      - th w-48 (Expected) — 192px
      - th w-48 (Actual) — 192px
      - th w-24 (Status) — 96px
    Total fixed: 480px minimum, plus Step column content. No overflow-x-auto wrapper.
    PeekPanel minimum width is 360px (useResizable min:360). With p-4 + px-6 padding,
    available table width ~300-320px — table guaranteed to overflow.

- timestamp: 2026-06-06T00:00:00Z
  file: src/routes/dashboard/issue-detail/AioTestRunsSection.tsx
  note: |
    ImpactedExecutionsList (line 746) also renders <table className="w-full text-sm">
    with no overflow-x-auto wrapper. td cells for test-case title had no truncate/min-w-0.

- timestamp: 2026-06-06T00:00:00Z
  file: src/routes/dashboard/WikiRenderer.tsx
  note: |
    WikiRenderer wraps its own markdown tables in overflow-x-auto (line 981) as the
    established fix pattern (Plan 54-08 Gap 3). The raw HTML tables in AioTestRunsSection
    missed the same treatment.

## Eliminated

- WikiRenderer markdown tables — already wrapped in overflow-x-auto, not the cause.
- PeekPanel outer shell — overflow-hidden clips final paint but doesn't prevent scroll-width expansion.

## Resolution

- root_cause: StepTable and ImpactedExecutionsList in AioTestRunsSection.tsx render bare <table> elements with fixed-width columns totalling >=480px minimum, with no overflow-x-auto wrapper. In the peek panel (min 360px, typically ~480px with padding subtracted) these tables blow out the scroll container width, causing horizontal overflow of the entire AIO section.
- fix: Wrapped StepTable's <table> in <div className="overflow-x-auto"> and wrapped ImpactedExecutionsList's <table> in the same. Also added truncate min-w-0 to the test-case title span in ImpactedExecutionsList. biome format applied; npm run check passes clean.
- specialist_hint: typescript
