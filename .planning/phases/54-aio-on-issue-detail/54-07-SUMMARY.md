---
phase: 54-aio-on-issue-detail
plan: "07"
subsystem: ui
tags: [aio, tcms, jira-wiki, react-markdown, jira2md, traceability, impacted-executions, attachments, xss-mitigation, rehype-sanitize]

# Dependency graph
requires:
  - phase: 54-aio-on-issue-detail
    provides: "AioTestRunsSection (54-04), traceability widening + Branch A1 direct lookup (54-06), AioAttachmentsGrid scaffold (54-06), WikiRenderer panel/{color}/h4./hard-break + image-link openUrl routing (54-06)"
provides:
  - "ImpactedExecutionsList sub-component for the no-runs path with per-row status chips driven by detail.run.status (PASS green / FAIL red / BLOCKED orange / NOT_EXECUTED gray)"
  - "Cross-cycle bounded fan-out: MAX_IMPACTED_EXECUTIONS=20 + MAX_PARALLEL=6 capping `fetchAioTestRunDetail` cross-cycle calls (T-54-07-02 mitigation); in-cycle path stays uncapped"
  - "AioAttachmentsGrid populates uniformly on BOTH render paths (in-cycle data + cross-cycle impacted-executions step data)"
  - "Nested wiki rendering inside table cells via Branch 3-A preprocess heuristic (mergeOpenTableRows + flattenInlineCalloutsForTableRow + <span data-callout> override)"
  - "T-54-07-01 XSS mitigation via rehype-sanitize with custom schema (preserves data-callout/mention/img/br/span/a; strips <script>, <iframe>, on-* event handlers)"
affects: [55-aio-future, "any phase touching WikiRenderer", "any phase consuming AioTestRunsSection"]

# Tech tracking
tech-stack:
  added: ["rehype-sanitize@^6.0.0 (peerDep of react-markdown ecosystem; XSS mitigation)"]
  patterns: ["Row-aware wiki preprocessing (mergeOpenTableRows) for nested-content table cells", "Cross-cycle vs in-cycle partition with cap on cross-cycle only (T-54-07-02 model)", "Sanitize-after-raw markdown pipeline order"]

key-files:
  created: []
  modified:
    - .planning/phases/54-aio-on-issue-detail/54-PROBE-FINDINGS.md
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
    - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx
    - taskflow/package.json
    - taskflow/package-lock.json

key-decisions:
  - "Probe E selected Branch 3-A (preprocess heuristic) over 3-B (custom td renderer) and 3-C (parser swap) — lowest blast radius, no new wiki-parser deps, isolated to preprocessJiraMarkup. Validated against the verbatim ESHOP fixture from 54-06-UAT-FINDINGS.md Finding 1 (panel + image-link list render INSIDE the table cell)."
  - "Sub-changes 1 + 2 landed in a single commit (1188624) because they share the same widened queryFn return shape (impactedExecutions[] carries BOTH the per-row status chip data AND the per-row step data the attachments grid aggregates from). Sub-change 3 is a separate commit (72e0dea) because it touches different files (WikiRenderer.tsx)."
  - "rehype-sanitize ADDED as a new dependency for T-54-07-01 mitigation. Plan said 'no new deps unless Branch 3-C selected' — but T-54-07-01 mitigation is a separate threat-model requirement (also called out in Probe E sub-finding) and rehype-sanitize is the standard companion to rehype-raw for this purpose. Custom schema preserves the existing wiki surface (data-callout/mention/img/br/span/a) while stripping <script>/<iframe>/on-* attrs."
  - "Plan T-54-07-01 acceptance criterion specified `<script>` payload renders as LITERAL TEXT. Updated to assert no <script> element + no <script[data-test='injected']> + surrounding text preserved — sanitize STRIPS the script entirely (safer outcome than rendering as literal text). Same security guarantee, slightly different observable behaviour."
  - "Primary cycle picker uses most-frequent cycleKey across runRefs (tie-broken by highest CY-N suffix) instead of fetchAioCycles — Branch A1 path doesn't call fetchAioCycles, so we infer the primary cycle from the traceability response itself."

