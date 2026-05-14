---
phase: 54-aio-on-issue-detail
plan: "54-09"
subsystem: ui
tags: [aio, tcms, jira-wiki, nested-tables, parser, panel-callout, gap-closure, react-markdown, jira2md]

# Dependency graph
requires:
  - phase: 54-aio-on-issue-detail
    provides: "Plan 54-08 overflow-x-auto wrapper (markdownComponents.table) + min-w-0 on StepTable td wrappers; Plan 54-07 mergeOpenTableRows + flattenInlineCalloutsForTableRow Branch 3-A scaffold; Plan 54-06 markdownComponents.a image-extension → ImageLightbox routing."
provides:
  - "Parser-level fix for nested {panel} inside |cell| of wiki table rows: numbered-list semantics preserved as <ol><li>, wiki-link `[name|url]` literal `|` consumed before reaching markdown table tokenizer, phantom-row prevention for Jira `\\` hard-break inside merged rows."
  - "transformPanelListItems helper inside WikiRenderer.tsx (private, typed, not exported)."
  - "5 regression tests under the Gap 3 describe block in WikiRenderer.test.tsx using the verbatim two-item ESHOP fixture (VAS.png + Kosik.png)."
  - "54-HUMAN-UAT.md round-3 scaffold for Test 3 (Gap 3) and Test 4 (ROADMAP SC end-to-end)."
affects: [phase-55, phase-56]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline numbered-list transform inside table-cell callouts: scan panel body for `# ` runs, emit `<ol><li><a href=…>name</a></li></ol>` so wiki-link `|` is consumed before remark-gfm tokenisation."
    - "Pipe escaping for non-list panel content: `\\|` to preserve any remaining literal `|` chars (markdown table column-separator) that survive the list transform."
    - "Phantom-row prevention for Jira `\\` hard-break inside merged rows: substitute to `<br/>` in mergeOpenTableRows so preprocessJiraMarkup's later `\\` → `  \n` substitution cannot re-fracture the row."

key-files:
  created: []
  modified:
    - "taskflow/src/routes/dashboard/WikiRenderer.tsx"
    - "taskflow/src/routes/dashboard/WikiRenderer.test.tsx"
    - ".planning/phases/54-aio-on-issue-detail/54-HUMAN-UAT.md"

key-decisions:
  - "Use raw HTML <ol><li><a href=…>name</a></li></ol> emission inside the panel span (rather than markdown `1. [name](url)` syntax) so the `|` in `[name|url]` is consumed by the parser-level helper BEFORE it reaches jira2md / remark-gfm. defaultSchema.tagNames already includes ol/li so rehype-sanitize whitelist needs no update."
  - "Fix phantom-row escape (Jira `\\` hard-break re-fracturing the merged row via preprocessJiraMarkup's `\\` → `  \n` substitution) by converting `\\` markers to `<br/>` inside mergeOpenTableRows. Outside merged rows the existing `\\` → `  \n` substitution still runs for prose hard breaks — no regression for non-table content."
  - "Concern A (mergeOpenTableRows correctness on the 6-line two-item panel row) verified as non-issue via direct unit test that passed on first run. No code change to the merger; the test is now a regression guard."

patterns-established:
  - "transformPanelListItems pattern: a private typed helper inside WikiRenderer.tsx that pre-processes panel-body content (line-by-line scan, regex-match `^\\s*#\\s+`, raw-HTML emission) BEFORE the panel body is wrapped in `<span data-callout=\"panel\">`. Future wiki callout enhancements can follow the same pattern."

requirements-completed: [AIOI-01, AIOI-02, AIOI-03]

# Metrics
duration: 12min
completed: 2026-05-14
---

# Phase 54 Plan 54-09: Parser-level fix for nested {panel} in wiki table cell Summary

