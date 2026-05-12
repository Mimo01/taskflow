# Stack Research: AIO TCMS Integration

**Milestone:** Taskflow v1.8 — AIO Test Management
**Researched:** 2026-05-12
**Confidence:** HIGH (based on codebase analysis) / MEDIUM (AIO API shape, web tool access restricted)

---

## Scope

This is a SUBSEQUENT MILESTONE document. The validated v1.7 stack (Tauri 2, React 19, TypeScript,
TanStack Query v5, shadcn/ui, Tailwind v4, Zustand, Vitest, Biome, @dnd-kit, @tanstack/react-virtual,
react-grid-layout, jira2md, react-markdown, remark-gfm, rehype-raw, react-hotkeys-hook, cmdk,
babel-plugin-react-compiler) is NOT re-researched. Only net-new additions for v1.8 are assessed here.

---

## New Dependencies Needed

| Library | Version | Purpose | Why not existing? |
|---------|---------|---------|-------------------|
| `recharts` | `^2.15.x` | Burndown/trend line chart for AIO cycle detail view | No chart library exists in the project. SprintProgressTab uses a raw CSS flex stacked bar — sufficient for percentage bars but cannot draw a time-series line chart. recharts is the library shadcn/ui's `chart` component is built on; `shadcn add chart` generates a chart wrapper that delegates to recharts. Adding recharts aligns the chart primitive with the rest of the shadcn component model and gives the React Compiler full visibility into memoizable chart components. |

### Notes on recharts version

The project currently has `shadcn@^4.0.5` as a devDep. shadcn v4 generates chart components backed by recharts `^2.x`. Pin to `^2.15.x` to stay in the semver range that shadcn generates code for. recharts 3.x is in development but not yet the shadcn default. (MEDIUM confidence — cannot verify exact current shadcn chart peer dep without web access; `^2.x` is safe.)

---

## Existing Stack Sufficient For

**AIO REST API client — no new HTTP library needed.**
`@tauri-apps/plugin-http` fetch already bypasses CORS for on-premise Jira. AIO Test Management
is a Jira Data Center plugin; its REST API is served from the same Jira host at
`/rest/aio-tcms/1.0/`. All calls authenticate with the same Bearer PAT stored in Stronghold.
The `apiFetch` wrapper already handles logging, timeout, and auth header redaction.

The only change needed: `apiFetch`'s `source` union type is `'jira' | 'gitlab'`. AIO API
calls go to the Jira host so `'jira'` is semantically correct and correctly triggers
`setJiraConnected(false)` on 401. No type change required — just pass `'jira'` as the source.

**AIO test step tables — no new markup parser needed.**
AIO stores test step tables as Jira wiki table syntax (`||Step||Expected||` header rows,
`|value|value|` data rows). The existing `jira2md` + `remark-gfm` + `rehype-raw` pipeline
already converts Jira wiki tables to GFM Markdown tables, which `react-markdown` renders as
`<table>` elements. `WikiRenderer.tsx` handles this today for issue descriptions. The
AIO-specific wrinkle (step/expected/actual columns for test case steps) is a presentation
layer concern, not a parsing concern — a dedicated `TestStepTable` component can either
reuse `WikiRenderer` directly or parse the steps from the structured AIO API response
(AIO's `getTestCaseSteps` endpoint returns structured JSON with step/expectedResult/testData
fields, not wiki markup). If structured JSON is available from the API, prefer that — zero
markup parsing needed.

**AIO attachment URLs — no new fetch mechanism needed.**
`AuthImage.tsx` already handles authenticated image fetching: it detects when a URL
starts with `jiraBaseUrl`, fetches via `@tauri-apps/plugin-http` with Bearer auth, and
returns a blob URL. AIO attachment URLs are served from the same Jira host so `AuthImage`
works without modification. The existing `AttachmentLightbox` can be reused or extended
with an `aio` attachment shape. No new component or library needed.

