# Phase 54: AIO on Issue Detail - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Add an AIO test runs section to the existing `/issue/:key` full-page route (`IssueDetailPage.tsx`). The section loads lazily and in parallel with the main Jira issue data, is gated by `aioEnabled`, shows a step table for each test run in the latest active cycle linked to the Jira issue key, and opens step attachment images in the existing `ImageLightbox`. No new routes, no sidebar changes, no new navigation — issue detail only.

</domain>

<decisions>
## Implementation Decisions

### Issue lookup strategy
- **D-01:** Test cases ARE linked to Jira issues in AIO — the user confirmed this. The researcher must probe and verify a `GET /testcase?issueKey=PROJ-123` endpoint (or equivalent) against the live instance. Expected path: `GET /rest/aio-tcms-api/1.0/testcase?issueKey=PROJ-123` (under `AIO_API_PATH`). Confirm response shape and whether it returns test case keys.
- **D-02:** Lookup flow: `issueKey` → test case keys (via D-01 endpoint) → fetch the latest active cycle for the project → fetch runs for that cycle → filter runs by `testCaseKey` matching the linked test cases.
- **D-03:** Extract project key from issue key (e.g. `PROJ` from `PROJ-123`) — used to fetch cycles and runs. No separate Jira-to-AIO project ID mapping needed (same pattern as D-12 from Phase 51).
- **D-04:** Empty state — TWO distinct cases:
  - No AIO test cases linked to this issue → **section hidden entirely** (success criteria: "hidden, not an error state")
  - Test cases are linked but no runs exist in the active cycle → **show empty state message**: "No test runs in active cycle"
- **D-05:** Query key: `['aio', jiraBaseUrl, 'issue-steps', issueKey]` — follows the `['aio', jiraBaseUrl, ...]` prefix convention.

### Cycle scope
- **D-06:** Scope is the **latest active cycle only** — the cycle with status `'Active'` and the highest sequence number (e.g. `PROJ-CY-4` over `PROJ-CY-3`). When multiple cycles are active simultaneously, pick the one with the highest key index. One AIO section per issue, not one per cycle.

### Step table structure
- **D-07:** Table columns: **Step** (action/description) | **Expected** | **Actual** | **Status**. Four columns. The "Status" column is always present.
- **D-08:** Status column uses a **colored chip per step** — same chip style as Phase 53 filter chips. Values: `Pass` (green), `Fail` (red), `Blocked` (orange), `Not Run` (gray). Reuses existing chip component/classes.
- **D-09:** The "Actual" column is always shown. For steps with status `NOT_EXECUTED`, the actual cell shows `—`.
- **D-10:** When an issue is linked to **multiple test cases**, each test case gets its own **collapsible run block** with a header showing the test case name + overall run status badge. Each block contains the step table for that test run. When there is only one linked test case, render a flat step table without the collapsible wrapper.
- **D-11:** Step data comes from a separate endpoint — researcher must verify (likely `GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/testrun/{runIdOrTestCaseKey}/step` or inline on the run detail). Researcher must confirm field names for: step action text, expected result text, actual result text, and per-step status.

### Step attachment UX
- **D-12:** Step attachment images are shown as **inline thumbnails (~48px)** within the step row (in or below the actual cell). All attachment thumbnails are shown side by side when a step has multiple images.
- **D-13:** Each thumbnail is clickable — opens **`ImageLightbox`** with `src` set to the attachment URL. `ImageLightbox` renders `AuthImage` which handles authenticated fetch automatically (AIO attachments are on the same Jira host → `needsAuth` triggers).
- **D-14:** `ImageLightbox` is used per thumbnail independently (no multi-image navigation between step attachments). This avoids any type-adapter complexity between `JiraAttachment[]` and AIO attachment shapes.

### Section loading
- **D-15:** The AIO section **auto-loads in parallel** with the main Jira issue data — a separate `useQuery` call fires immediately when the page mounts (same as all other issue detail sections). It does NOT block the Jira data render. Uses `useDelayedLoading` with 200ms threshold for skeleton display.
- **D-16:** Section placement: below `ActivityTimeline` in `IssueDetailPage.tsx` — natural position for supplementary non-Jira data. Above the activity log / below the main issue body area.

