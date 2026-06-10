# Quick Task 260610-fnk: Issue-key linking in wiki renderer - Research

**Researched:** 2026-06-10
**Domain:** React-markdown rendering pipeline, TanStack Query cache reuse
**Confidence:** HIGH (all findings grounded in read source files)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Status data source:** Fetch on demand. Cache-first — check React Query cache before any
  request; only fetch statuses for keys not already cached. Deduplicate keys within a document.
  Resolution is async and must NOT block initial render (link renders immediately, strikethrough
  may appear a beat later).
- **Which keys to linkify:** Known prefixes only. Only linkify keys whose project prefix is among
  the loaded/known Jira projects. Use canonical pattern `[A-Z][A-Z0-9_]+-\d+`, then filter by
  known prefix. Avoids false positives (`COVID-19`, `UTF-8`, `ISO-8601`).
- **Unknown/unresolved keys:** Clickable link, no strikethrough. Always render a working link to
  `/issue/KEY` for known-prefix keys; apply strikethrough only when status category is positively
  `done`.

### Claude's Discretion
- Exact integration point (preprocessing regex vs. react-markdown override) — cleanest hook that
  does not break existing URL/mention linkification.
- Where the project-prefix list comes from — reuse existing source, do not add a new fetch path
  if one exists.
- How statuses are fetched on demand — prefer reusing existing issue-detail query/cache key.
- Must NOT linkify inside code spans/blocks.
</user_constraints>

## Summary

The wiki pipeline is `preprocessJiraMarkup` → `j2m.to_markdown` → `fixMarkdownLinkUnderscores` →
`<Markdown>` with `remarkGfm`/`remarkBreaks` + `rehypeRaw`/`rehypeSanitize` + custom component
overrides (`WikiRenderer.tsx:985-1156`). The clean, low-risk integration point is a **custom
`text` component override** in `markdownComponents` that splits plain-text strings on the issue-key
pattern and emits an internal-link element for known-prefix matches. This automatically skips
`<code>`/`<pre>` content (react-markdown passes code text through `code`/`pre`, not `text`) and
never sees the inside of existing links (their label text is the `<a>` child, but matching there is
harmless and easy to suppress).

The status/strikethrough is driven by a **small per-key child component** that calls the existing
`useQuery(['jira-issue-detail', key, jiraBaseUrl])` hook — the same key PeekPanel/IssueDetailView
use, so cache hits are instant and fetches are deduped app-wide. Read `data.fields.status.statusCategory`
and feed it to the existing `isDoneStatus()` / `doneSummaryClass()` helpers.

The one real gap: **there is no persisted app-wide list of known project prefixes.** `listJiraProjects`
exists but is only called transiently in settings/onboarding; the only persisted project state is the
single `activeJiraProject` string in `auth.store`. This needs a decision (see Open Questions).

**Primary recommendation:** Add a `text` component override in `markdownComponents` that tokenizes on
`[A-Z][A-Z0-9_]+-\d+`, filters by known prefix, and renders each match via a small
`<IssueKeyLink issueKey=...>` component that owns its own `useQuery` for status. Reuse `tryInternalPath`'s
navigation pattern (breadcrumbPush + navigate). Do NOT touch `preprocessJiraMarkup` or the serialize path.

## Integration Point Analysis (Discretion Decision)

### Recommended: (b) react-markdown `text` component override — HIGH confidence

react-markdown (v9, used here) supports overriding the synthetic `text` node via `components.text`.
This is the cleanest hook for three reasons grounded in the actual file:

1. **Code is automatically excluded.** Inline code renders through a `code` component and fenced
   blocks through `pre`>`code`; their text content is NOT delivered to the `text` override. So a
   `text` override satisfies the "no linkify inside code spans/blocks" decision with zero extra work.
   (Verified: WikiRenderer has no `code`/`pre` override, so react-markdown's defaults render them and
   their inner string never reaches a `text` override.) `[VERIFIED: WikiRenderer.tsx:988-1143 — no code/pre override]`

2. **Existing link/mention linkification is untouched.** URLs and `[display|url]` links are already
   turned into `<a>`/`<mention>` elements upstream by jira2md + preprocessing. A `text` override only
   receives the residual prose text nodes — it does not re-parse `<a>` hrefs. The bare-key matcher
   runs only on prose, exactly where we want it. `[VERIFIED: pipeline in WikiRenderer.tsx:985-986]`

