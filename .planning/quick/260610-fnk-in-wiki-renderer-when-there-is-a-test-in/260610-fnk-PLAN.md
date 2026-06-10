---
phase: quick-260610-fnk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/WikiRenderer.tsx
  - taskflow/src/routes/dashboard/WikiRenderer.test.tsx
autonomous: true
requirements:
  - FNK-01
  - FNK-02
  - FNK-03
  - FNK-04
  - FNK-05
user_setup: []

must_haves:
  truths:
    - "A bare issue key whose prefix equals activeJiraProject renders as a clickable link to /issue/KEY (D-01, D-02)"
    - "Clicking a rendered issue-key link pushes a breadcrumb and navigates to /issue/KEY (matches existing a-override)"
    - "When the referenced issue's statusCategory is 'done', the link text gets line-through; otherwise no strikethrough (D-01, D-03)"
    - "A key whose prefix is NOT activeJiraProject stays plain text, not a link (D-02)"
    - "An issue key inside an inline code span or fenced code block is NOT linkified (D-04)"
    - "A full Jira browse/KEY URL (whose a-override resolves to /issue/KEY) renders EXACTLY ONE anchor for the key with no nested <a> (D-05)"
    - "Status resolution is async and non-blocking: the link renders immediately, strikethrough may appear a beat later (D-01)"
    - "npm run check (biome + tsc) stays GREEN"
  artifacts:
    - path: "taskflow/src/routes/dashboard/WikiRenderer.tsx"
      provides: "IssueKeyLink component, isKnownPrefix helper, a text component override, and an internal-issue branch in the a override"
      contains: "isKnownPrefix"
    - path: "taskflow/src/routes/dashboard/WikiRenderer.test.tsx"
      provides: "Tests for linkify/strikethrough/code-exclusion/non-active-prefix/browse-URL-nesting behaviour with a QueryClientProvider wrapper"
      contains: "IssueKeyLink"
  key_links:
    - from: "WikiRenderer.tsx text override"
      to: "IssueKeyLink"
      via: "split prose text nodes on canonical key pattern, filter by isKnownPrefix (text override never fires for anchor children — they are not AST text nodes)"
      pattern: "isKnownPrefix"
    - from: "WikiRenderer.tsx a override"
      to: "IssueKeyLink"
      via: "when tryInternalPath(href) resolves to /issue/KEY, the a override OWNS the key and renders <IssueKeyLink issueKey={KEY}/> as its single child — the key string is React JSX, not an AST text node, so the text override cannot re-wrap it (D-05)"
      pattern: "IssueKeyLink"
    - from: "IssueKeyLink"
      to: "['jira-issue-detail', issueKey, jiraBaseUrl]"
      via: "useQuery reusing the PeekPanel/IssueDetailView cache key"
      pattern: "jira-issue-detail"
    - from: "IssueKeyLink"
      to: "doneSummaryClass"
      via: "data.fields.status.statusCategory → line-through"
      pattern: "doneSummaryClass"
---

<objective>
In the wiki renderer, linkify bare Jira issue keys (e.g. `PROD-123`) whose project prefix
equals the active Jira project, rendering each as a clickable in-app link to `/issue/KEY`.
When the referenced issue is in a `done` status category, strike through (line-through) the
link text. Keys for other prefixes, keys inside code spans/blocks, and keys that are already
the label of an existing link are left untouched.

Purpose: Make issue references in descriptions/comments navigable, with at-a-glance done-state
signalling, reusing the app's existing issue-detail query cache (no new fetch path).
Output: An `IssueKeyLink` component + `isKnownPrefix` helper + a `text` component override + an
internal-issue branch in the `a` override in `WikiRenderer.tsx`, plus tests in `WikiRenderer.test.tsx`.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260610-fnk-in-wiki-renderer-when-there-is-a-test-in/260610-fnk-CONTEXT.md
@.planning/quick/260610-fnk-in-wiki-renderer-when-there-is-a-test-in/260610-fnk-RESEARCH.md