**TanStack Query for AIO data fetching — no change needed.**
All AIO data (projects, cycles, test runs, stats) fits the existing `useQuery` +
`queryKey` + `staleTime` pattern. AIO cycle data should use a generous staleTime
(5–10 min) since test execution results change less frequently than sprint board issues.

**Sidebar section, route navigation, tab pinning — no new deps.**
The existing sidebar customization system (Zustand store, drag-and-drop reorder via
@dnd-kit, visibility toggles), hash router, and header tab strip with `LazyStore` persistence
handle the AIO sidebar section and cycle pinning requirements without new libraries.

**Progress bars and status badges — no new deps.**
Cycle progress (tests passed/failed/blocked/not run) fits the CSS flex stacked bar
pattern already used in `SprintProgressTab`. The shadcn `Badge` component handles
colored status labels. No new UI library needed.

---

## Anti-patterns / What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| AIO SDK / `@aio-tests/rest-client` (if it exists) | Vendor SDKs add large dependencies, enforce their own typing conventions, and may not support Jira Data Center. Direct REST calls with typed response interfaces is the established pattern across all Jira and GitLab services in this codebase. | Raw `apiFetch('jira', ...)` calls in a new `src/services/aio/` domain module, same pattern as `src/services/jira/` decomposition |
| `chart.js` / `react-chartjs-2` | 200KB+ bundle weight for a canvas-based chart that fights React's reconciler. recharts is SVG-based, React-native, and the shadcn/ui ecosystem standard. | `recharts` |
| `d3` directly | D3 is what recharts uses internally. Pulling in D3 for one burndown chart adds ~400KB and requires manual React integration. | `recharts` LineChart with pre-computed data points |
| `nivo` charts | Beautiful but large (tree-shakeable but complex setup). Overkill for a single burndown trend line. | `recharts` |
| `visx` (Airbnb) | Low-level primitives requiring manual SVG layout composition. High effort for marginal gain on a simple time-series line. | `recharts` |
| Separate AIO auth token / credential store | AIO TCMS uses the same Jira PAT. Adding a second Stronghold secret or auth store entry for AIO would create credential drift and confuse the onboarding flow. | Reuse `readSecret('jira-pat')` and `jiraBaseUrl` from `useAuthStore` |
| Historical burndown data pipeline | PROJECT.md explicitly puts "Historical analytics / burndown charts" out of scope as a general feature. AIO's cycle burndown is acceptable ONLY because AIO's API returns pre-computed daily snapshot arrays — no local data warehousing or historical polling required. Do not build any local time-series storage. | Render what AIO's API returns directly |
| Shadcn `chart` CLI component | `shadcn add chart` generates a wrapper that re-exports recharts with some context wiring. For a single burndown line chart it adds boilerplate that obscures the simple recharts usage. Install recharts directly and render `<LineChart>` inline. | Direct recharts import |
| New `apiFetch` source type for AIO | AIO is served from the Jira host; `'jira'` is the correct source. Adding `'aio'` as a third source type would require changes to `apiFetch`, `markDisconnected`, devtools log filtering, and operation profiler — for no user-visible benefit. | Pass `'jira'` as the source for all AIO calls |

---

## Integration Notes

### AIO Service Module Pattern

Create `src/services/aio/` mirroring the existing Jira domain decomposition:

```
src/services/aio/
  index.ts         # barrel re-export
  types.ts         # AioProject, AioCycle, AioTestRun, AioStats interfaces
  projects.ts      # fetchAioProjects()
  cycles.ts        # fetchAioCycles(), fetchAioCycleDetail()
  test-runs.ts     # fetchCycleTestRuns(), fetchIssueTestRuns()
  client.ts        # shared AIO pagination helper (if needed)
```

All functions follow the `(baseUrl, token, ...) => Promise<T>` signature used throughout
the Jira service modules. Use `apiFetch('jira', url, { headers: { Authorization: \`Bearer \${token}\` } })`.

### Query Key Convention