### Claude's Discretion
- Latest active cycle: pick the highest-sequence-number `Active` cycle (simple string sort on cycle key). No user configuration needed.
- Actual column default: `—` string for not-run steps (consistent with codebase `—` pattern for empty values).
- Multi-test-case grouping: uses a `<details>`/collapsible pattern consistent with `SubtasksSection` or a simple accordion — planner decides exact component.
- Thumbnail size: `~48px` height, preserving aspect ratio. Same `AuthImage` as other image rendering.
- Section heading: "AIO Test Runs" with a `FlaskConical` icon (same icon as AIO sidebar nav item — visual consistency).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior AIO phases (probe findings + service layer + navigation)
- `.planning/phases/51-aio-service-layer/51-CONTEXT.md` — D-13–D-17: dual base paths (`AIO_PROJECTS_API_PATH` / `AIO_API_PATH`), auth scheme, `AioTestRun` type, `AioPage<T>` wrapper, D-15 (no `/testrun?issueKey=` endpoint). **MUST READ** before writing any AIO service code.
- `.planning/phases/52-aio-navigation-project-pages/52-CONTEXT.md` — routing conventions, `AioCycle` type, sidebar gating pattern.
- `.planning/phases/53-cycle-detail-header-pinning/53-CONTEXT.md` — cycle detail page pattern, filter chip style, `fetchAioTestRunsForCycle` usage.

### AIO REST API docs (researcher: verify step endpoint + testcase?issueKey=)
- https://aiosupport.atlassian.net/wiki/spaces/AioTests/pages/2025619567 — Verify: (a) `GET /testcase?issueKey=` endpoint and response shape, (b) step-level endpoint for test run steps (action/expected/actual/status), (c) step attachment URL format.

### AIO service layer
- `taskflow/src/services/aio/types.ts` — `AioTestRun`, `AioCycle`, `AioPage<T>`. Update with step-level types after researcher confirms field names.
- `taskflow/src/services/aio/client.ts` — `aioFetch()`, `AIO_API_PATH`, `AIO_PROJECTS_API_PATH`. Do NOT modify.
- `taskflow/src/services/aio/issue-runs.ts` — `fetchAioTestRunsForCycle()` — cycle-scoped run fetching (Phase 51/53). Phase 54 adds issue-scoped service function here or in a new `issue-steps.ts` module.
- `taskflow/src/services/aio/cycles.ts` — `fetchAioCycles()` — used to find the latest active cycle for a project key.
- `taskflow/src/services/aio/index.ts` — Barrel. Add Phase 54 exports here.

### Issue detail page (integration target)
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` — Full-page route at `/issue/:key`. The AIO section is added here (below `ActivityTimeline`). Read existing section structure before adding.
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — Content layout reference.
- `taskflow/src/routes/dashboard/issue-detail/` — Existing section components (pattern to mirror for `AioTestRunsSection.tsx`).

### Lightbox components
- `taskflow/src/routes/dashboard/ImageLightbox.tsx` — Single-image authenticated lightbox. Takes `src: string`. Used for step attachment thumbnails. No adapter needed.
- `taskflow/src/routes/dashboard/AuthImage.tsx` — Authenticated image component. `needsAuth` triggers for URLs starting with `jiraBaseUrl` — AIO attachment URLs are on the same host.

### Settings store (aioEnabled gate)
- `taskflow/src/stores/settings.store.ts` — `aioEnabled: boolean` (added in Phase 51). Read this to gate the AIO section. Do NOT modify the store for Phase 54.

### Patterns to mirror
- `taskflow/src/routes/dashboard/issue-detail/AttachmentsSection.tsx` — Collapsible section pattern with image thumbnail + lightbox integration.
- `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` (Phase 53) — Step table, filter chip, skeleton, `useDelayedLoading` patterns. Direct analog for Phase 54 step rendering.
- `taskflow/src/routes/dashboard/AioCycleDetailSkeleton.tsx` — Skeleton pattern to adapt for `AioTestRunsSkeleton.tsx`.

### Requirements
- `.planning/REQUIREMENTS.md` §v1.8 — AIOI-01, AIOI-02, AIOI-03. Phase 54 scope.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fetchAioTestRunsForCycle(baseUrl, token, projectKey, cycleKey)` (`aio/issue-runs.ts`): Pagination loop for runs. Phase 54 adds an issue-scoped wrapper on top.
- `fetchAioCycles(baseUrl, token, projectKey)` (`aio/cycles.ts`): Returns all cycles for a project. Phase 54 uses this to find the latest active cycle.
- `useDelayedLoading` hook: 200ms flicker-prevention. Use for the AIO section skeleton.
- `ImageLightbox` (`routes/dashboard/ImageLightbox.tsx`): Single-image lightbox with `AuthImage`. Pass `src` (attachment URL) directly.
- `AuthImage` (`routes/dashboard/AuthImage.tsx`): Fetches images with Bearer auth when URL starts with `jiraBaseUrl`. AIO attachment URLs are on the same host — no modification needed.
- `<EmptyState>` component: Use for "No test runs in active cycle" empty state.
- `<Skeleton>` component: Base for `AioTestRunsSkeleton.tsx`.
- `FlaskConical` icon (lucide-react): Already in `ICON_MAP` from Phase 52 sidebar work. Use as section heading icon.
- `useSettingsStore` → `aioEnabled`: Gate the section render.

