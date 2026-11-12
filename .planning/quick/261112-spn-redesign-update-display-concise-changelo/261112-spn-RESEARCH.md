# Quick 261112-spn: Redesign update display — Research

**Researched:** 2026-11-12
**Domain:** Release-notes format, markdown parsing, GitHub Releases API, update UI (Tauri/React)
**Confidence:** HIGH (all claims checked against the codebase, the live GitHub API, or official docs, except where tagged)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Note format (new releases)**
- "Headline + titles": one summary sentence first (plain paragraph), then short bullets grouped under `###` headings.
- Bullet = `**Bold title**` optionally followed by ` — ` and ONE short clause (a few words). No multi-sentence descriptions.
- Fixed section collapses many fixes into one or a few short bullets.
- Must remain plain GitHub markdown with `###` headings so OLD clients (ReactMarkdown) and GitHub render it fine.
- Section headings: planner/researcher decide whether to keep Added/Changed/Fixed or move to New/Improved/Fixed — the parser must accept BOTH (old notes use Added/Changed/Fixed; possibly also Removed/Security etc.).

**Full detail**
- Short everywhere: the same short notes go to CHANGELOG.md, tag, GitHub release and in-app. No separate long text.
- Do NOT rewrite existing CHANGELOG.md history.

**Release script + instructions**
- release.sh / bump-version.mjs: update usage examples to new format; add a lint/guard step that warns (or fails, with an override flag) when notes are too wordy (e.g. bullet longer than N chars, missing headline sentence, too many bullets). Must not break `--skip-bump` path.
- Add written release-notes instructions (e.g. `taskflow/docs/RELEASE-NOTES.md` or similar, referenced from the script header) describing the format with an example. Claude writes notes per release.

**Old notes in the app**
- Parse `- **Title** — description` bullets: show titles only by default; click a bullet to reveal its description. Raw-markdown fallback for anything unparsable (whole release body or single bullet).
- A single shared parser + shared notes-body component used by Update modal, What's New modal and Settings history.

**Update available modal ("Compact card")**
- Header: "Update available", version jump `current → new · date`, and "(N releases)" when skipping versions.
- Headline sentence, then grouped titles (NEW / IMPROVED / FIXED-style small caps labels), each bullet expandable (›) for its description; Fixed may collapse to "N fixes ›".
- Skipped-version roll-up: intermediate releases as compact rows below (`1.14.19 — <headline or first title> … ›`), expandable. Intermediate notes come from the GitHub releases API; if unavailable/offline, show only the `latest.json` notes — never block the update.
- Footer: Later / Update now. Downloading progress replaces the footer in place (still non-dismissable); error state keeps Dismiss / Retry.

**What's new modal ("Same body, celebratory header")**
- Same notes body component as the update modal.
- Header: check icon + "Updated to X.Y.Z", subline "from <previous version>" (previous = `lastSeenVersion`).
- Roll-up of skipped versions too (GitHub API, fallback to `lastSeenChangelog`).
- Footer: "See all updates" link → Settings → Updates; primary "Got it". Show/dismiss semantics unchanged.

**Settings → Updates history**
- Load all versions (paginate past the 20 cap), grouped by minor version (1.14.x) with collapsible groups.
- Same parsed, titles-first rendering.
- Claude's discretion for nice UX: search, type filter chips, highlight installed version, expand/collapse.

### Claude's Discretion
- Exact visual styling, filter/search UI, grouping details, lint thresholds, docs location.
- Follow user design memories: page/section header conventions, compact EmptyState for empty/error, no card panels on detail pages, hover affordances w/o layout shift, one row = one line.

### Deferred Ideas (OUT OF SCOPE)
None listed.
</user_constraints>

## Summary

Nothing in CI or in old clients has to change. Every old client renders notes with `ReactMarkdown + remarkGfm`, and the new format (a lead paragraph, then `###` sections with `**bold** — clause` bullets) is ordinary markdown. CHANGELOG versions 1.0 to 1.7 already used a lead sentence, so old clients have shown that shape before. The real work is the new client. It must parse **two different corpora**: the CHANGELOG.md history, and the **GitHub release bodies**, which differ from the CHANGELOG for 1.6.x–1.8.1. Those bodies include headings stripped by an old tag-cleanup bug, raw commit lists, `## Added` at h2, a commit message with a `Co-Authored-By` trailer, a leading blank line, and an empty body.