patterns-established:
  - "mergeOpenTableRows: row-aware wiki preprocessing pattern. Detect open `|...` rows that don't end in `|`; greedy-consume subsequent lines until row terminator + balanced inline markers; substitute multi-line callouts to inline HTML. Applies to any future Jira-wiki construct that needs to survive jira2md's row tokeniser."
  - "Cross-cycle / in-cycle partition with asymmetric cap: T-54-07-02 model. Use most-frequent cycleKey as primary; cap ONLY the cross-cycle slice (preserves today's behaviour for in-cycle large issues, bounds runaway fan-out on traceability responses with many cross-cycle items). MAX_IMPACTED_EXECUTIONS=20 + MAX_PARALLEL=6 chunk size."
  - "Sanitize-after-raw markdown pipeline: `rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}`. Order matters — sanitize must see the parsed HTML, not the raw markdown. Custom schema must use camelCased property names (`dataCallout`, `dataTitle`, `dataId`) since hast-util-from-html normalises HTML attribute names."

requirements-completed: [AIOI-02, AIOI-03]

# Metrics
duration: ~30min
completed: 2026-05-14
---

# Phase 54 Plan 07: AIO On Issue Detail — Gap Closure (Impacted Executions, Attachments Grid, Nested Wiki) Summary

**ImpactedExecutionsList replaces the bare "No test runs in active cycle" EmptyState with per-row PASS/FAIL/BLOCKED chips; AioAttachmentsGrid populates from cross-cycle bounded `fetchAioTestRunDetail` calls; nested `{panel}` blocks inside table cells render via Branch 3-A preprocess heuristic; XSS surface hardened with rehype-sanitize.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-13T23:48:30Z (worktree spawn)
- **Completed:** 2026-05-14T00:05:00Z
- **Tasks:** 2 of 3 plan tasks executed (Probe E + Implementation; Task 3 is human UAT — see Next Phase Readiness)
- **Files modified:** 7

## Accomplishments

- **Gap 1 closed** — `ImpactedExecutionsList` renders on the no-runs path showing test case key + title, cycle key, run ID, and a status chip whose color reflects the FETCHED `detail.run.status` (PASS green / FAIL red / BLOCKED orange / NOT_EXECUTED gray). Replaces the bare "No test runs in active cycle" EmptyState. Rows are read-only (no buttons, no click handlers — cycle/run navigation is a phase-53 concern).
- **Gap 2 closed** — `AioAttachmentsGrid` is rendered on BOTH branches via a single call site at the end of the section render. The `aioAttachments` memo aggregates inline image refs from in-cycle runs UNION cross-cycle impacted-executions step data via `collectAioImageAttachments`. T-54-07-02 mitigation: cross-cycle `fetchAioTestRunDetail` fan-out is capped at `MAX_IMPACTED_EXECUTIONS=20` (slice) + `MAX_PARALLEL=6` (chunked Promise.all); in-cycle fetch stays UNCAPPED (preserves 54-06 behaviour for issues with many in-cycle linked runs).
- **Gap 3 closed** — Nested `{panel}…{panel}` blocks with embedded `# [name|url]` lists inside `|cell|` table rows now render correctly via Branch 3-A preprocess heuristic (`mergeOpenTableRows` + `flattenInlineCalloutsForTableRow` + new `span` override in `markdownComponents`). Validated against the verbatim ESHOP Finding 1 fixture — the panel content + VAS.png anchor render INSIDE the failed-step table cell.
- **T-54-07-01 mitigation shipped** — `rehype-sanitize` added to the WikiRenderer pipeline AFTER `rehype-raw` with a custom schema. `<script>`, `<iframe>`, on-* event handler attrs are stripped from all wiki surfaces (issue descriptions, comments, MR descriptions, AIO step content). Existing wiki surface (`data-callout`, `data-title`, `mention`, `img`, `br`, `span`, `a`) preserved.
- **Probe E recorded** — `54-PROBE-FINDINGS.md` now contains the `## Probe E — 54-07 Nested Wiki Rendering` section with all three branches evaluated and a single `### Decision: Branch 3-A selected — …` line that Task 2 read deterministically.
- **Full test suite GREEN** — 1002 tests passing, 0 failures across the project (was 102 test files before; same after). Typecheck clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Probe E — Nested wiki rendering branch selection** — `9ae3b40` (docs)
2. **Task 2 Sub-change 1 + Sub-change 2: Gap 1 (ImpactedExecutionsList) + Gap 2 (attachments grid + cross-cycle bounded fetch)** — `1188624` (feat)
3. **Task 2 Sub-change 3: Gap 3 (nested wiki Branch 3-A + T-54-07-01 XSS mitigation)** — `72e0dea` (fix)

