---
phase: quick-260610-fnk
plan: 01
subsystem: wiki-renderer
tags: [wiki, jira, issue-key, react-markdown, rehype]
requires:
  - tryInternalPath (internalLinks.ts)
  - doneSummaryClass (issueDisplayUtils.ts)
  - fetchIssueDetail (services/jira.ts) + ['jira-issue-detail', key, jiraBaseUrl] cache
provides:
  - IssueKeyLink component (in-app issue-key link with done-state strikethrough)
  - isKnownPrefix helper (active-project gate, widenable later)
  - rehypeIssueKeys rehype plugin (prose-key linkification)
affects:
  - WikiRenderer.tsx (all issue descriptions/comments rendered via WikiRenderer)
tech-stack:
  added: []
  patterns:
    - rehype tree transform (unist-util-visit) for prose linkification
    - synthetic allowlisted hast element (<issuekeylink>) bridging plugin → component
    - shared TanStack issue-detail cache reuse (dedup, cache-first, non-blocking)
key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
    - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
decisions:
  - "Linkify only keys whose prefix === activeJiraProject (no app-wide project list exists)"
  - "Use a rehype plugin instead of a `text` component override — react-markdown 10 dropped text-node component overrides"
  - "The `a` override single-owns browse/KEY URLs (renders IssueKeyLink, never a nested <a>) so nesting is structurally impossible"
metrics:
  duration: ~25m
  completed: 2026-06-10
---

# Quick Task 260610-fnk: Issue-key linking in wiki renderer Summary

Bare active-project Jira issue keys (e.g. `PROD-123`) in wiki prose now render as clickable in-app links to `/issue/KEY`, with a line-through strike when the referenced issue is in a `done` status — reusing the app-wide issue-detail query cache (no new fetch path).

## What was built

- **`isKnownPrefix(key, activeJiraProject)`** — module-private gate; returns true only when the key's prefix equals the active Jira project (D-02). Isolated so it can be widened later (e.g. to a cached `['jira-projects']` query) without touching call sites.
- **`IssueKeyLink({ issueKey })`** — renders the key as an `<a href="#issue-KEY">` immediately (non-blocking, D-01). Resolves done-state via `useQuery` with the *exact* PeekPanel/IssueDetailView key/queryFn/staleTime/enabled (`['jira-issue-detail', issueKey, jiraBaseUrl]`), so TanStack dedupes against the app-wide cache and cached keys cost zero network. `doneSummaryClass` applies `line-through` only when `statusCategory.key === 'done'` (D-03). Click mirrors the existing `a` override (preventDefault → breadcrumbPush → navigate).
- **`rehypeIssueKeys(activeJiraProject)`** — rehype plugin that walks hast text nodes, SKIPs text under `<a>`/`<code>`/`<pre>` (D-04/D-05), and splits remaining prose on the canonical key pattern, replacing active-project keys with `<issuekeylink data-key="KEY">` elements (allowlisted in the sanitize schema, rendered as `IssueKeyLink`). Runs after `rehypeRaw`, before `rehypeSanitize`.
- **`a` override internal-issue branch** — when `tryInternalPath(href)` resolves to `/issue/KEY`, the override returns a single `IssueKeyLink` (not an `<a>` wrapper), so a full `browse/PROD-123` URL renders EXACTLY ONE anchor with no nested `<a>` (D-05). `internalPath` is computed once at render and reused in `handleClick`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Planned `text` component override does not work in react-markdown 10**
- **Found during:** Task 3 (tests failed — prose keys were never linkified).
- **Issue:** The plan's RESEARCH assumed react-markdown invokes a `text` component override for prose text nodes. react-markdown **10.1.0** (this project's version) removed `text` from the components map — text nodes render directly, so the override never fired.
- **Fix:** Replaced the `text` override with a `rehypeIssueKeys` rehype plugin (`unist-util-visit`) that transforms the hast tree before sanitize, emitting an allowlisted `<issuekeylink>` element rendered by the components map. This preserves every planned behavior and decision (D-02/D-04/D-05) — only the integration mechanism changed. The `a`-override single-ownership design (D-05) is unaffected and still makes nested `<a>` structurally impossible (text under `<a>` is SKIPped by the plugin).
- **Files modified:** taskflow/src/routes/dashboard/WikiRenderer.tsx
- **Commits:** bf45fb6b (initial text-override attempt, superseded), 49bae135 (rehype plugin fix)