**Parser-level transform of `# [name|url]` items inside `{panel}` blocks to raw `<ol><li><a href>…</a></li></ol>` HTML — consumes the wiki-link `|` before remark-gfm tokenises it as a column separator, preserves numbered-list semantics inside the panel span, and prevents phantom <tr> rows from Jira `\\` hard breaks inside the merged row body.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-14T09:10:43Z
- **Completed:** 2026-05-14T09:23:35Z
- **Tasks:** 3 (Task 4 is a pending human-verify checkpoint, intentionally NOT executed)
- **Files modified:** 3

## Accomplishments

- **Concern A verified as non-issue** — Direct unit test for `mergeOpenTableRows` consuming the 6-line panel-bearing row (panel open + 2 `# [name|url]` items + panel close + trailing pipe) PASSED on first run. The `panelOpenCount` even-balance check at WikiRenderer.tsx:198 (now line 224) correctly handles two opens. No change to the merger required; the test is committed as a regression guard.
- **Concerns B + C closed at parser layer** — New private helper `transformPanelListItems` converts each `# [name|url]` line inside a `{panel}` body to `<li><a href="url">name</a></li>` wrapped in `<ol>`. Wiki-link `|` characters are consumed before the table tokenizer sees them; numbered-list semantics are preserved. Remaining `|` in non-list panel content is escaped to `\|`. Both panel-with-title and panel-without-title branches in `flattenInlineCalloutsForTableRow` call the helper.
- **Phantom-row prevention** — `mergeOpenTableRows` now substitutes Jira `\\` hard-break markers to `<br/>` inside merged row bodies BEFORE `preprocessJiraMarkup` runs its global `\\` → `  \n` substitution. Without this fix, the verbatim two-item ESHOP fixture rendered as 3 `<tbody>` rows (the `\\ • 5 GB ...` content fracturing into a phantom row); after the fix it renders as exactly 2 `<tbody>` rows matching the source data.
- **All prior contracts preserved** — 54-08 `overflow-x-auto` defensive CSS wrapper stays in `markdownComponents.table`; 54-07 T-54-07-01 XSS guards still strip `<script>` and on-* attrs; 54-06 image-extension → `ImageLightbox` routing fires on the new `<a href="…">VAS.png</a>` nodes emitted inside the panel `<ol>`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Concern A merger verification test** — `ad34ec2` (test)
2. **Task 2 RED: failing tests for Concerns B+C parser fix** — `48a2c7c` (test)
3. **Task 2 GREEN: parser-level fix for nested {panel}** — `6fdee86` (fix)
4. **Task 3: round-3 UAT scaffold** — `c52fb12` (docs)
5. **Task 4 (checkpoint:human-verify)** — NOT executed; orchestrator handles the human UAT gate.

_Note: Task 2 was a TDD task (`tdd="true"`), so RED + GREEN are separate commits._

## Files Created/Modified

- `taskflow/src/routes/dashboard/WikiRenderer.tsx` — Added private `transformPanelListItems` helper above `flattenInlineCalloutsForTableRow`. Both panel branches (with-title and without-title) now call the helper → escape remaining `|` → flatten `\n` → wrap in `<span data-callout="panel">`. `mergeOpenTableRows` also substitutes Jira `\\` hard breaks to `<br/>` inside merged row bodies to prevent phantom rows.
- `taskflow/src/routes/dashboard/WikiRenderer.test.tsx` — Added `mergeOpenTableRows` to the import; added `KOSIK_URL` + `FINDING_1_TWO_ITEM_FIXTURE` constants; added 5 new tests under the existing Gap 3 describe block (Concern A merger test + 4 Concerns B+C DOM-level assertions).
- `.planning/phases/54-aio-on-issue-detail/54-HUMAN-UAT.md` — Round-3 scaffold: `re_uat_round: 3`, Test 3 status → `pending_uat_round_3` with `round_3_fix` sub-block, Test 4 with `prerequisites: ["Test 3 round 3 PASS"]`, Summary counts updated (issues 1→0, pending 1→2), Gap 3 in `## Gaps` extended with `uat_round_3: pending_uat` + `round_3_*` fields.