_Note: Sub-change 1 and Sub-change 2 landed in one commit because they share the same widened `queryFn` return shape and cannot be split atomically — the cross-cycle step fetch IS the source of both the impacted-executions list AND the attachments grid data on the no-runs path. Sub-change 3 is a separate commit (different file: WikiRenderer.tsx)._

## Files Modified

- `.planning/phases/54-aio-on-issue-detail/54-PROBE-FINDINGS.md` — appended Probe E section with verbatim ESHOP fixture, three-branch evaluation, T-54-07-01 sub-finding, and the Decision line
- `taskflow/src/routes/dashboard/WikiRenderer.tsx` — `mergeOpenTableRows` + `flattenInlineCalloutsForTableRow` helpers; `span` override in `markdownComponents`; rehype-sanitize wired with custom schema
- `taskflow/src/routes/dashboard/WikiRenderer.test.tsx` — new "Gap 3 — nested wiki inside table cells (Branch 3-A)" describe block with verbatim Finding 1 fixture test + 3 T-54-07-01 XSS guard tests
- `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx` — widened queryFn return shape (`null | { runs, impactedExecutions }`); cross-cycle partition + chunked Promise.all with cap; new `ImpactedExecutionsList` sub-component with per-row status chip; `aioAttachments` memo aggregates from BOTH render paths; single AioAttachmentsGrid call site at section render end; `EmptyState` import + invocation removed
- `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.test.tsx` — updated D-04 second-case test to reflect new contract (section hidden when no impacted executions); new "Impacted executions list (Gap 1) + attachments grid on no-runs path (Gap 2)" describe block with 6 new tests covering Gap 1 render, Gap 1 status chip wiring, Gap 2 empty state header, Gap 2 populated grid, T-54-07-02 cap (30 cross-cycle → ≤20 fetches), and in-cycle no-regression (21 in-cycle → 21 fetches)
- `taskflow/package.json` — added `rehype-sanitize@^6.0.0`
- `taskflow/package-lock.json` — lockfile update

## Decisions Made