3. **No serialize-path risk.** The Source/round-trip path uses `jiraToTiptap` / `jiraWikiSerializer`
   on the raw wiki string, NOT the rendered React tree. A `text` component override changes only the
   rendered output, never the stored markup, so the round-trip is provably unaffected.
   `[VERIFIED: grep — jiraWikiSerializer not imported in WikiRenderer.tsx]`

**Implementation sketch** (inside `markdownComponents`, alongside the existing overrides):
```tsx
text: ({ children }: { children?: React.ReactNode }) => {
  if (typeof children !== 'string') return <>{children}</>;
  // Split on the canonical key pattern; render known-prefix matches as <IssueKeyLink>.
  const parts = children.split(/(\b[A-Z][A-Z0-9_]+-\d+\b)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^[A-Z][A-Z0-9_]+-\d+$/.test(part) && isKnownPrefix(part)
          ? <IssueKeyLink key={i} issueKey={part} />
          : part,
      )}
    </>
  );
},
```
Note: returning a fragment from `text` is supported by react-markdown v9. The `key` index is stable
because the split output for a given text node is deterministic.

### Rejected alternatives

| Option | Why rejected |
|--------|--------------|
| (a) regex pass in `preprocessJiraMarkup` | Would have to emit raw `<a>` HTML, which then needs `data-*` allowlisting in `wikiSanitizeSchema`, AND it cannot read React Query cache or render a live status component (strikethrough needs a hook). Also risks matching keys inside code fences and inside already-formed `[display\|url]` brackets — exactly the false-positive class the preprocessing layer is full of workarounds for. |
| (c) remark plugin | Heaviest option: must walk mdast, skip `code`/`inlineCode`/`link` node types manually, and still cannot host a `useQuery` per key (remark runs at transform time, not render time). The `text`-override approach gets code-skipping for free and lives at render time where hooks are legal. |

**Gotcha (documented):** react-markdown delivers text as plain strings inside many element types
(paragraph, list item, table cell, heading, blockquote, `<strong>`, `<em>`). The `text` override fires
in ALL of them — which is what we want (a key in a heading should still link). The only place it must
NOT fire is code, and that is handled by react-markdown not routing code text through `text`.

## Known-Project-Prefix Source (Discretion Decision)

**Finding (HIGH confidence): There is no persisted, app-wide list of known Jira project prefixes.**

- `listJiraProjects(baseUrl, token)` exists (`src/services/jira.ts:107` / `src/services/jira/projects.ts:65`)
  and returns `JiraProject[]` (`{ id, key, name }`). `[VERIFIED: src/services/jira.ts:107-130]`
- It is called only in **settings** (`TokenSection.tsx:161`, `ConnectionsSection.tsx:131`) and
  **onboarding** (`JiraStep.tsx:75`) — each into local component state, never into a Zustand store or a
  shared react-query cache. `[VERIFIED: grep listJiraProjects — no store/cache writes]`
- The only persisted project state is a single string: `auth.store.activeJiraProject`
  (`src/stores/auth.store.ts:21,41,84,125`). There is no `['jira-projects']` query key anywhere.
  `[VERIFIED: grep 'jira-projects' — only a test file matches]`

**Recommendation:** This is the only genuine design decision in the task. Two viable paths:

1. **Minimal (recommended for a quick task):** Treat the single `activeJiraProject` prefix as the
   known set. `useAuthStore(s => s.activeJiraProject)` is already read in WikiRenderer (line 981-982).
   Only keys whose prefix `=== activeJiraProject` linkify. Pro: zero new fetch, fully aligns with
   "reuse existing source, do not add a new fetch path." Con: cross-project keys in a description
   won't link.

2. **Fuller:** Add a cached `useQuery(['jira-projects', jiraBaseUrl], listJiraProjects)` and build a
   `Set` of `.key` values. Shares one fetch app-wide, links all known projects. Con: introduces a new
   fetch path (mildly against the discretion hint, but it is cached/shared, not per-render).

Flag for the planner — see Open Questions Q1. Either way, implement an `isKnownPrefix(key)` helper so
the decision is isolated to one function.

## On-Demand Status Resolution (Locked Decision)

**Existing hook to reuse — HIGH confidence.** The canonical issue-detail query is:
```tsx
useQuery({
  queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl],
  queryFn: async () => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token || !jiraBaseUrl) throw new Error('No credentials');
    return fetchIssueDetail(jiraBaseUrl, token, issueKey, { /* 5 custom field keys */ });
  },
  staleTime: 30_000,
  enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected,
})
```
This is copied verbatim from `PeekPanel.tsx:77-92` (which itself mirrors `IssueDetailView`). Because the
key is identical, a `<IssueKeyLink>` using it gets **instant cache hits** when the issue is already open/
peeked, and **deduped fetches** when several links reference the same uncached key. `[VERIFIED: PeekPanel.tsx:77-92]`