Recommendation: a pure, line-based TS parser in `src/lib/release-notes/` (no new dependencies), plus one `ReleaseNotesBody` component that renders inline text through ReactMarkdown with `allowedElements` + `unwrapDisallowed`. Also one `useReleaseHistory()` TanStack hook that fetches all releases with `per_page=100` and follows the `Link` header. It sorts with the existing `compare-versions` dependency and serves the Settings page and both modals' roll-ups. Put the notes lint in the same TS folder and import it from `bump-version.mjs` directly. Node v26 on this machine strips types natively (verified). Run the lint before any file is written.

**Primary recommendation:** Build the parser and lint first, in pure TS with tests drawn from the real samples below. Then add the shared hook, then the three UI surfaces. Keep `lastSeenChangelog` / `persistChangelogBeforeRestart` as a raw markdown string, unchanged.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary | Rationale |
|---|---|---|---|
| Notes authoring + lint | Release tooling (`scripts/`, Node) | — | Runs before tag/CHANGELOG write |
| Notes transport | CI (tag body → GH release body + `latest.json.notes`) | — | Unchanged; verified `%(contents:body)` use at workflow lines 251, 394 |
| Markdown → structured notes | Client pure lib (`src/lib/release-notes/`) | — | Shared by 3 surfaces + lint |
| Release list fetch/cache | Client (TanStack Query, global `fetch`) | GitHub REST | CSP is `null`; GitHub sends CORS + exposes `Link` header (verified) |
| Pre-restart persistence | Tauri store (`persistChangelogBeforeRestart`) | — | Keep raw string, unchanged |

## Backwards-compat Matrix

| Consumer | Renders from | New short format OK? | Notes |
|---|---|---|---|
| Old UpdateDialog (≤1.14.20) | `latest.json.notes` via ReactMarkdown | Yes | Lead `<p>` and `<h3>` render as prose; only `[&>h2]` is custom-styled, h3 falls back to `prose-sm` [VERIFIED: UpdateDialog.tsx] |
| Old WhatsNewDialog | `lastSeenChangelog`, written by the **old** client's UpdateDialog before restart | Yes | The **first** What's New in the new client gets a raw string written by the old client. Its type and shape must stay a raw markdown string |
| Old Settings history | `api.github.com/...releases?per_page=20` bodies via ReactMarkdown | Yes | — |
| GitHub release page | Tag body | Yes | Needs `--cleanup=verbatim` (already in both paths). Without it `###` lines are stripped, which is what happened to the v1.7.2 body |
| Tag `%(contents:body)` | Message `vX.Y.Z\n\n<notes>` | Yes | Subject = `vX.Y.Z`. The headline paragraph is part of the body because bump-version inserts `\n\n` [VERIFIED: bump-version.mjs] |
| releases README | Template has no notes | n/a | [VERIFIED: releases-readme.template.md] |

### Variants the NEW parser must handle (verified against CHANGELOG.md, 56 sections, and the live API, 50 releases)

| # | Variant | Real sample |
|---|---|---|
| V1 | `### Added/Changed/Fixed/Removed` + `- **Title** — detail` (dominant) | 1.10–1.14.x |
| V2 | Em dash **inside** the bold title (96 bullets) | `- **Sprint board — time-in-column badge** — each card…` (1.11.0) |
| V3 | Bold title, no separator, sentence continues | `- **Dashboard greeting** now handles …` (1.9.0); `- **react-grid-layout** and **@types/react-grid-layout** dependencies` |
| V4 | Colon inside bold + nested sub-list | `- **Issue detail — redesigned Changes tab:**` followed by `  - **Grouping:** …` (1.14.5, 11 nested lines) |
| V5 | Plain bullets, `Area: text` | `- Worklogs: worklog entry actions …` (1.10.4); `- Backlog: …` |
| V6 | Lead paragraph before sections | `Performance overhaul — every view now feels instant.` (1.0–1.7 CHANGELOG) |
| V7 | Lead paragraph + bullets, **no heading** | 1.7.0 CHANGELOG |
| V8 | `### Fixed` with no blank line before bullets | 1.7.x, 1.10.4 GH body |
| V9 | `## Added` / `## Fixed` (h2) | GH body v1.8.1 |
| V10 | Headings stripped: unheaded bullet groups separated by blank lines | GH body v1.7.2, v1.7.1 |
| V11 | Raw commit subjects, lowercase | GH body v1.7.0, v1.6.2, v1.6.3 |
| V12 | Pure prose + `Co-Authored-By:` trailer | GH body v1.6.0, v1.6.1 |
| V13 | Leading `\n` | GH body v1.9.0 |
| V14 | Empty body | GH v0.1.0 |
| V15 | Version heading in body (test fixtures) | `'## v2.0\n- New feature'` (WhatsNewDialog.test) |
| V16 | Inline code / backticks with braces in titles | `` `{{monospace}}` `` (1.14.6) |

