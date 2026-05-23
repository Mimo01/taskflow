# Phase 56: Redesign AIO Cycles Page, Optimize AIO Loading Performance, Add Defects and Executions Views - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 56-redesign-aio-cycles-page-optimize-aio-loading-performance-ad
**Areas discussed:** Cycles page stats, Defects + executions views, Defects view richness, Loading performance approach

---

## Cycles page stats

| Option | Description | Selected |
|--------|-------------|----------|
| Progress bar + counts | Each row gets a mini progress bar + Pass/Fail/Blocked/Not Run counts (N parallel run fetches) | ✓ (Claude) |
| Total run count only | Just show 'X runs' next to status. Lightweight count. | |
| Status badge only (no stats) | Keep current 3-column layout, visual refresh only, no extra API calls | |
| You decide | Claude picks the approach | ✓ (user selected) |

**User's choice:** You decide — Claude selected "Progress bar + counts"

**Follow-up — column layout:**

| Option | Description | Selected |
|--------|-------------|----------|
| Just four + stats | Key / Name / Status / progress bar + counts | ✓ (Claude) |
| Add created/updated date | Date column (requires unverified API field on AioCycle) | |
| Add total run count as number | 'X runs' alongside progress bar | |
| You decide | Claude picks | ✓ (user selected) |

**User's choice:** You decide — Claude selected "just Key/Name/Status/progress+counts"

**Follow-up — loading strategy:**

| Option | Description | Selected |
|--------|-------------|----------|
| Progressive per row | Cycle list renders immediately; each row fires its own useQuery for stats | ✓ |
| All-or-nothing load | Block entire cycle list until all N run fetches complete | |

**User's choice:** Progressive per row (Recommended)

**Notes:** User consistently deferred visual/architecture decisions to Claude. Chose progressive loading for better perceived performance.

---

## Defects + executions views

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs: Executions \| Defects | Cycle detail gets tab bar; progress bar above tabs | ✓ (Claude) |
| Stacked sections (no tabs) | Keep single-scroll layout, promote defects to full section | |
| Separate defects page | Defects become a separate route | |

**User's choice:** You decide — Claude selected "Tabs: Executions | Defects"

**Follow-up — Executions tab content:**

| Option | Description | Selected |
|--------|-------------|----------|
| Current run table, promoted to a tab | Existing Test Case/Status/Date table in a tab | |
| Enhanced: add executor column | Add who ran each test (requires API verification) | |
| Enhanced: link to run detail | Each row links to AioTestRunDetailPage | ✓ |

**User's choice:** Enhanced: link to run detail

**Follow-up — tab component:**

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn Tabs primitive | taskflow/src/components/ui/tabs.tsx — consistent with Settings | ✓ (Claude) |
| Custom pill-style tabs | Simpler but new pattern | |
| You decide | Claude picks | ✓ (user selected) |

**User's choice:** You decide — Claude selected shadcn Tabs

**Notes:** User picked clickable run rows (linking to run detail) over executor column. No API research needed for executor field in this phase.

---

## Defects view richness

| Option | Description | Selected |
|--------|-------------|----------|
| Key + title + status (fetchJiraIssueByKey) | Enriched with Jira data; one call per defect | ✓ (Claude) |
| Key + which test run triggered it | Lightweight; no Jira fetch; traceability only | |
| Just the current key links | Minimal; cleaner layout but no enrichment | |
| You decide | Claude picks | ✓ (user selected) |

**User's choice:** You decide — Claude selected "Key + title + status"

**Follow-up — triggered-by column:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — show defect source run | Show test case(s) that linked the defect (from existing runs data) | ✓ |
| No — just key / title / status | Clean and simple | |

**User's choice:** Yes — show defect source run

**Notes:** Two data sources combined: Jira fetch for title+status, runs data for triggered-by. No extra API calls for the traceability column.

---

## Loading performance approach

| Option | Description | Selected |
|--------|-------------|----------|
| Shared useAioCredentials() hook | Extract useEffect + readSecret into one hook; DRY; same behavior | ✓ |
| Pre-load into useAuthStore at app startup | Token ready immediately; bigger change; faster UX | |
| Pre-load only on AIO routes (route loader) | Middle ground; no startup cost, eliminates in-page waterfall | |

**User's choice:** Shared useAioCredentials() hook (Recommended)

**Follow-up — hook return shape:**

| Option | Description | Selected |
|--------|-------------|----------|
| Return { token, isLoading } | Queries gate on !!token && !isLoading; skeleton while token loads | ✓ |
| Return token \| null only | Simpler; brief null flash until loaded (current behavior) | |

**User's choice:** Return { token, isLoading } (Recommended)

**Follow-up — query timing:**

| Option | Description | Selected |
|--------|-------------|----------|
| Wait for token (same as today) | All AIO queries gate on !!token; predictable waterfall | ✓ |
| Start stats queries in parallel with token load | Not viable — queries require token to be non-null | |

**User's choice:** Wait for token (same as today)

**Notes:** Straightforward DRY refactor. User chose incremental approach (hook) over larger store-level pre-loading.

---

## Claude's Discretion

- Cycles page: column set (Key/Name/Status/progress+counts), visual style of mini progress bar (h-1.5, same color scheme)
- Cycle detail: tabs layout (Executions | Defects), shadcn Tabs component, default tab (Executions)
- Defects tab: Jira enrichment via `fetchJiraIssueByKey` (Option 1 "Key + title + status")
- Prop-drilling vs. direct hook call for token inside cycle row stats sub-components (planner decision)
- Whether clicking run rows uses `<NavLink>` or `useNavigate() + onClick` (planner decision)

## Deferred Ideas

- Pre-loading AIO token into `useAuthStore` at startup — considered, user chose shared hook instead
- Route-level token pre-loading (React Router loader) — deferred
- Date column on cycles page — AioCycle type doesn't carry date; deferred pending API probe
- Executions tab: executor/tester column — requires API field verification; not in scope
- Total run count as separate column — redundant with progress bar counts; deferred
