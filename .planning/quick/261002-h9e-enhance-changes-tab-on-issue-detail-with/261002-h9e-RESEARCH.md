# Quick Task 261002-h9e: Side-by-side changelog diffs - Research

**Researched:** 2026-10-02
**Domain:** React rendering of Jira Server/DC changelog items, word diffing
**Confidence:** HIGH for codebase integration, MEDIUM for Jira item shapes (from training knowledge plus the repo's own fixtures)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Long text** (Description, Summary, Environment, other long or multi-line custom text): side-by-side word diff with "Before | After" columns. Removed words are red in Before, added words are green in After. Collapsed by default behind a "Show changes (+N / −M words)" toggle, with a one-line preview while collapsed. Columns stack at narrow widths. A field counts as long text if its name is on an allowlist (description, summary, environment) OR a length/newline heuristic matches.
- **Short single-value fields** (Status, Priority, Assignee, Story Points, a single Sprint, etc.): Old → New chips. The old value is muted and struck through, then an arrow, then the new value. Status uses `statusPillClass` pills, which need a flex parent. An empty side shows as ∅.
- **Multi-value fields** (Labels, Components, Fix Version(s), Version, Sprint lists): show added tokens (+, green) and removed tokens (−, red). Fix Version and Component send one item per value. Labels and Sprint send full lists, so diff the two token sets.
- **Burst grouping**: consecutive change histories by the same author within about 5 minutes, with no other entry type between them, merge into one block (one author header and timestamp, all items listed). This must be a pure, unit-tested function.
- **Field icons + aligned layout**: each row has a fixed-width label column (lucide icon + field name), then the value. Short and multi-value rows stay on one line.

### Claude's Discretion
- Diff algorithm or library (prefer `diff` diffWords, or a tiny LCS), icon mapping, colour tokens (existing tokens only; colour means status/semantic only), thresholds.

### Deferred Ideas (OUT OF SCOPE)
- Filter by field.
</user_constraints>

## Summary

The `diff` package (jsdiff) is **not** a direct dependency. It is already in `package-lock.json` at 8.0.3, but only as a dev-only transitive dependency of shadcn, ts-morph and typescript, so production code cannot rely on it. Add `diff@^9.0.0` (latest, released 2026-04-13) as a runtime dependency. It is ESM, ships its own TypeScript types (no `@types/diff` needed since v8), and the word-diff code path (`libesm/diff/word.js` + `base.js`) is about 27 KB raw, roughly 6 KB min+gz once tree-shaken. That is a fair price for correct whitespace and punctuation tokenisation plus the built-in `maxEditLength`/`timeout` safety valves. A hand-written LCS would have to re-implement both of those.

`mergeTimeline` returns entries **newest-first**, sorted by timestamp across all three entry types. `ActivityTimeline` reverses that list for 'oldest' order and only then calls `filterTimeline`. Burst grouping therefore has to run on the **unfiltered** merged list, before `filterTimeline`. Otherwise, under the Changes filter, two edits with a comment between them would merge, which breaks the "no other entry between" rule. Adjacency works the same in either direction, so grouping before or after the reverse is fine.

**Primary recommendation:** create a pure module `issue-detail/changelogDiff.ts` with `classifyField`, `tokenSetDiff`, `wordDiff` (wrapping jsdiff `diffWords` with `maxEditLength` and a fallback) and `groupChangeBursts`, plus a co-located `.test.ts` (the same pattern as `aggregateTimeTracking.ts`). Import it directly, **not** through `@/services/jira`.

## Standard Stack

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `diff` (jsdiff, github.com/kpdecker/jsdiff) | 9.0.0 | `diffWords(old, new, { maxEditLength })` → `Change[]` with `added`/`removed`/`value` | [VERIFIED: npm view — 9.0.0, ESM exports, 171M downloads/wk, no postinstall]. v9 only changes diffJson and patch code; diffWords behaves as in v8 [CITED: github.com/kpdecker/jsdiff release-notes.md] |
| `lucide-react` | ^0.577.0 (present) | Field icons | Already used (`GitCommit` in ChangelogEntry) |

**Install:** `cd taskflow && npm install diff@^9.0.0`

### Package Legitimacy Audit
| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| diff | npm | 13+ yrs | 171M/wk | github.com/kpdecker/jsdiff | unavailable | Approved [ASSUMED], already in lockfile transitively, low risk |

slopcheck could not be installed. The package is long-established and already resolved in the lockfile.

## Jira Server/DC changelog item shapes → classification

The repo has no real description, labels or sprint fixtures. Every existing fixture is `status`, `assignee` or `Epic Link` (`ActivityTimeline.test.tsx:121`, `jira-changelog.test.ts:31`, `notifications.test.ts`, `jira.test.ts:2084`). The shapes below are [ASSUMED] from training knowledge.

| `field` (exact case) | Shape | Class |
|---|---|---|
| `status` | from/to = status ids, *String = names | short, status pill |
| `priority`, `resolution`, `issuetype` | ids + names | short |
| `assignee`, `reporter` | from/to = usernames, *String = display names | short (∅ when null) |
| `Story Points` (custom), `duedate` | numeric or date strings | short |
| `timeestimate`, `timeoriginalestimate`, `timespent` | **seconds as strings** ("3600") | short. Format as duration; reuse the existing formatter if WorklogEntry/aggregateTimeTracking has one |
| `summary` | full text | long (allowlist) |
| `description`, `environment` | full **wiki markup**, from/to null | long |
| `labels` | fromString/toString = **space-separated full lists** | multi, token-set diff on `/\s+/` |
| `Sprint` | from = "12, 13" ids, *String = **comma-separated names** | multi when either side has `,`, otherwise short |
| `Fix Version`, `Version`, `Component` | **one item per value**; added → fromString null, removed → toString null | multi. Merge all same-field items in a group into one row of +/− tokens |
| `Attachment` | added → toString = filename; removed → fromString = filename | multi (+file / −file) |
| `Link` | toString like "This issue blocks PROJ-1" | multi (+/−) |
| `Epic Link`, `Parent`, `Flagged` | key or "Impediment" | short |
| `Rank` | toString "Ranked higher/lower" | noise. Render as short; don't hide it (hiding would change the chip counts) |
| `WorklogId`, `Workflow` | ids | short fallback |

Classifier order: (1) exact field-name map; (2) any value containing `\n` or longer than ~120 chars → long; (3) any value containing `, ` together with a known multi-field name → multi; (4) otherwise short. Compare field names case-insensitively (`Fix Version` vs `fixVersions` naming varies).

## Integration Points (verified in codebase)

- **`statusPillClass(categoryKey)`** lives in `src/lib/statusStyles.ts:91`. It is a full geometry class, so add no padding/rounded/text classes. It needs a **category key**, but changelog items carry only status ids and names. For the lookup, use `useJiraStatusList(enabled)` from `issue-detail/useEpicProgressQueries.ts:63` (key `['jira-statuses']`, cached for the whole session and shared with greenhopper). Build `Map<id, statusCategory.key>` keyed by `item.from`/`item.to`, falling back to name. If the lookup misses, pass undefined, which gives the gray pill (same graceful degradation as `jira.ts:983`). Wrap each pill in a flex `<span className="inline-flex …">`.
- **Colour tokens:** the theme has no `success`/diff token. Use `CHIP_TONE_CLASS.green` / `.red` from `statusStyles.ts` (bg-*-500/15 + text-*-600 / dark:*-400). These are semantic added/removed colours, which fits the colour = semantic rule. Old value: `text-muted-foreground line-through`.
- **Density:** use the custom variants `density-compact:` and `density-comfortable:` (`src/index.css:10-11`), following the existing `py-1.5 density-compact:py-1 density-comfortable:py-2.5`.
- **`relativeTime`** is imported from `'../IssueDetailContent'` (line 156). Keep the `title={toLocaleString()}` tooltip.
- **Icons (suggested):** status `CircleDot`, priority `ArrowUpDown`, assignee/reporter `User`, labels `Tag`, Sprint `Repeat`, Fix Version/Version `Milestone`, Component `Boxes`, description/summary/environment `FileText`/`Type`, Story Points `Hash`, time fields `Clock`, Attachment `Paperclip`, Link `Link2`, Rank `ListOrdered`, fallback `Pencil`. Check each export exists in lucide 0.577 at build time.

## Architecture Patterns

```
mergeTimeline (newest-first, all types)
  → [reverse if 'oldest']
  → groupChangeBursts(entries)   // runs on the UNFILTERED list
  → filter by type
  → render: comment | worklog | change-group → ChangelogEntry(group)
       per item: classifyField → LongTextDiff | ShortChange | MultiValueChange
```

- `groupChangeBursts(entries, windowMs = 5*60_000)` returns a display type of its own, e.g. `Exclude<TimelineEntry,{type:'change'}> | { type:'change'; timestamp; data: ChangelogHistory[] }`. Keep `TimelineEntry` and `countByType` unchanged, because the chip counts should still count histories. Same author means `author.name ?? author.displayName`. Chain on the gap between **adjacent** histories (≤ window). Filter inline (`filter==='all' || e.type===filter`) or make `filterTimeline` generic.
- Inside a group, merge per-value items (Fix Version/Component/Attachment/Link) into one row per field. When the same short field changed twice in a burst (A→B, then B→C), show the first `from` → last `to`. If they are equal, still show the row (simplest and honest).
- Long-text component: `useState(collapsed)`. Compute the diff with `useMemo` **only when expanded**. Compute the `+N/−M` word counts cheaply when collapsed (the diff can run once on expand; count words in `added`/`removed` parts). For the preview line, use the first changed span, or the first ~80 chars of the new value, `truncate` + `pr-0.5`. Layout: `grid grid-cols-1 sm:grid-cols-2 gap-2`, with each column `whitespace-pre-wrap break-words`. Before renders `removed` + unchanged parts, After renders `added` + unchanged parts.

## Common Pitfalls

1. **The ActivityTimeline.test mock breaks a new export.** `vi.mock('@/services/jira', …)` provides only `mergeTimeline`, `filterTimeline` and `countByType`. If `groupChangeBursts` is exported from `jira-changelog.ts` (re-exported by `jira.ts:34`), it is undefined in that test and the component crashes. Put it in `issue-detail/changelogDiff.ts`, or update the mock. Also, that test's mocked entries have **no `timestamp`**, so grouping must tolerate NaN dates (treat them as not groupable).
2. **Duplicate React keys.** The current key is `${history.id}-${item.field}`. Two `Fix Version` items in one history collide. Use the index or a merged-row key.
3. **Huge descriptions.** Word diff is O(N·D). Pass `{ maxEditLength: ~2000 }`. jsdiff returns `undefined` when the limit is exceeded, so fall back to "whole Before | whole After" with no highlights. Also skip the diff while collapsed (pitfall 4).
4. **Diffing in render for every entry.** Never diff collapsed long-text items. Memoise on `(fromString, toString)`.
5. **Wiki markup.** Render both columns as plain text (`whitespace-pre-wrap`), never through WikiRenderer, because a word diff splits markup tokens like `{code}` and `[link|url]`. jsdiff's default tokenizer keeps punctuation as separate tokens, so a diff never splits a token mid-word.
6. **Whitespace-only and CRLF changes.** Before diffing, normalise `\r\n` → `\n`. If `old.trim().replace(/\s+/g,' ') === new.…` matches, show "Whitespace / formatting only" with no toggle. jsdiff v8+ `diffWords` treats whitespace as attached to its words and does not report pure whitespace edits as word changes. Use the computed counts, and when +0/−0 show the whitespace-only label.
7. **Italic or strikethrough text clipped by `truncate`.** Add `pr-0.5` (memory).
8. **One row = one line.** Short and multi-value rows use `flex items-center gap-2 min-w-0`, a `flex-none w-28` label column, and `truncate` on long token lists. Don't wrap onto a second line.
9. **Tailwind v4 `space-y` vs `-my-*`:** avoid negative margins inside the `space-y-3` `<ol>`.
10. **Pre-commit runs the full vitest suite.** Put RED and GREEN in one commit.

## Tests that will need updating

- `ActivityTimeline.test.tsx`: only asserts skeleton/heading, not sentence text. It will break only through pitfall 1 (the mock). Add a `groupChangeBursts` mock or move the import.
- `IssueDetailPage.progressive.test.tsx`: mocks `@/services/jira/changelog` and asserts query invalidation, not text. Probably unaffected [VERIFIED: grep]. If the page now calls `useJiraStatusList`, make sure the test's QueryClient or `readSecret` mocks tolerate an extra query.
- No existing test asserts the "changed X from … to …" sentence [VERIFIED: grep for `changed `/`ChangelogEntry` in *.test.tsx].
- New: `changelogDiff.test.ts` (classify table, tokenSetDiff for labels/sprint/per-value items, wordDiff counts plus the maxEditLength fallback, whitespace-only, groupChangeBursts: same author ≤5 min merges, a comment between them splits, a different author splits, >5 min splits, NaN timestamp is safe). Optionally `ChangelogEntry.test.tsx` (∅ rendering, status pill inside a flex parent, collapsed toggle label `+N / −M`).

## Validation Architecture

| Property | Value |
|---|---|
| Framework | vitest (existing) |
| Quick run | `cd taskflow && npx vitest run src/routes/dashboard/issue-detail/` |
| Full suite | `cd taskflow && npx vitest run` (also runs in the pre-commit hook) + `npx tsc --noEmit` + biome |

## Security Domain

Changelog strings are user content. Render them only as React text nodes (no `dangerouslySetInnerHTML`, no WikiRenderer) to avoid XSS (ASVS V5). Nothing else applies.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | Per-field Jira DC item shapes in the table above (labels space-separated, Sprint comma-separated, per-value Fix Version/Component, time fields in seconds) | Wrong classification → fallback short rendering. Test against a real issue with `?expand=changelog` |
| A2 | The jsdiff 9 `diffWords` + `maxEditLength` API matches the installed 8.0.3 types (`libesm/types.d.ts` has `maxEditLength`, `timeout`, `intlSegmenter`) | Low. Release notes list no diffWords changes |
| A3 | Suggested lucide icon names exist in 0.577 | Build-time error, then pick an alternative |

## Sources
- Codebase: `ChangelogEntry.tsx`, `ActivityTimeline.tsx(+test)`, `services/jira-changelog.ts`, `lib/statusStyles.ts`, `useEpicProgressQueries.ts`, `services/jira.ts:983,2850`, `services/notifications.ts:180-232`, `index.css:10-11`, `package-lock.json` (diff 8.0.3 dev transitive)
- npm registry: `diff` 9.0.0 metadata and downloads
- https://github.com/kpdecker/jsdiff/blob/master/release-notes.md (v8/v9 changes)

**Valid until:** 2026-11-01