Release tags on GitHub are all `vX.Y.Z` (v0.1.0 to v1.14.20, 50 total, none draft or prerelease). CHANGELOG's `[1.7]`/`[1.6]` milestone headings have no GitHub counterpart. [VERIFIED: live API 2026-11-12]

## Parser Design (pure TS, `src/lib/release-notes/parse.ts`)

```ts
export type NoteKind = 'new' | 'improved' | 'fixed' | 'removed' | 'security' | 'other';
export interface NoteItem { title: string; detail: string | null; children: NoteItem[]; raw: string }
export interface NoteSection { kind: NoteKind; label: string | null; items: NoteItem[] }
export interface ParsedNotes {
  headline: string | null;      // first prose paragraph before any heading/bullet
  sections: NoteSection[];
  extra: string[];              // other prose paragraphs (rendered raw via ReactMarkdown)
  structured: boolean;          // false → UI renders `raw` with ReactMarkdown
  raw: string;
}
export function parseReleaseNotes(md: string | null | undefined): ParsedNotes;
export function summarizeNotes(p: ParsedNotes): string | null; // headline ?? first item title ?? first raw line
```

The algorithm is line-based and does not use an AST, so no dependency is needed:
1. Normalise `\r\n`, trim, and drop lines matching `/^(Co-Authored-By|Signed-off-by):/i` (V12). An empty result gives `structured:false, raw:''`; the UI shows "No release notes" (V14).
2. **Headings** `^#{2,4}\s+(.+)` (V9): if the text looks like a version (`/^\[?v?\d+(\.\d+)+/`), skip it (V15). Otherwise start a section. Map case-insensitively:
   - `added|new|features?` → `new`
   - `changed|improved|improvements?` → `improved`
   - `fixed|fix(es)?|bug ?fixes` → `fixed`
   - `removed|deprecated` → `removed`
   - `security` → `security`
   - anything else → `other` with the label kept as written
3. **Bullets** `^([-*+])\s+(.+)` at indent 0 start an item. Bullets with indent ≥2 become `children` of the last item (V4). Indented non-bullet lines append to the last item's `raw`/`detail`. Bullets with no open section go into an implicit `{kind:'other', label:null}` section (V7, V10, V11). Blank lines do **not** close the section (V10).
4. **Prose** (not a heading, not a bullet): the first paragraph before any heading or bullet becomes `headline` (V6, V13). Later paragraphs go to `extra`.
5. **Title/detail split** per bullet, first match wins:
   - a. `^\*\*(.+?)\*\*\s*[—–:-]\s+(.+)$` → title = bold content, detail = rest (V1, V2: lazy `.+?` stops at the first closing `**`, so an em dash *inside* the bold stays in the title).
   - b. `^\*\*(.+?):\*\*\s*(.*)$` → title without the colon, detail = rest or null (V4).
   - c. `^\*\*(.+?)\*\*$` → title only (new format).
   - d. Fallback: title = the whole text, detail = null (V3, V5, V11). The UI shows it on one line with `truncate` plus a `title` attribute; truncation is acceptable here because the full text is a single clause.
   - Strip a trailing `.` from the title. Keep inline markdown (backticks, nested bold) in `title`/`detail`; the renderer handles it.
6. `structured = sections.some(s => s.items.length > 0)`. Otherwise (pure prose, V12) the UI renders `raw` with ReactMarkdown.

**Required test cases** (copy the real text into fixtures under `src/lib/release-notes/__fixtures__/`). Make fixture text generic per the no-customer-data memory: 1.9.0 contains a `DOE Jane ACME` example, so keep it as a placeholder. Cover: 1.14.20 CHANGELOG (V1), 1.11.0 (V2), 1.9.0 GH body (V3, V13), 1.14.5 (V4), 1.10.4 GH body (V5, V8), 1.7 CHANGELOG (V6), 1.7.0 CHANGELOG (V7), 1.8.1 GH body (V9), 1.7.2 GH body (V10), 1.6.3 GH body (V11), 1.6.0 GH body (V12), `''` (V14), `'## v2.0\n- New feature'` (V15), the approved new-format example from CONTEXT.md, and 1.14.6 (V16). The live bodies are archived in the scratchpad (`rel.json`). Re-fetch with `curl 'https://api.github.com/repos/Mimo01/taskflow-releases/releases?per_page=100'` if needed.