# Integration point: markdownComponents map (~line 988) + existing `a` override (~1091)
# deriveSourceCrumb is module-private at ~line 920; activeJiraProject read from useAuthStore
# The `a` override already maps Jira browse/KEY URLs to /issue/KEY via tryInternalPath (~line 1127)
@taskflow/src/routes/dashboard/WikiRenderer.tsx

# tryInternalPath: `{jiraBaseUrl}/browse/{KEY}` → `/issue/{KEY}` (returns string | null)
@taskflow/src/lib/internalLinks.ts

# Reuse, do not hand-roll: done detection
@taskflow/src/lib/issueDisplayUtils.ts

# Canonical issue-detail query to mirror EXACTLY (queryKey, queryFn, staleTime, enabled)
@taskflow/src/components/app/PeekPanel.tsx
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add isKnownPrefix helper + IssueKeyLink component to WikiRenderer.tsx</name>
  <files>taskflow/src/routes/dashboard/WikiRenderer.tsx</files>
  <behavior>
    - isKnownPrefix("PROD-123") returns true only when "PROD" === activeJiraProject (D-02).
    - isKnownPrefix("COVID-19") / ("UTF-8") returns false when prefix !== activeJiraProject.
    - IssueKeyLink renders an <a> with text === issueKey and href="#issue-KEY" immediately,
      regardless of query state (non-blocking render, D-01).
    - IssueKeyLink applies className from doneSummaryClass(data?.fields?.status?.statusCategory):
      '' until resolved, 'line-through' once statusCategory.key === 'done' (D-01, D-03).
    - Clicking calls preventDefault, breadcrumbPush(deriveSourceCrumb(location.pathname)),
      then navigate(`/issue/${issueKey}`) — mirrors the existing `a` override (Pitfall 4).
  </behavior>
  <action>
    In `taskflow/src/routes/dashboard/WikiRenderer.tsx`:
    (1) Add imports: `useQuery` from `@tanstack/react-query`; `fetchIssueDetail` from
    `@/services/jira`; `readSecret` from `@/services/stronghold`; `useSettingsStore` from
    `@/stores/settings.store`; `doneSummaryClass` from `@/lib/issueDisplayUtils`. Extend the
    existing `useAuthStore` destructure in WikiRenderer to also pull `jiraConnected` and
    `activeJiraProject` (jiraBaseUrl is already read at ~line 981).
    (2) Add a module-private `isKnownPrefix(key: string, activeJiraProject: string | null): boolean`
    helper that returns false when activeJiraProject is falsy, else compares `key.split('-')[0] === activeJiraProject`.
    Isolate the active-project decision here so it can be widened later (D-02). Do NOT inline the
    prefix comparison at the call site.
    (3) Add an `IssueKeyLink({ issueKey }: { issueKey: string })` component INSIDE WikiRenderer.tsx
    (same module so it can call the module-private `deriveSourceCrumb` at ~line 920). It must:
    read navigate/location/breadcrumbPush/jiraBaseUrl/jiraConnected and the five settings field
    keys (epicLinkFieldKey, epicNameFieldKey, sprintFieldKey, storyPointsFieldKey, epicColorFieldKey)
    from useSettingsStore; run `useQuery` with queryKey `['jira-issue-detail', issueKey, jiraBaseUrl]`,
    queryFn/staleTime(30_000)/enabled COPIED VERBATIM from PeekPanel.tsx:77-92 (so TanStack dedupes
    against the app-wide cache and cached keys cost zero network — D-01 cache-first/dedup/non-blocking);
    compute `const doneClass = doneSummaryClass(data?.fields?.status?.statusCategory)`; render
    `<a href={`#issue-${issueKey}`} className={cn('text-primary hover:underline', doneClass)} onClick={...}>{issueKey}</a>`
    where onClick does e.preventDefault() → breadcrumbPush(deriveSourceCrumb(location.pathname)) →
    navigate(`/issue/${issueKey}`). Use the existing `cn` import.
    Do NOT use `findJiraIssueInCache` (it returns summary-shaped/partial data with no reliable status —
    RESEARCH §On-Demand Status). Do NOT add a spinner or reserve layout for the strikethrough
    (line-through does not change box size — Pitfall 2).
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard/WikiRenderer.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>WikiRenderer.tsx defines isKnownPrefix and IssueKeyLink; tsc/biome have no new errors;
  IssueKeyLink renders the key as a link immediately and applies line-through only when
  statusCategory.key === 'done'.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire the text override for prose keys + make the a override own browse/KEY URLs (D-05)</name>
  <files>taskflow/src/routes/dashboard/WikiRenderer.tsx</files>
  <behavior>
    - The `text` override fires ONLY for markdown-AST text nodes (bare prose), never for strings
      rendered inside our own custom components. Verified: react-markdown's `text` component is invoked
      during the AST→React transform; a string we render ourselves inside `<a>`/`<IssueKeyLink>` is
      plain React JSX and bypasses that transform entirely (RESEARCH §Integration Point). This is the
      whole basis of the D-05 guard.
    - A `text` entry splits its string child on the canonical pattern `\b[A-Z][A-Z0-9_]+-\d+\b` and
      renders each exact-match part that passes isKnownPrefix via <IssueKeyLink>; all other parts
      render as plain text (D-02). Because the override only sees prose text nodes, an anchor's label
      string is NEVER routed here.
    - Code text (inline code / fenced code) is routed through react-markdown's code/pre path, not the
      `text` override, so code-block keys stay literal (D-04) — confirmed by no code/pre override existing.
    - The `a` override OWNS ancestor context. When its href resolves (via tryInternalPath) to an internal
      `/issue/KEY` path, the override renders `<IssueKeyLink issueKey={KEY} />` as its child instead of
      `<a>{children}</a>`. IssueKeyLink emits the single anchor (with status/strikethrough), and the key
      string inside it is React JSX — NOT an AST text node — so the `text` override cannot re-wrap it.
      Net result: a full `browse/PROD-123` URL produces EXACTLY ONE anchor for the key, never nested
      `<a><a>` (D-05).
  </behavior>
  <action>
    In `taskflow/src/routes/dashboard/WikiRenderer.tsx`, inside the `markdownComponents` object
    (alongside the existing img/table/a overrides, ~line 988-1143), apply these THREE steps in order:

    (1) Add a `text` override that handles bare prose keys only:
    `text: ({ children }) => { if (typeof children !== 'string') return <>{children}</>; const parts = children.split(/(\b[A-Z][A-Z0-9_]+-\d+\b)/g); return <>{parts.map((part, i) => /^[A-Z][A-Z0-9_]+-\d+$/.test(part) && isKnownPrefix(part, activeJiraProject) ? <IssueKeyLink key={i} issueKey={part} /> : part)}</>; }`.
    Returning a fragment from `text` is supported by react-markdown (RESEARCH §Integration Point). The
    split-output for a given text node is deterministic, so positional `key={i}` is stable. This override
    only ever receives AST text nodes (prose), so it cannot fire for an anchor's label string.

    (2) Make the existing `a` override own the internal-issue case so anchor labels are never re-linkified.
    The `a` override already computes `tryInternalPath(href, linkCtx)` inside `handleClick`. Lift that call
    so the resolved path is available at render time: compute `const internalPath = href ? tryInternalPath(href, linkCtx) : null;` near the top of the `a` override body (AFTER the falsy-href and `#`-anchor early returns, BEFORE the image-attachment branch). Then add this branch immediately after `internalPath` is computed:
    if `internalPath` matches `/^\/issue\/([A-Z][A-Z0-9_]+-\d+)$/`, capture the key from the match and
    `return <IssueKeyLink issueKey={KEY} />;` — do NOT render an `<a>` wrapper and do NOT pass `children`
    through. IssueKeyLink is the sole anchor for this key, carrying the same navigate/breadcrumb/strikethrough
    behavior. (Reuse the now-computed `internalPath` in `handleClick` instead of calling `tryInternalPath`
    a second time, to keep a single source of truth.)

    (3) Confirm no further nesting path exists: the `text` override (step 1) cannot fire for the
    IssueKeyLink label because that label is React JSX rendered by our component, not a markdown text node
    (step 2 behavior note). Therefore no skip-if-inside-anchor heuristic, no DOM ancestor inspection, and no
    plain-span fallback are needed — the single-ownership design makes nesting structurally impossible.

    Do NOT touch `preprocessJiraMarkup`, the sanitize schema, or the serialize path — the render-only
    change is provably round-trip safe (Pitfall 5; serializer not imported here).
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard/WikiRenderer.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>markdownComponents has a `text` entry that linkifies known-prefix prose keys and leaves
  code-block / non-active-prefix keys plain; the `a` override returns <IssueKeyLink> (not a nested <a>)
  when its href resolves to /issue/KEY; a full `browse/PROD-123` URL renders EXACTLY ONE anchor for the
  key (no nested <a>), proven by Task 3 Test E.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Tests — QueryClient wrapper + active-prefix mock + five behaviour cases</name>
  <files>taskflow/src/routes/dashboard/WikiRenderer.test.tsx</files>
  <behavior>
    - Test A: `PROD-123` (prefix === activeJiraProject) renders an anchor whose text is `PROD-123`
      pointing in-app; clicking navigates to /issue/PROD-123 (navigateMock called).
    - Test B: when the mocked issue-detail query resolves with statusCategory.key === 'done',
      the link gains the `line-through` class; with key 'indeterminate' it does NOT.
    - Test C: a key inside a fenced/inline code block (e.g. `{code}PROD-9{code}`) renders NO anchor
      for the key (stays literal text).
    - Test D: `OTHER-1` (prefix !== activeJiraProject) renders as plain text, no anchor.
    - Test E (nested-anchor / browse URL, D-05): a description containing a full Jira browse URL for an
      active-project key (e.g. `[PROD-123|{jiraBaseUrl}/browse/PROD-123]`, or the raw browse URL) renders
      EXACTLY ONE anchor for that key — `getAllByRole('link')` filtered to the `PROD-123` label has length 1,
      and that anchor contains NO descendant `<a>` (no nested `<a><a>`).
  </behavior>
  <action>
    In `taskflow/src/routes/dashboard/WikiRenderer.test.tsx`:
    (1) Extend the existing `authStoreState` mock object (~line 24) to include
    `activeJiraProject: 'PROD' as string | null` and `jiraConnected: true` so isKnownPrefix and the
    query `enabled` gate work. The existing `useAuthStore` mock already returns the object for both
    selector and bare calls — no structural change needed beyond adding the fields. Ensure `jiraBaseUrl`
    in the mock has a concrete value (e.g. `'https://jira.example.com'`) so Test E can build a matching
    `browse/PROD-123` URL that tryInternalPath resolves to `/issue/PROD-123`; if the mock's jiraBaseUrl
    changes from null, update the pre-seeded query key's third segment to match (see step 2).
    (2) Add a vitest mock for `@tanstack/react-query`'s `useQuery` OR (preferred) wrap renders in a
    real `QueryClientProvider` and seed the cache. Preferred approach: create a helper
    `renderWiki(node)` that wraps in `<QueryClientProvider client={qc}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>`
    with a fresh QueryClient per test; for Test B, pre-seed via
    `qc.setQueryData(['jira-issue-detail', 'PROD-123', <jiraBaseUrl-from-mock>], { fields: { status: { statusCategory: { key: 'done' } } } })`
    so the strikethrough resolves synchronously (the third key segment MUST equal the mock's jiraBaseUrl).
    Note: the existing top-of-file `render(<WikiRenderer .../>)` calls must still work; add the provider
    wrapper to any NEW issue-key tests (do not rewrite the whole file). Mock `fetchIssueDetail` from
    `@/services/jira` and `useSettingsStore` if not already covered so the queryFn does not hit a real
    network path.
    (3) Add a new `describe('issue-key linkification', ...)` block with Tests A-E above. Use
    `screen.getByText('PROD-123')` / `closest('a')` for anchor assertions, `toHaveClass('line-through')`
    for strikethrough, and assert `queryByText('OTHER-1').closest('a')` is null for the plain case.
    For Test A click, use `fireEvent.click` and assert `navigateMock` was called with `/issue/PROD-123`.
    For Test E: render wiki text containing the browse URL for `PROD-123`, then assert
    `screen.getAllByRole('link').filter(a => a.textContent === 'PROD-123').length === 1` AND that this
    anchor has no nested `<a>` (e.g. `anchor.querySelector('a')` is null). Keep total new test count
    focused (5-7 assertions).
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard/WikiRenderer.test.tsx 2>&1 | tail -25</automated>
  </verify>
  <done>The five behaviour cases (linkify active-prefix, done strikethrough, code-block excluded,
  non-active-prefix plain, browse-URL single-anchor/no-nesting) pass; the pre-existing WikiRenderer
  tests still pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| wiki content → renderer | Untrusted Jira description/comment markup is parsed and rendered |
| renderer → Jira API | issue-detail fetch uses the user's PAT (read via readSecret) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-fnk-01 | Tampering (XSS) | text override emits `<a>` from user text | mitigate | No raw HTML emitted; React escapes the key string; href is a fixed `#issue-KEY` fragment and navigation goes through `navigate('/issue/'+key)` (no openUrl, no arbitrary href). Existing rehype-sanitize path untouched. |
| T-fnk-02 | Information disclosure | issue-detail fetch for keys in arbitrary content | accept | Query is gated by `enabled: !!jiraConnected && !!jiraBaseUrl`; only active-project keys (isKnownPrefix) ever render IssueKeyLink, and the user already has read access to that project. No new endpoint. |
| T-fnk-03 | DoS (render storm) | many keys → many useQuery hooks | accept | Each unique key dedupes to one query; staleTime 30s prevents churn; cached keys cost zero network (RESEARCH Pitfall 1). |
| T-fnk-SC | Tampering | npm/pip/cargo installs | mitigate | No package installs in this plan — all deps (react-markdown, @tanstack/react-query) already present. |
</threat_model>

<verification>
- `cd taskflow && npm run check` (biome + tsc) stays GREEN — project baseline is clean.
- `cd taskflow && npx vitest run src/routes/dashboard/WikiRenderer.test.tsx` — all WikiRenderer
  tests pass, including the five new issue-key behaviour cases.
- Manual/observable (covered by automated tests above):
  - A known-project key (prefix === activeJiraProject) linkifies and navigates to /issue/KEY.
  - A done issue gets `line-through`.
  - A key in a code block is NOT linkified.
  - A non-active-project prefix stays plain text.
  - A full browse/KEY URL renders exactly one anchor for the key with no nested <a>.
</verification>

<success_criteria>
- Bare active-project issue keys in wiki prose render as clickable in-app links (D-02).
- Done issues show strikethrough; unknown/unresolved keys link with no strikethrough (D-01, D-03).
- Keys inside code spans/blocks and keys already inside an existing link are not double-linkified
  (D-04, D-05) — the `a` override single-owns browse/KEY URLs so nesting is structurally impossible.
- Status resolution is cache-first, deduped, async, and non-blocking (D-01).
- `npm run check` GREEN; WikiRenderer test suite GREEN.
</success_criteria>

<output>
Create `.planning/quick/260610-fnk-in-wiki-renderer-when-there-is-a-test-in/260610-fnk-SUMMARY.md` when done.
</output>
</content>
</invoke>