- **Branch 3-A over 3-B / 3-C** — Probe E found 3-A's preprocess heuristic produces correct render on the verbatim ESHOP fixture in ~40 LOC of `mergeOpenTableRows` + ~35 LOC of `flattenInlineCalloutsForTableRow`. 3-B (custom td renderer) would require a custom remark plugin to preserve raw cell source through HAST/MDAST nodes — non-trivial, fragile. 3-C (parser swap) has the highest blast radius and was reserved for future work.
- **`<span data-callout>` instead of `<div data-callout>` inside table cells** — `<div>` is illegal as a child of `<td>` per HTML spec; using `<span>` with `inline-block` styling lets the panel sit inside the cell flow without breaking the row. The existing `<div data-callout>` callout renderer is preserved for outside-table panel rendering.
- **rehype-sanitize as a new dependency** — Plan said "no new deps unless Branch 3-C". rehype-sanitize is REQUIRED for T-54-07-01 (XSS) mitigation, which is a separate threat-model concern called out in the plan's `<threat_model>` section. Adding it is a Rule 2 mitigation (missing critical security functionality), not arbitrary scope creep.
- **T-54-07-01 test assertion adjusted** — Plan spec said `<script>` should render as literal text. rehype-sanitize STRIPS the entire `<script>` element including its content (safer behaviour). Updated test asserts no script element + no `script[data-test="injected"]` + surrounding text preserved. Same security guarantee.
- **Cross-cycle vs in-cycle partition uses most-frequent cycleKey as primary** — Branch A1 (54-06) skips `fetchAioCycles` on the success path, so we don't have an "active cycle" reference. Most-frequent cycleKey (tie-broken by highest CY-N) approximates the active cycle from the traceability response itself.
- **Sub-change 1 + Sub-change 2 in one commit** — They share the queryFn return-shape change. Splitting would have required two coordinated commits where the first wouldn't compile against the second. Documented in the Sub-change 1 commit body and here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `rehype-sanitize` dependency for T-54-07-01 XSS mitigation**
- **Found during:** Task 2 Sub-change 3 (Gap 3 implementation)
- **Issue:** Plan threat model specified T-54-07-01 mitigation requires `<script>` payloads to render safely (literal text per plan). The existing WikiRenderer pipeline used only `rehype-raw` with no sanitization — `<script>` payloads from user content were rendering as DOM `<script>` elements (verified during Probe E). Plan said "no new deps unless Branch 3-C selected" but the threat model requires this mitigation regardless of branch.
- **Fix:** Installed `rehype-sanitize@^6.0.0`; wired AFTER `rehype-raw` with a custom schema that preserves the existing wiki surface (data-callout, data-title, mention, img, br, span, a) and strips `<script>`, `<iframe>`, on-* event handler attributes
- **Files modified:** package.json, package-lock.json, WikiRenderer.tsx, WikiRenderer.test.tsx
- **Verification:** Three new tests assert no script element on table-cell payloads, on prose payloads, and that on-* attributes are stripped. Full test suite passes.
- **Committed in:** 72e0dea (Sub-change 3 commit)

**2. [Rule 1 - Test fixture] Adjusted T-54-07-01 test assertion to match sanitize behaviour**
- **Found during:** Task 2 Sub-change 3
- **Issue:** Plan acceptance criterion said `<script>` payload renders as literal text. rehype-sanitize STRIPS the entire `<script>` element including its content — safer outcome than rendering literal text, but the test as plan-specified would fail.
- **Fix:** Updated test to assert no script element + no `script[data-test="injected"]` + surrounding text preserved. Same security guarantee, more accurate to actual sanitize behaviour.
- **Files modified:** WikiRenderer.test.tsx
- **Verification:** Test passes; manual review confirms the threat is mitigated (no JS execution surface) AND surrounding cell text remains visible.
- **Committed in:** 72e0dea (Sub-change 3 commit)

**3. [Rule 1 - Test contract] Updated legacy "No test runs in active cycle" EmptyState test to reflect new D-04 second-case contract**
- **Found during:** Task 2 Sub-change 1 (tests run after queryFn shape widening)
- **Issue:** The plan explicitly removes the bare `EmptyState "No test runs in active cycle"` from the no-runs path (replaced by `ImpactedExecutionsList`). The legacy test asserted the EmptyState text would render — but with the new shape, when neither in-cycle runs nor impacted executions resolve, the section returns null (defensive). The legacy path (no jiraIssueId) returns `runs=[], impactedExecutions=[]` for this case → section hidden.
- **Fix:** Renamed the test to "renders nothing (section hidden) when legacy path returns no usable runs and no impacted executions (Plan 54-07 D-04 second case)" and updated assertions to expect the section is absent from the DOM.
- **Files modified:** AioTestRunsSection.test.tsx
- **Verification:** Test passes. Other 19 AioTestRunsSection tests continue passing.
- **Committed in:** 1188624 (Sub-change 1 commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 2 missing critical, 2 Rule 1 test-contract adjustments)
**Impact on plan:** All three deviations were necessary and stay within the plan's intent. Rule 2 (rehype-sanitize) was explicitly called out by the threat model. The two Rule 1 test adjustments reflect the new contract the plan itself defined. No scope creep — all out-of-scope items (step attachment thumbnails, edit-runs-from-issue-detail, impacted-execution → cycle navigation) are absent.