**Status path → strikethrough:** `data.fields.status.statusCategory` has shape
`{ key: 'new' | 'indeterminate' | 'done' }` (`src/services/jira/types.ts:33`). Feed it directly:
```tsx
const doneClass = doneSummaryClass(data?.fields?.status?.statusCategory); // '' until resolved, 'line-through' when done
```
`isDoneStatus` / `doneSummaryClass` already encode `key === 'done'` (`issueDisplayUtils.ts:14,24`).
`[VERIFIED: issueDisplayUtils.ts:14-26, jira/types.ts:30-34]`

**Recommended per-key component** (deduplication + non-blocking + cache-first all fall out naturally):
```tsx
function IssueKeyLink({ issueKey }: { issueKey: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbPush = useBreadcrumbStore((s) => s.push);
  const { jiraBaseUrl, jiraConnected } = useAuthStore();
  const { /* 5 field keys */ } = useSettingsStore();
  const { data } = useQuery({ /* exact key above */ });
  const doneClass = doneSummaryClass(data?.fields?.status?.statusCategory);
  return (
    <a
      href={`#issue-${issueKey}`}      // href for a11y; click is intercepted
      className={cn('text-primary hover:underline', doneClass)}
      onClick={(e) => {
        e.preventDefault();
        breadcrumbPush(deriveSourceCrumb(location.pathname));
        navigate(`/issue/${issueKey}`);
      }}
    >
      {issueKey}
    </a>
  );
}
```
- **Cache-first / dedup:** TanStack Query dedupes by key automatically — N links to the same key share
  one in-flight fetch and one cache entry. `staleTime: 30_000` means an already-cached issue triggers no
  network call (CONTEXT "check cache before issuing any request" is satisfied by the shared cache + staleTime).
- **Non-blocking:** the `<a>` renders immediately; `data` is `undefined` on first paint so `doneClass`
  is `''`; strikethrough appears on the re-render after the query resolves. Matches the locked decision.
- **`findJiraIssueInCache` note:** CONTEXT mentions it, but it lives only in `RecentItemsPopover.tsx:37`
  and returns summary-shaped data (the gh-backlog branch is `isPartial` with no status). Prefer the
  `useQuery` approach over importing that helper — `useQuery` reads the same cache and also fetches misses.

## Common Pitfalls

### Pitfall 1: Re-render storm / waterfall from many keys
**What goes wrong:** A description with dozens of keys mounts dozens of `useQuery` hooks.
**Why it's fine here:** Each unique key is one query; duplicates dedupe. `staleTime: 30_000` prevents
refetch churn. Cached keys cost zero network. There is no waterfall — all queries fire in parallel on mount,
not sequentially. If you want to cap concurrency, that's an optional enhancement, not required.
**Avoid:** Don't create one query per *occurrence* — `split` may yield the same key twice in one text node;
that's still fine (same key dedupes), but don't build an effect that fetches in a loop.

### Pitfall 2: Strikethrough flash / layout shift
**What goes wrong:** Link renders, then a beat later gains `line-through`.
**Mitigation:** `line-through` does not change element box size, so there is no layout shift — only a
visual style change. This is the explicitly accepted behavior per the locked decision. No spinner needed.

### Pitfall 3: Matching keys inside existing links / URLs
**What goes wrong:** A URL like `.../browse/PROD-123` already became an `<a>`; its visible label might be
`PROD-123`, and the `text` override would wrap that label in a nested `<a>` (invalid HTML).
**Mitigation:** react-markdown calls the `text` override for the *children* of the `a` element too. Guard
against nesting by NOT rendering an `IssueKeyLink` when already inside an anchor. Simplest robust approach:
the existing `a` override can strip/skip key-linkification of its own string children, OR keep the bare-key
matcher but render a `<span class="line-through">` (not `<a>`) when the ancestor is already a link. Given the
existing `a` override already routes Jira browse URLs internally, double-linking is cosmetic-but-invalid;
test with a description containing a full `browse/KEY` URL.

### Pitfall 4: Breaking breadcrumb-push navigation
**What goes wrong:** Using `<a href="/issue/KEY">` without `preventDefault` would do a full Tauri navigation
and skip `breadcrumbPush`.
**Mitigation:** Mirror the existing `a` override exactly: `e.preventDefault()` →
`breadcrumbPush(deriveSourceCrumb(location.pathname))` → `navigate('/issue/' + key)`
(`WikiRenderer.tsx:1125-1133`). `deriveSourceCrumb` is module-private but in the same file, so an inline
`IssueKeyLink` component (defined in WikiRenderer.tsx) can call it directly.

### Pitfall 5: Round-trip / serialize corruption
**What goes wrong (does NOT happen here):** Adding links could corrupt the Source toggle.
**Verified safe:** The render path (this change) is independent of `jiraToTiptap`/`jiraWikiSerializer`,
which operate on raw wiki text. WikiRenderer does not import the serializer. No corruption possible.
`[VERIFIED: grep — no serializer import in WikiRenderer.tsx]`

### Pitfall 6: Pattern over-matching across word boundaries
**Mitigation:** Use `\b` anchors (`\b[A-Z][A-Z0-9_]+-\d+\b`) so `aPROD-1` or `PROD-1x` don't match.
The known-prefix filter is the primary false-positive guard (per CONTEXT).

## Don't Hand-Roll

| Problem | Don't build | Use instead |
|---------|-------------|-------------|
| Issue status fetch + cache + dedup | A custom fetch/cache map | `useQuery(['jira-issue-detail', key, jiraBaseUrl])` (PeekPanel pattern) |
| Done detection | `status === 'Done'` string check | `isDoneStatus` / `doneSummaryClass` (issueDisplayUtils.ts) |
| Internal navigation + breadcrumb | New navigation logic | Copy the `a`-override handler (WikiRenderer.tsx:1125-1133) |
| Skipping code blocks | Manual mdast walk | react-markdown `text` override (code text never routed there) |

## Files To Touch

- **`taskflow/src/routes/dashboard/WikiRenderer.tsx`** — add `IssueKeyLink` component + `text` entry in
  `markdownComponents`; add `isKnownPrefix` helper; import `useQuery`, `readSecret`, `fetchIssueDetail`,
  `useSettingsStore`, `isDoneStatus`/`doneSummaryClass`, `useAuthStore` (jiraConnected). Reuse existing
  `useNavigate`, `useLocation`, `breadcrumbPush`, `deriveSourceCrumb`, `cn`.
- (If fuller prefix path chosen) a cached `['jira-projects', jiraBaseUrl]` query — location TBD by planner.

## Open Questions

1. **Known-prefix source (BLOCKING decision, low effort either way).**
   - What we know: no persisted project list exists; only `activeJiraProject` (single key) is persisted;
     `listJiraProjects` exists but is settings/onboarding-only.
   - Recommendation: For a quick task, use `activeJiraProject` as the known set (zero new fetch). If
     multi-project linking is desired, add a cached `['jira-projects', jiraBaseUrl]` query. Isolate behind
     `isKnownPrefix()` so the choice is one function.

2. **Nested-anchor guard.** Confirm desired behavior when a full `browse/KEY` URL already renders as a
   link — skip re-linkification (recommended) vs. allow a non-anchor strikethrough span. Low risk; pick
   skip-if-inside-anchor.

## Sources

### Primary (HIGH confidence) — read in-session
- `taskflow/src/routes/dashboard/WikiRenderer.tsx` — full pipeline, `a` override, components map
- `taskflow/src/components/app/PeekPanel.tsx:77-92` — canonical issue-detail useQuery pattern
- `taskflow/src/lib/issueDisplayUtils.ts:14-26` — isDoneStatus / doneSummaryClass
- `taskflow/src/lib/internalLinks.ts` — canonical key pattern, navigation mapping
- `taskflow/src/services/jira/types.ts:30-34` — status.statusCategory shape
- `taskflow/src/services/jira.ts:107-130, 1446-1457` — listJiraProjects, fetchIssueDetail
- `taskflow/src/stores/auth.store.ts:21-141` — activeJiraProject is the only persisted project state
- `taskflow/src/components/app/RecentItemsPopover.tsx:37-87` — findJiraIssueInCache (summary-only)

## Metadata
- Standard stack: HIGH — react-markdown v9 component overrides, TanStack Query, all in-repo
- Architecture: HIGH — reuses three existing patterns verbatim
- Pitfalls: HIGH — grounded in the file's own existing workarounds
- One MEDIUM-confidence gap: known-prefix source requires a one-line product decision (Q1)
- Research date: 2026-06-10 / Valid until: ~30 days (stable internal code)