## Decisions Made

- **Raw-HTML emission over markdown syntax for panel list items.** When the inner content of a `{panel}` block contains `# [name|url]` lines, the helper emits raw HTML (`<ol><li><a href="url">name</a></li></ol>`) directly rather than producing markdown `1. [name](url)` syntax. The `|` in `[name|url]` MUST be consumed at the parser layer before the row is handed to jira2md / remark-gfm — markdown `1. [name](url)` syntax would still contain `|` (in the URL or anchor), and the row would split anyway. Raw HTML passes through rehype-raw and rehype-sanitize cleanly (defaultSchema.tagNames already includes `ol`/`li`/`a`).
- **Phantom-row prevention at the mergeOpenTableRows layer, not at preprocessJiraMarkup.** The Jira `\\` hard break is converted to `<br/>` only for content INSIDE a merged row body, leaving the existing `\\` → `  \n` substitution intact for prose hard breaks outside table rows. This keeps the prose-rendering contract for non-table content unchanged while preventing the table-fracture symptom.
- **No change to `mergeOpenTableRows` panel-balance logic.** The Concern A test passed on first run with the existing `panelOpenCount % 2 === 0` check; the merger correctly identifies the row-terminator pipe after the second `{panel}` token. No refactor or rewrite was warranted.
- **Test for title-panel asserts visible text, not `data-title` attribute.** The existing `markdownComponents.span` renderer at WikiRenderer.tsx:367-380 emits the title as an inner `<span class="font-bold">` rather than forwarding it as `data-title` on the outer panel span. The test was adjusted to assert `panelSpan.textContent.toContain('Steps')` — matching the actual rendered contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Phantom-row prevention via `\\` → `<br/>` substitution in mergeOpenTableRows**
- **Found during:** Task 2 (running the new Concerns B+C `<ol><li>` test, which asserted `tbody.querySelectorAll('tr').length === 2` per the plan's `<behavior>` block).
- **Issue:** The verbatim two-item ESHOP fixture rendered with 3 `<tbody>` rows instead of 2. Diagnosis: `preprocessJiraMarkup` runs AFTER `mergeOpenTableRows`; its line-245 substitution `result.replace(/[ \t]\\\\[ \t]/g, '  \n')` re-introduces a markdown hard break inside the merged row, fracturing the single `Plati pre paušály S, M, L: \\ • 5 GB ...` content into two `<tr>` children. The plan's `<must_haves>` explicitly listed "Phantom-row prevention" as a truth (`tbody.querySelectorAll('tr').length === 2`) but the plan's `<action>` block did not call out the `\\` substitution as the cause.
- **Fix:** Inside `mergeOpenTableRows`, after `flattenInlineCalloutsForTableRow` and BEFORE `\n` → ` ` flattening, run `replace(/[ \t]*\\\\[ \t]*\n/g, '<br/>').replace(/[ \t]\\\\[ \t]/g, '<br/>')` on the merged row body. This consumes the `\\` markers as `<br/>` inline line breaks before they can reach `preprocessJiraMarkup`'s row-fracturing substitution.
- **Files modified:** taskflow/src/routes/dashboard/WikiRenderer.tsx (mergeOpenTableRows merge-and-flatten block)
- **Verification:** All 5 new tests pass; `tbody.querySelectorAll('tr').length === 2` asserted directly; the rendered hard break inside the cell shows as a `<br>` (correct: visual break preserved, no row split).
- **Committed in:** 6fdee86 (Task 2 GREEN commit)

**2. [Rule 1 - Test fixup] Title-panel test asserts visible text instead of `data-title` attribute**
- **Found during:** Task 2 (final test pass, title-panel test failed with `expected null to be 'Steps'`).
- **Issue:** The test originally asserted `panelSpan.getAttribute('data-title') === 'Steps'`. But `markdownComponents.span` (WikiRenderer.tsx:367-380) renders the title as a styled inner element (`<span class="font-bold">Steps</span>`) and does NOT forward `data-title` to the rendered DOM. The plan's `<behavior>` block was imprecise about which DOM surface carries the title.
- **Fix:** Test now asserts `panelSpan.textContent.toContain('Steps')` — matches the actual rendered contract (title visible to the user inside the panel) without changing production code. No regression to `data-callout` attribute (it IS forwarded by the renderer).
- **Files modified:** taskflow/src/routes/dashboard/WikiRenderer.test.tsx (one test only)
- **Verification:** Title-panel test now passes; visible title text confirmed in debug-dumped HTML.
- **Committed in:** 6fdee86 (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 2 missing-critical, 1 Rule 1 test-fixup)
**Impact on plan:** Both auto-fixes essential for the plan's `<must_haves>` (phantom-row prevention truth was explicit; title-panel test fix matches the actual rendered contract). No scope creep — both deviations stayed within the 3 files listed in `files_modified`.

## Issues Encountered

- One transient full-suite test run reported flaky timeouts on unrelated component tests (EPIC-03-A, AION-02, etc., timing out at 5+ seconds). Subsequent re-runs all 102 test files / 1019 tests pass cleanly. No code change made; suspected CPU-saturation flake during the initial run that loaded vite + vitest + tsc in parallel.
- The strict grep gate `transformPanelListItems(` expected count 2 (call sites only) returned 3 because `grep -c` also matches the function definition line `function transformPanelListItems(panelBody...)`. The substance (1 definition + 2 call sites) is correct; the gate spec was slightly imprecise.

## User Setup Required

None — no external service configuration required for this parser-level fix.

## Round-3 UAT Outcome

**Status: pending_human_uat** (Task 4 is the next gate). Task 4 is a `checkpoint:human-verify` and was intentionally not executed by the executor per the orchestrator's instructions. The human verifier runs:

- Sub-test 4a (Gap 3 RE-UAT round 3 on the verbatim ESHOP fixture) — confirms the parser fix lands at the rendered DOM and `# Kosik.png` no longer escapes the table on a real ESHOP issue.
- Sub-test 4b (Test 4 ROADMAP SC end-to-end on a happy-path issue) — confirms all four ROADMAP SC PASS regression-free.

Both sub-tests passing → Phase 54 closes; next orchestrator step is `/gsd-verify-work 54` to write the round-3 verification document and mark the phase as `verified`.

## Next Phase Readiness

- Phase 54 awaits round-3 human UAT (Task 4 checkpoint). Once both sub-tests PASS the phase closes — no further dev work expected.
- The `transformPanelListItems` helper is the canonical pattern for any future wiki-callout enhancement that needs to consume markdown special chars before table tokenisation.
- 54-VERIFICATION.md was NOT modified by this plan (the verifier writes it on the next cycle).

## Self-Check: PASSED

- File `taskflow/src/routes/dashboard/WikiRenderer.tsx` exists and contains `function transformPanelListItems` (grep: 1) and 2 call sites (grep: 3 including the function definition).
- File `taskflow/src/routes/dashboard/WikiRenderer.test.tsx` exists and contains all 5 expected test names (Plan 54-09 Concern A: 1, Plan 54-09 Concerns B: 3, Plan 54-09 Concern B —: 1).
- File `.planning/phases/54-aio-on-issue-detail/54-HUMAN-UAT.md` exists and contains all 5 required tokens (`re_uat_round: 3`, `pending_uat_round_3`, `round_3_fix`, `round_3_fix_plan: "54-09"`, `transformPanelListItems`).
- Commits exist in git log: ad34ec2, 48a2c7c, 6fdee86, c52fb12 (all `git log --oneline -10` confirmed).
- `tsc --noEmit` exit 0.
- Full vitest suite: 1019 passed, 2 skipped, 39 todo, 0 failed.

---
*Phase: 54-aio-on-issue-detail*
*Completed: 2026-05-14*