## Issues Encountered

- **Worktree had no `node_modules`** — fixed with `npm ci` (already happened during Task 1 commit prep). One-time cost (~3s install).
- **rehype-sanitize default schema is HTML-attribute-naming convention-aware (camelCased)** — `data-callout` must be whitelisted as `dataCallout` in the schema. Tripped 7 panel/callout tests on first attempt; corrected by inspecting `node_modules/hast-util-sanitize/lib/schema.js` and switching to camelCase keys.
- **Pre-existing biome baseline warnings** — `husky` pre-commit hook fails on ~28 errors / ~644 warnings across the repo on files this plan does NOT touch. Per `feedback_no_verify_lint.md` `--no-verify` is approved for pre-existing baseline warnings on unrelated files. Used on all three commits; biome is clean on the four files this plan touches.

## User Setup Required

None — no external service configuration required. The new `rehype-sanitize` dependency installs automatically via `npm ci` / `npm install`.

## Threat Flags

None — no NEW security-relevant surface introduced beyond what the plan's `<threat_model>` already covers (T-54-07-01 mitigated, T-54-07-02 mitigated, T-54-07-03/04 accepted as documented, T-54-07-05 pre-existing carryover from 54-06).

## TDD Gate Compliance

Plan type was `execute`, not `tdd` — TDD gate sequence does not apply. Tests for each sub-change were added alongside the implementation per plan acceptance criteria.

## Next Phase Readiness

- **Task 3 (human UAT) remains** — the plan's third task is `checkpoint:human-verify` for a developer to run `npm run tauri dev` and verify the three gaps on a real ESHOP issue. This SUMMARY documents what to verify (see Task 3 `<how-to-verify>` in the plan; the orchestrator should surface that to the user). Once approved, Phase 54 is closeable.
- **Phase 54 is shipping-ready pending UAT** — all automated tests pass, typecheck clean, all acceptance criteria tokens present in code (verified by `grep`).
- **No follow-up plans needed UNLESS UAT surfaces a gap** — out-of-scope items (step attachment thumbnails on this instance, edit-runs-from-issue-detail) remain deferred to future milestones; impacted-execution → cycle/run navigation is a phase-53 concern.

## Self-Check: PASSED

Verified via `grep` and `git log` that all artifacts referenced in this SUMMARY exist:

- `.planning/phases/54-aio-on-issue-detail/54-PROBE-FINDINGS.md` — Probe E section + Decision line present (verified by `grep -qE "^### Decision: Branch 3-[ABC] selected — "`)
- `taskflow/src/routes/dashboard/issue-detail/AioTestRunsSection.tsx` — `ImpactedExecutionsList` (3 occurrences), `MAX_IMPACTED_EXECUTIONS` (4), `MAX_PARALLEL` (6), `T-54-07-02` (6), `AioAttachmentsGrid` (3) — all ≥ acceptance threshold
- `taskflow/src/routes/dashboard/WikiRenderer.test.tsx` — `Plati pre paušály` (3), `Branch 3-A` (3), `alert(1)` (3) — all present
- Commits: `9ae3b40`, `1188624`, `72e0dea` — all visible in `git log`
- Full test suite: 1002 tests passing, 0 failures (verified by `npx vitest run --reporter=dot`)

---
*Phase: 54-aio-on-issue-detail*
*Completed: 2026-05-14*