**Section label choice:** Use **`### New` / `### Improved` / `### Fixed`** for new releases, matching the approved example and the modal small-caps labels. The UI displays labels from `kind` (NEW / IMPROVED / FIXED / REMOVED), so old Added/Changed headings display the same way.

## Inline Rendering (ReactMarkdown v10)

Render `title`/`detail` with a tiny wrapper:
```tsx
<ReactMarkdown allowedElements={['strong','em','code','del','a']} unwrapDisallowed components={{ a: ExternalLink }}>{text}</ReactMarkdown>
```
`unwrapDisallowed` replaces the `<p>` wrapper with its children, so the text stays inline [VERIFIED: node_modules/react-markdown@10.1.0 lib/index.d.ts]. v10 has no `components.text` (memory). Do not try to linkify via a text override.
- Links in notes must not navigate the webview. Map `a` to an element that calls `openExternal(url)` (`src/lib/openExternal.ts`). Follow the `MARKDOWN_COMPONENTS` pattern in `src/routes/dashboard/release-detail/ReleaseDescription.tsx`.
- Existing dialog tests mock `react-markdown` to `<span>{children}</span>`. The inline wrapper keeps working under that mock because the raw text is still visible.

## GitHub Releases API Strategy

- `GET /repos/Mimo01/taskflow-releases/releases?per_page=100&page=N`. The max is 100 [CITED: docs.github.com/en/rest/releases/releases#list-releases]. Today there are 50 releases, so one request. The response has a `Link` header with `rel="next"`, and `Access-Control-Expose-Headers` includes `Link` [VERIFIED: live headers]. Loop while `rel="next"` exists, capped at 10 pages.
- Unauthenticated limit is **60/h per IP** (`x-ratelimit-limit: 60`) [VERIFIED: live headers]. Use **one** shared query for all three surfaces. Set `staleTime: 30 min` and `refetchOnWindowFocus: false`; the global `gcTime: Infinity` is already set in main.tsx.
- The docs do not state result order [CITED: same page]. **Sort client-side** with `compareVersions` from `compare-versions@6.1.1` (already a dependency, used in `src/services/versionPolicy.ts`). Guard with `validate()` and drop invalid tags.
- Filter out `draft` (the API hides drafts from unauthenticated callers anyway [CITED]). Show `prerelease` with a badge and exclude it from roll-ups.
- **Query key:** replace `['github-releases']` (used only in `UpdatesSection.tsx:81`) with `['github-releases', 'all']`. The cache is not persisted (no persister found), so there is no migration concern. Put the fetcher and hook in `src/services/releases.ts` + `src/hooks/useReleaseHistory.ts`. Use global `fetch`, as today; CSP is `null`.
- **Roll-up selection:** `releases.filter(r => cmp(r.v, from) > 0 && cmp(r.v, to) < 0)`. The target version's notes always come from the local source (`latest.json` changelog / `lastSeenChangelog`), not from GitHub. Count shown as "(N releases)" = intermediates + 1.
- **Gating:** enable the roll-up query only when the modal is open, `buildInfo.version` has no `-dev`, and `from` is valid semver. If `lastSeenVersion` is null or invalid, show no roll-up and no "from" subline. While loading or on error, render the local notes only; never block or spin the footer.

## Reusable Primitives (paths)

| Need | Use |
|---|---|
| Modal shell | `src/components/ui/dialog.tsx` (`showCloseButton={false}`, size via `className="sm:max-w-lg"`) |
| Expand/collapse | No Collapsible primitive exists. The convention is a `<button aria-expanded>` with local state (`src/routes/dashboard/AioFolderPanel.tsx:76`) |
| Segmented filter / chips | `fieldset` + `aria-pressed` buttons in `src/routes/dashboard/AioCyclesScopeBar.tsx:68-90`. Chip pattern: `src/routes/dashboard/issue-detail/TimelineFilterChips.tsx` |
| Badge ("Installed") | `src/components/ui/badge.tsx` (`secondary`/`outline`) |
| Empty/error | `src/components/ui/empty-state.tsx` (`compact`, `fill`) |
| Search | `src/components/ui/input.tsx` / `input-group.tsx` |
| Skeleton | `src/components/ui/skeleton.tsx` |
| Section header style | Existing in UpdatesSection: `h2 text-lg font-semibold`, `h3 text-sm font-semibold text-muted-foreground uppercase tracking-wide` |
| Version compare | `compare-versions` (`compareVersions`, `validate`) |

**Settings deep-link:** `Settings.tsx` keeps `activeSection` in `useState('connections')` and has no URL support. Add a `?section=updates` search param via `useSearchParams` (react-router-dom 7.13): read it into the initial state and sync on param change, so it works when already on `/settings`. WhatsNewDialog is rendered inside `AppLayout`, a router element (`main.tsx:809, 816`), so `useNavigate` is available. "See all updates" should run `setLastSeenVersion(buildInfo.version)` and then `navigate('/settings?section=updates')`.

## Release Script + Lint

- **Module:** `src/lib/release-notes/lint.ts` (pure TS, erasable syntax only, no `@/` imports, relative imports with `.ts` extensions; `tsconfig.json` has `allowImportingTsExtensions: true`). It reuses `parse.ts`. `bump-version.mjs` imports it with `import { lintReleaseNotes } from '../src/lib/release-notes/lint.ts'`. **Verified:** Node v26.12.1 imports `.ts` from `.mjs` with no flag or warning. Add a tiny CLI `scripts/lint-release-notes.mjs` that reads stdin, so `release.sh` can call it.
- **Placement:**
  - `bump-version.mjs`: run the lint right after reading stdin and **before** the package.json write (currently line ~44). A failure must leave the tree untouched.
  - `release.sh`: run the lint in Phase A (pre-flight) on `$RELEASE_NOTES` when not `--skip-bump`. With `--skip-bump`, lint the `awk`-extracted CHANGELOG section in **warn-only** mode, because that entry is already committed and may be historical. stdin is unused on that path; keep it that way.
- **Override:** `--allow-wordy-notes`. `release.sh` currently swallows all `--*` args (`--*) ;;`), so pass this one through explicitly. `bump-version.mjs` reads the version from `process.argv[2]`, so switch to parsing argv for a non-flag version plus flags.
- **Thresholds** (errors unless overridden):
  - missing headline paragraph
  - headline > 120 chars or more than one sentence
  - bullet title > 50 chars
  - detail > 70 chars, or detail containing `. ` / `;` (multi-sentence)
  - a section with > 6 bullets
  - more than 3 `Fixed` bullets
  - more than 14 bullets total
  - unknown heading → warning only
  - no `###` section → error

  These numbers are judgement calls [ASSUMED], sized so the approved example passes with plenty of room. Add a test asserting the approved example passes and the 1.14.20 entry fails.
- **Docs:** `taskflow/docs/RELEASE-NOTES.md` (`taskflow/docs/` exists, containing `perf/`). Reference it from the `release.sh` and `bump-version.mjs` headers. Update the usage examples (`printf 'One line summary.\n\n### Fixed\n- **Bug**' | …`) in both scripts and in the empty-tag-body error hint (`release.sh:96`).
- **Tests:** vitest's default include picks up `src/lib/release-notes/*.test.ts`. There is no separate script test infrastructure, and none is needed.

## Common Pitfalls

1. **No QueryClient / Router in dialog tests.** `UpdateDialog.test.tsx` and `WhatsNewDialog.test.tsx` render bare. Adding `useQuery`/`useNavigate` throws. Wrap them in `QueryClientProvider` + `MemoryRouter`, or isolate the hook behind a prop or `vi.mock('@/hooks/useReleaseHistory')`.
2. **Accidental network in tests.** UpdateDialog tests do not stub `fetch`. Gate the roll-up query on a non-dev version (tests run as `0.0.0-dev` per vitest `define`).
3. **Test mocks lack `headers`.** `UpdatesSection.test.tsx` mocks fetch as `{ok, json}`. Read the link header as `res.headers?.get?.('link') ?? null`, or update the mocks. Existing assertions also need updating: `'Update Available'` (the new title is "Update available"), `What's New in v`, `getByText('current')`, and `'v1.5.0'` row text.
4. **React Compiler (app only, not vitest).** Do not read stores with `getState()` or module-level mutable values during render; use selectors or props. Parse inside render or `useMemo`; it is pure, so that is fine. Behaviour may differ in the app versus tests (memory: React Compiler vs module reads).
5. **Persistence contract.** `persistChangelogBeforeRestart(changelog)` must keep storing the **raw markdown string**. Do not store parsed JSON or the roll-up. Older/newer clients and the `WhatsNewDialog` open condition (`lastSeenVersion !== buildInfo.version && lastSeenChangelog !== null`) depend on it.
6. **Downloading state.** It is currently non-dismissable via `onOpenChange`, but it has a "Stop Download" button that only calls `resetToIdle` and does not cancel the download (`updaterService` has no cancel). Keep the progress UI in the footer slot. See open question 1.
7. **Tag cleanup.** Any new path that creates tags must keep `--cleanup=verbatim`. Losing it stripped headings in the past (GH v1.7.2).
8. **One row = one line** (memory). Truncate titles in the history and roll-up rows. Hover chevrons sit trailing inside the row button, so there is no layout shift.
9. **Fetch-once page cap** (memory). The current history is capped at `per_page=20`. Follow `Link` until it runs out; don't rely on a single page.
10. **Overlay scroll in Settings.** Long history inside `max-w-2xl overflow-auto`. Use plain flow, not inner fixed-height scrollers. In modals, cap the body (`max-h-[60vh] overflow-y-auto`) so the footer stays visible.

## Security Domain

| ASVS | Applies | Control |
|---|---|---|
| V5 Input validation | yes | Release bodies are remote and untrusted. ReactMarkdown escapes raw HTML by default (no `rehype-raw`); keep it that way. `allowedElements` limits inline output |
| V12/V14 (links) | yes | Route `a` through `openExternal`; never let the webview navigate to arbitrary URLs |
| Others | no | Public unauthenticated API; no secrets (no token in the client) |

## Package Legitimacy Audit

No new packages. `compare-versions@6.1.1` and `react-markdown@10.1.0` are already installed [VERIFIED: node_modules]. The slopcheck audit is not applicable.

## Validation Architecture

| Property | Value |
|---|---|
| Framework | vitest 4 (jsdom), `taskflow/vitest.config.ts` |
| Quick run | `cd taskflow && npx vitest run src/lib/release-notes src/components/update src/routes/settings/UpdatesSection` |
| Full suite | `cd taskflow && npm run test` (also run by the pre-commit hook along with `biome check --staged` + `tsc`) |

| Behaviour | Test type | File |
|---|---|---|
| Parser handles V1–V16 | unit | `src/lib/release-notes/parse.test.ts` (new) |
| Lint passes approved example, fails 1.14.20 | unit | `src/lib/release-notes/lint.test.ts` (new) |
| Pagination via Link, sort, draft filter, roll-up range | unit | `src/services/releases.test.ts` (new) |
| Dialog titles, roll-up fallback, Got it / See all updates | component | existing dialog tests, updated |
| History grouping, search, filters, installed highlight | component | `UpdatesSection.test.tsx`, updated |
| `bump-version.mjs` lint before write | manual | `printf 'x' \| node scripts/bump-version.mjs 9.9.9` exits non-zero with a clean tree |

The pre-commit hook runs the full suite, so commit RED and GREEN together (memory).

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | Lint thresholds (120/50/70/6/3/14) | Too strict → frequent overrides; tune after one release |
| A2 | `New/Improved/Fixed` headings for new notes | Cosmetic; the parser accepts both |
| A3 | The machine running release.sh has Node ≥22.18 (type stripping) | Lint import fails. Currently v26 [VERIFIED locally] |

## Open Questions

1. **"Stop Download" button.** It doesn't cancel the download. Should it stay in the redesigned downloading footer? Recommendation: drop it, so the modal is truly non-dismissable per the decision. Confirm with the user at UAT.
2. **Prerelease in roll-ups.** There are none today. Recommendation: exclude them.

## Sources

- Codebase, read 2026-11-12: UpdateDialog/WhatsNewDialog (+ tests), UpdatesSection (+ test), update.store, updater.ts, tauri-storage.ts, Settings.tsx, main.tsx, release.sh, bump-version.mjs, release-cross-platform.yml, CHANGELOG.md (all 56 sections)
- Live: `https://api.github.com/repos/Mimo01/taskflow-releases/releases?per_page=100` (headers + 50 bodies)
- [CITED] https://docs.github.com/en/rest/releases/releases#list-releases (per_page max 100, draft visibility, no order guarantee)
- [VERIFIED] node_modules/react-markdown@10.1.0 types (`allowedElements`, `unwrapDisallowed`); compare-versions@6.1.1 exports (`compareVersions`, `validate`); Node v26 `.ts` import from `.mjs`

**Valid until:** 2026-12-12