**2. [Rule 1 - Bug] Two pre-existing browse-URL tests broke after the `a`-override change**
- **Found during:** Task 3.
- **Issue:** The `a` override now renders `IssueKeyLink` (which calls `useQuery`) for `browse/KEY` URLs. Two existing tests rendered `WikiRenderer` for such a URL without a `QueryClientProvider`, so they threw "No QueryClient set".
- **Fix:** Routed those two tests through the new `renderWiki` helper (QueryClientProvider + MemoryRouter). Navigation/breadcrumb behavior is preserved by `IssueKeyLink`'s own click handler, so the original assertions still hold.
- **Files modified:** taskflow/src/routes/dashboard/WikiRenderer.test.tsx
- **Commit:** 6e2dcaaa

**3. [Rule 1 - Test fixture] Test C fixture used the wrong code form**
- **Found during:** Task 3.
- **Issue:** `{code}PROD-9{code}` (single line, no newline) makes jira2md treat `PROD-9` as the fenced-block *language* (`<code class="language-PROD-9">` with empty body), so asserting the key text inside `<code>` failed.
- **Fix:** Switched Test C to an inline code span (`{{PROD-9}}` → `<code>PROD-9</code>`), which is a cleaner test of the D-04 requirement (key inside code stays literal, no anchor). The behavior under test — no linkification inside code — is identical.
- **Files modified:** taskflow/src/routes/dashboard/WikiRenderer.test.tsx
- **Commit:** 6e2dcaaa

## Tests

Five new behaviour cases in `describe('issue-key linkification (260610-fnk)')`, plus a `renderWiki` helper and a `fetchIssueDetail` mock:
- A: active-prefix prose key linkifies and navigates to `/issue/PROD-123`.
- B: `statusCategory.key === 'done'` → `line-through`; `indeterminate` → no strikethrough (cache pre-seeded via `qc.setQueryData`).
- C: key inside an inline code span stays literal, no anchor.
- D: non-active-prefix key (`OTHER-1`) stays plain text.
- E (D-05): a full `browse/PROD-123` URL renders exactly one anchor for the key with no nested `<a>`.

All 150 WikiRenderer tests pass.

## Verification

- `biome check ./src` — PASS (467 files, no fixes).
- `tsc --noEmit` — PASS (no errors).
- `vitest run src/routes/dashboard/WikiRenderer.test.tsx` — 150/150 pass.

(Note: the worktree has no own `node_modules`; tooling was run via a symlink to the main checkout's `node_modules`. The symlink is gitignored and not part of any commit.)

## Threat surface

No new surface beyond the plan's `<threat_model>`. The `<issuekeylink>` element introduced for T-fnk-01 carries only a plain `data-key` string (no raw HTML, no arbitrary href — href is a fixed `#issue-KEY` fragment, navigation goes through `navigate('/issue/'+key)`), and it is explicitly allowlisted in `wikiSanitizeSchema`. The status query remains gated by `enabled: !!jiraConnected && !!jiraBaseUrl` and only fires for active-project keys (T-fnk-02).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: taskflow/src/routes/dashboard/WikiRenderer.tsx
- FOUND: taskflow/src/routes/dashboard/WikiRenderer.test.tsx
- FOUND commit 78f4d105 (Task 1: isKnownPrefix + IssueKeyLink)
- FOUND commit bf45fb6b (Task 2: text override + a-override single-ownership)
- FOUND commit 49bae135 (Rule 3 fix: rehype plugin)
- FOUND commit 6e2dcaaa (Task 3: tests)