### Established Patterns
- **Page section:** `useQuery` → `useDelayedLoading` → skeleton / error / hidden / empty / data. See any issue-detail section component.
- **Credential loading:** `readSecret('jira-pat')` + `useAuthStore` for `jiraBaseUrl`.
- **Query key:** `['aio', jiraBaseUrl, 'issue-steps', issueKey]` — consistent with existing AIO key prefix.
- **Conditional section render:** `if (!aioEnabled) return null` — gate at the top of the section component.
- **Chip style:** Phase 53 `AioCycleDetailPage` status chips — reuse the same Tailwind classes for Pass/Fail/Blocked/Not Run.
- **Collapsible block:** `SubtasksSection` or `AttachmentsSection` toggle pattern — use for multi-test-case grouping.
- **AuthImage thumbnail:** `AttachmentThumbnail.tsx` shows the pattern for small authenticated image previews + lightbox trigger.

### Integration Points
- `IssueDetailPage.tsx`: Import and render `<AioTestRunsSection issueKey={issueKey} jiraBaseUrl={jiraBaseUrl} />` below `ActivityTimeline`.
- `aio/types.ts`: Add `AioTestRunStep` interface with fields confirmed by researcher (action, expectedResult, actualResult, status, attachments).
- `aio/index.ts`: Export new `fetchAioIssueSteps` (or equivalent) function.
- `settings.store.ts`: Read-only — `aioEnabled` already exists, no changes.

</code_context>

<specifics>
## Specific Ideas

- Section heading: "AIO Test Runs" with `FlaskConical` icon — same icon as sidebar AIO nav item for visual consistency across the AIO feature set.
- Step thumbnails appear **below** the actual result text in the "Actual" cell (stacked layout) — keeps the column width manageable.
- For the multi-test-case collapsible: the block header shows `<FlaskConical>` + test case name + run status chip. Collapsed by default for runs with `Pass` status; expanded by default for `Fail` or `Blocked` runs (surfaces problems immediately).
- Per-step status chip label mapping (from Phase 53 D-12): `NOT_EXECUTED` → `Not Run`, `PASS` → `Pass`, `FAIL` → `Fail`, `BLOCKED` → `Blocked`.

</specifics>

<deferred>
## Deferred Ideas

- **Showing runs from ALL cycles** — user selected "only active/latest cycle." Historical run data across all cycles could be a future "View full history" expansion.
- **Multi-image lightbox navigation for step attachments** — user chose single-image `ImageLightbox` per thumbnail. Multi-image navigation within a step's attachments is deferred.
- **Write actions** (update run status from issue detail) — explicitly out of scope per REQUIREMENTS.md `AIOWR-01`. Future milestone.

</deferred>

---

*Phase: 54-AIO on Issue Detail*
*Context gathered: 2026-05-13*