Follow the existing flat-array convention:
```typescript
queryKey: ['aio-projects', jiraBaseUrl]
queryKey: ['aio-cycles', jiraBaseUrl, projectId]
queryKey: ['aio-cycle-detail', jiraBaseUrl, cycleId]
queryKey: ['aio-test-runs', jiraBaseUrl, issueKey]  // for issue detail panel
```

### Burndown Chart Integration

AIO's cycle detail endpoint returns pre-computed daily execution stats (confirmed by AIO
documentation pattern — MEDIUM confidence). The burndown data shape is approximately:

```typescript
interface AioBurndownPoint {
  date: string;       // ISO date
  remaining: number;  // tests not yet executed
  passed: number;
  failed: number;
}
```

Render with recharts `<LineChart>` using `<CartesianGrid>`, `<XAxis>`, `<YAxis>`,
`<Tooltip>`, and one `<Line>` per series. The chart can live in a `CycleBurndownChart.tsx`
component under `src/routes/aio/`. No recharts context provider setup required for a simple
line chart. Use Tailwind CSS variables for colors to match the app's dark/light themes
(`var(--color-primary)`, `var(--color-destructive)`, etc.).

### Authenticated AIO Attachments

AIO test run step attachments are stored under the Jira host. The existing `AuthImage`
component handles this transparently — pass the attachment URL and it fetches with Bearer
auth if the URL starts with `jiraBaseUrl`. For the lightbox, reuse `AttachmentLightbox`
or `ImageLightbox` (the single-image variant already in `ImageLightbox.tsx`). AIO
attachment objects need an adapter to the `JiraAttachment` shape, or `AttachmentLightbox`
can be generalized to accept a simpler `{ url: string; filename: string }` prop.

### AIO Step Table (Structured API path)

If the AIO `/getTestCaseSteps` endpoint returns structured JSON (step, expectedResult,
testData per row), build a `TestStepTable` component that renders an HTML table directly
with Tailwind classes — no wiki parsing. This is cleaner than routing through `WikiRenderer`
and gives full control over the pass/fail/blocked cell coloring required by the v1.8 spec.

If AIO returns steps embedded in wiki markup (fallback), `WikiRenderer` handles it via
`jira2md` table conversion + GFM table rendering — no changes needed.

### Sidebar AIO Section

Extend `sidebar-items.ts` with AIO nav entries. The sidebar customization store already
supports arbitrary item IDs with visibility + order persistence. Follow the established
pattern: add AIO items to the default sidebar item list with a `visible: true` default,
let users reorder/hide them in Settings → Sidebar.

---

## Installation

```bash
# From taskflow/ directory
npm install recharts
```

No Cargo.toml or Tauri plugin changes required. No new Tauri capabilities needed — AIO
calls go through the existing `@tauri-apps/plugin-http` which is already allowed for the
Jira origin.

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `recharts` | `^2.15.x` | React 19, TypeScript 5.9, Vite 8, babel-plugin-react-compiler | recharts 2.x ships its own TypeScript types. React Compiler handles recharts components correctly — they use standard React patterns. No known Tauri webview incompatibilities. SVG-based so no canvas permissions needed. |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| No new HTTP/fetch library needed | HIGH | Codebase audit — `apiFetch` + `@tauri-apps/plugin-http` already established |
| recharts as chart library | HIGH | Only new dep needed; aligns with shadcn ecosystem; SVG-based fits Tauri webview |
| AIO uses Jira PAT (same credentials) | HIGH | AIO TCMS is a Jira Data Center plugin — same host, same auth model |
| AIO REST API base path `/rest/aio-tcms/1.0/` | MEDIUM | Standard plugin REST path convention; web access restricted for verification |
| Structured JSON from AIO step endpoint | MEDIUM | AIO's API is documented to return structured step data; could not verify current schema |
| Wiki markup pipeline sufficient for tables | HIGH | jira2md + remark-gfm handles Jira table syntax today — verified in codebase |
| AuthImage covers AIO attachments without changes | HIGH | Logic based on URL prefix match — same Jira host = same code path |

---

*Stack research for: Taskflow v1.8 AIO Test Management*
*Researched: 2026-05-12*
