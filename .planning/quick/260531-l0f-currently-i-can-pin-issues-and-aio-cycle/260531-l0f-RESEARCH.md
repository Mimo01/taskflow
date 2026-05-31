# Quick Task 260531-l0f: Pin releases - Research

**Researched:** 2026-05-31
**Domain:** In-repo pinned-tab pattern extension (Zustand store + React Router nav + lucide icons)
**Confidence:** HIGH (entire task mirrors an existing, fully-read in-repo pattern)

## Summary

Pinning releases is a 1:1 copy of the existing **cycle-pinning** pattern. Cycles use a `pinnedCycleMeta` map in `pinned-tabs.store.ts`, are split out of `pinnedKeys` in `main.tsx` via `key.includes('-CY-')`, are rendered as a `CycleTab` variant in `PinnedTabStrip.tsx`, and navigate via `onTabClick`. Releases need the parallel structures: a `pinnedReleaseMeta` map, a `REL-` key prefix, a third branch everywhere the current code does a binary issue-vs-cycle split, a `ReleaseTab` union member, and a Pin button in the Release detail header.

The one genuine design decision (confirmed by CONTEXT.md as Claude's discretion) is the **key scheme**. Releases are keyed by a bare numeric `versionId` (e.g. `12345`) with no `-`. The current discriminator `!key.includes('-CY-')` treats *everything non-cycle as an issue*, so a bare numeric release key would be misrouted to the issue summary fetch (`useQueries`) and to `/issue/:key` navigation. Use a **`REL-{versionId}`** prefix as the pinned key; strip it to recover `versionId` for navigation to `/release/:versionId`. `REL-` does not collide with Jira issue keys (which are `PROJECT-NUMBER`, where PROJECT is alphabetic but a real Jira project would not be named exactly `REL` in this app's data — acceptable risk, and the three-way split checks cycle and release *before* falling through to issue, so ambiguity favors correct routing for our synthetic keys).

**Primary recommendation:** Add `pinnedReleaseMeta: Record<string, {name; versionId; projectKey}>`, `setPinnedReleaseMeta`, `clearReleaseMeta` to the store (bump persist `version` 1→2 + migration). Use `REL-{versionId}` keys. Convert all binary issue/cycle splits in `main.tsx` and the union in `PinnedTabStrip.tsx` to three-way. Add a Pin button to `ReleaseDetailPage.tsx` header. Swap three icons to `Rocket`. Update affected tests.

## Project Constraints

- **Lint/test gate:** `npm run check` = biome + tsc, must be fully GREEN (per repo memory `project_biome_state.md`). `biome lint` ≠ `check`.
- No `CLAUDE.md` exists at repo root (confirmed — file not found).
- Tests run under vitest. Affected test files asserting on current behavior must be updated in the same change (see Pitfalls).

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use lucide **`Rocket`** for pinned-release tabs in the strip.
- Unify the release icon to `Rocket` in THREE sites: sidebar `releases` item (`iconName: 'Tag'`→`'Rocket'`), `ReleasesTab` header (`icon={Package}`→`Rocket`), `ReleaseDetailPage` header (`<Package />` next to `v{id}`→`Rocket`).
- Do NOT touch the `<Tag />` used for the "Labels" section in `ReleaseDetailPage` (that is a labels icon).
- Pinned releases persist globally across active-project switches (Zustand persisted store), like issues/cycles.
- Store release display metadata (name + versionId + projectKey) in a `pinnedReleaseMeta` map mirroring `pinnedCycleMeta`.
- Pin/Unpin control lives in the Release detail page **header actions (top-right)**, matching issue/cycle detail pages.

### Claude's Discretion
- Key format / collision avoidance — recommended `REL-{versionId}` (see Summary + Pitfall 1).
- Whether to store `projectKey` in `pinnedReleaseMeta` — **YES, store it** (see section 3: navigation does not strictly need it today, but it mirrors cycle meta and future-proofs project-scoped nav; cheap to include).

### Deferred Ideas (OUT OF SCOPE)
None.

## Phase Requirements

Quick task — no formal REQ IDs. Functional requirements from CONTEXT decisions:
1. Pin/Unpin release from Release detail header.
2. Pinned-release tab in strip with `Rocket` icon + release name.
3. Global persistence (survives project switch + app restart).
4. Click-through navigates back to `/release/:versionId`.
5. Icon unification to `Rocket` in 3 sites.

## The Cycle-Pinning Data Flow (copy 1:1 for releases)

### Store — `src/stores/pinned-tabs.store.ts`
- `pinnedCycleMeta: Record<string, { name: string; projectKey: string }>` (line 7).
- `setPinnedCycleMeta(key, meta)` (lines 12, 39-40) — spreads new entry into map.
- `clearCycleMeta(key)` (lines 13, 41-46) — deletes entry.
- Persist config: `version: 1` (line 51) with `migrate` (lines 52-58) that sets `pinnedCycleMeta = {}` when `version < 1`.
- **For releases:** add `pinnedReleaseMeta: Record<string, { name: string; versionId: string; projectKey: string }>`, `setPinnedReleaseMeta`, `clearReleaseMeta`. **Bump `version: 1`→`2`** and extend `migrate` to set `pinnedReleaseMeta = {}` when `version < 2` (see Pitfall 1).

### main.tsx — `src/main.tsx`
- **Store reads** (lines 142-147): `pinnedKeys`, `removePin`, `reorder`, `pinnedCycleMeta`. Add `pinnedReleaseMeta` read here.
- **Binary split** (lines 166-167): `issuePinnedKeys = pinnedKeys.filter((k) => !k.includes('-CY-'))` and `cyclePinnedKeys = pinnedKeys.filter((k) => k.includes('-CY-'))`. **This is the misrouting bug** — release keys would fall into `issuePinnedKeys` and get sent to `fetchIssueSummary`. Convert to three-way:
  - `releasePinnedKeys = pinnedKeys.filter((k) => k.startsWith('REL-'))`
  - `cyclePinnedKeys = pinnedKeys.filter((k) => k.includes('-CY-'))`
  - `issuePinnedKeys = pinnedKeys.filter((k) => !k.startsWith('REL-') && !k.includes('-CY-'))`
- **Union type aliases** (lines 188-189): local `IssueTab` / `CycleTab`. Add `ReleaseTab = { type: 'release'; name: string; versionId: string; projectKey: string }`.
- **resolvedPinnedTabs Map** (line 192): typed `Map<string, IssueTab | CycleTab>`. Widen to include `ReleaseTab`.
- **Cycle resolution loop** (lines 207-216): reads `pinnedCycleMeta[key]`. Add parallel loop for `releasePinnedKeys` reading `pinnedReleaseMeta[key]` → push `{ type: 'release', ... }`.
- **activeKey for highlight**: `activeIssueKey` (lines 300-302, parses `/issue/`), `activeCycleKey` (lines 305-307, parses `/aio-cycle/.../[3]`). Add `activeReleaseKey`: when `location.pathname.startsWith('/release/')`, key = `'REL-' + pathname.replace('/release/','')`. Then strip `activeKey={activeIssueKey ?? activeCycleKey ?? activeReleaseKey}` (line 515).
- **onTabClick** (lines 516-523): currently binary — `if (key.includes('-CY-'))` navigate cycle `else` `handleIssueClick`. Convert to three-way, checking `REL-` first:
  ```ts
  if (key.startsWith('REL-')) {
    const meta = pinnedReleaseMeta[key];
    navigate(`/release/${meta?.versionId ?? key.slice(4)}`);
  } else if (key.includes('-CY-')) { /* existing cycle nav */ }
  else { handleIssueClick(key, true); }
  ```
  Note `key.slice(4)` strips `REL-` to recover the numeric versionId (fallback if meta missing).

### PinnedTabStrip.tsx — `src/components/app/PinnedTabStrip.tsx`
- **Union** (lines 35-37): `type IssueTab`, `type CycleTab`, `type ResolvedTab = IssueTab | CycleTab`. Add `type ReleaseTab = { type: 'release'; name: string; versionId: string; projectKey: string }` and widen `ResolvedTab`.
- **Ghost render** (lines 147-172) and **tab render** (lines 247-276): both have the same `resolved?.type === 'cycle' ? ... : resolved?.type === 'issue' ? ... : <Loader2/>` chain. Add a `resolved?.type === 'release'` branch in BOTH (the strip and the drag-ghost) rendering `<Rocket className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />` + the same two-line key/name layout used for cycles (font-mono key + truncated `resolved.name`).
- **Import:** add `Rocket` to the lucide import (line 13).

### Cycle Pin button reference — `src/routes/dashboard/AioCycleDetailPage.tsx`
- Store hooks (lines 427-431): `pinned` (`pinnedKeys.includes(cycleKey)`), `togglePin`, `removePin`, `setPinnedCycleMeta`, `clearCycleMeta`.
- Button JSX (lines 799-817): `<Button variant="outline" size="sm" className="gap-1.5 text-xs">` with `aria-label`/`title` toggling Pin/Unpin, `onClick` doing `if (pinned) { removePin; clearCycleMeta } else { togglePin; setPinnedCycleMeta(key, {name, projectKey}) }`, `<Pin className={size-3.5 + pinned?'fill-current text-primary'}/>`.
- Issue Pin button reference (`IssueDetailContent.tsx` lines 322-333) is the same shape minus meta.

## Release Key Scheme & Three-Way Split Sites (file:line)

**Recommended key:** `REL-{versionId}` (e.g. `REL-12345`). Recover versionId via `key.slice(4)` or from `pinnedReleaseMeta[key].versionId`.

Every place doing the binary issue/cycle split that must become three-way:

| File | Line(s) | Current | Change |
|------|---------|---------|--------|
| `src/main.tsx` | 166-167 | `issuePinnedKeys`/`cyclePinnedKeys` filter | add `releasePinnedKeys`; exclude `REL-` from issues |
| `src/main.tsx` | 188-189 | `IssueTab`/`CycleTab` aliases | add `ReleaseTab` |
| `src/main.tsx` | 192 | `Map<string, IssueTab \| CycleTab>` | widen with `ReleaseTab` |
| `src/main.tsx` | 207-216 | cycle resolution loop | add release resolution loop |
| `src/main.tsx` | 300-307 | `activeIssueKey`/`activeCycleKey` | add `activeReleaseKey` (from `/release/`) |
| `src/main.tsx` | 515 | `activeKey={activeIssueKey ?? activeCycleKey}` | `?? activeReleaseKey` |
| `src/main.tsx` | 516-523 | binary `onTabClick` | three-way, `REL-` first |
| `src/components/app/PinnedTabStrip.tsx` | 35-37 | `ResolvedTab` union | add `ReleaseTab` |
| `src/components/app/PinnedTabStrip.tsx` | 147-172 | ghost render branch chain | add `release` branch |
| `src/components/app/PinnedTabStrip.tsx` | 247-276 | tab render branch chain | add `release` branch |

## Release Navigation + Display Metadata

- Route is `/release/:versionId` (confirmed `main.tsx:295`, `ReleaseDetailPage` uses `useParams<{ versionId }>` at line 123). Navigation needs only `versionId` — `projectKey` is NOT required for nav (the page fetches via `activeJiraProject` from auth store, not from the URL).
- **Where the detail page gets name/id/projectKey for the Pin action:**
  - `versionId` — from `useParams()` (line 123).
  - `version` object (has `.name`, `.id`) — `fixVersions?.find((v) => v.id === versionId)` (line 176). `JiraFixVersion` = `{ id, name, releaseDate?, released, description? }` (types.ts:68-74) — **no projectKey field**.
  - `projectKey` — use `activeJiraProject` from `useAuthStore()` (already destructured at line 131 as `activeJiraProject`). Store this as the meta `projectKey`.
- **Pin button placement:** ReleaseDetailPage currently has NO top-right header action bar. The "Header" block is `ReleaseDetailPage.tsx:447-453` (the `v{version.id}` + name block). CONTEXT says place Pin in "header actions (top-right)". There is an existing right-aligned action row `Open in Jira` at lines 754-765 (`<div className="flex justify-end gap-2">`). Cleanest placement matching cycle/issue style: add the Pin `<Button>` to that existing `flex justify-end gap-2` row (lines 755-765) alongside "Open in Jira", OR add it next to the header. Recommend the action row (lines 754-765) since it already mirrors the issue page's `flex justify-end gap-2` Pin row pattern. Planner to confirm exact spot; both are acceptable per "header actions".
  - Pin onClick: `if (pinned) { removePin('REL-'+versionId); clearReleaseMeta('REL-'+versionId) } else { togglePin('REL-'+versionId); setPinnedReleaseMeta('REL-'+versionId, { name: version.name, versionId, projectKey: activeJiraProject ?? '' }) }`.
  - `pinned = usePinnedTabsStore((s) => s.pinnedKeys.includes('REL-' + versionId))`.

## Icon Unification (3 swap sites)

`Rocket` is a **valid lucide-react export** (VERIFIED: `node -e "'Rocket' in require('lucide-react')"` → true).

| Site | File:line | Current | Change |
|------|-----------|---------|--------|
| Sidebar nav item | `sidebar-items.ts:70` | `iconName: 'Tag'` | `iconName: 'Rocket'` |
| Sidebar ICON_MAP | `Sidebar.tsx:46-57` | map has `Tag` (line 57), imported line 24 | add `Rocket` to import + `ICON_MAP` |
| Releases list header | `ReleasesTab.tsx:16` import, `:315` `icon={Package}` | `Package` | import `Rocket`, `icon={Rocket}` |
| Release detail header | `ReleaseDetailPage.tsx:22` import, `:449` `<Package className="size-4..."/>` | `Package` | import `Rocket`, `<Rocket .../>` |

**DO NOT CHANGE:** `ReleaseDetailPage.tsx:487` `<Tag className="size-3.5" />` (Labels section). Leave `Tag` import in place (still used at 487). `Package` import (line 22) becomes unused in ReleaseDetailPage after swap — remove it (biome will flag unused import → `npm run check` fails). Same for `Package` in `ReleasesTab.tsx:16` if no other usage (verify: only used at line 315 per grep → remove import).

## Common Pitfalls

### Pitfall 1: Persistence migration (MUST bump version)
**What goes wrong:** Adding `pinnedReleaseMeta` to state without bumping the persist `version` means hydrated stores from existing users won't have the field initialized → `undefined`, and `pinnedReleaseMeta[key]` reads throw / resolution silently fails.
**How to avoid:** Bump `version: 1`→`2` (line 51) and extend `migrate` (lines 52-58): add `if (version < 2) { s.pinnedReleaseMeta = {}; }`. Also default `pinnedReleaseMeta: {}` in the store initializer (line 19-20 area). Mirror exactly how `pinnedCycleMeta` was done for v1.

### Pitfall 2: REL- key reaching the issue fetch
**What goes wrong:** If the `issuePinnedKeys` filter (main.tsx:166) is not updated to exclude `REL-`, release keys hit `fetchIssueSummary(... 'REL-12345')` → failed Jira API call, broken/loader tab forever.
**How to avoid:** Update the filter to `!k.startsWith('REL-') && !k.includes('-CY-')`. Order matters in `onTabClick` too — check `REL-` before the `-CY-` branch.

### Pitfall 3: Tests asserting current behavior
Files that WILL need updates (all run under `npm run check`/vitest):
- `src/stores/pinned-tabs.store.test.ts` — tests `version: 1` migration logic (lines 126-147) by replicating `if (version < 1)`. After bumping to v2, add a test for the `pinnedReleaseMeta = {}` migration and `setPinnedReleaseMeta`/`clearReleaseMeta` (mirror lines 77-121). Existing v1 cycle tests stay valid.
- `src/components/app/PinnedTabStrip.test.tsx` — mocks lucide icons (line 8 mocks `FlaskConical`). Add a `Rocket` mock (e.g. `Rocket: () => <span data-testid="rocket-icon" />`) and a `release tab rendering` describe block mirroring the cycle block (lines 48-99). Without the mock, the new `Rocket` reference in the component may render the real SVG (usually fine) but a test asserting the icon needs the mock.
- `src/routes/dashboard/ReleasesTab.test.tsx` — does NOT currently assert on the `Package` icon (grep found no icon assertion; only `fetchProjectTags` mocks). Likely safe, but run it.
- Sidebar tests (`Sidebar.test.tsx`, `sidebar-items.test.ts`) — no assertion on the `'Tag'` iconName found (grep clean). Likely safe; run to confirm.
**How to avoid:** Run `npm run check` and the vitest suite after changes; update assertions that reference old icons/binary split.

### Pitfall 4: Unused import after icon swap
Removing `Package` usage leaves a dangling import → biome `noUnusedImports` → `npm run check` red. Remove `Package` from imports in both `ReleasesTab.tsx` and `ReleaseDetailPage.tsx`. Keep `Tag` in `ReleaseDetailPage.tsx` (still used at line 487).

## Don't Hand-Roll
- Tab rendering, drag-reorder, context menu — all already in `PinnedTabStrip`. Only add a union branch.
- Persistence — Zustand `persist` + `createTauriStorage` already wired. Only add the meta map + migration.

## Environment Availability
No external dependencies. Code-only change using existing libraries (zustand, lucide-react, react-router-dom). `lucide-react` `Rocket` export verified present.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `REL-` prefix won't collide with a real Jira project key named `REL` | Key Scheme | LOW — three-way split checks REL-/CY- before issue fallback; a `REL-123` issue key would route to release, but no such project exists in this app's data |
| A2 | Pin button best placed in the existing `flex justify-end gap-2` action row (ReleaseDetailPage:754-765) | Navigation+Display | LOW — CONTEXT says "header actions (top-right)"; planner may instead place in the `:447` header block. Both satisfy the requirement |
| A3 | `ReleasesTab.test.tsx` and Sidebar tests don't assert on current icons | Pitfall 3 | LOW — grep found no icon assertions; verified by running suite |

## Sources

### Primary (HIGH confidence)
- Direct read of all 9 target files (store, PinnedTabStrip, main.tsx, ReleaseDetailPage, AioCycleDetailPage, IssueDetailContent, ReleasesTab, sidebar-items, jira/types.ts).
- `node -e "'Rocket' in require('lucide-react')"` → Rocket export confirmed present.
- grep of test files for icon/split/migration assertions.
- Repo memory `project_biome_state.md` (lint/test gate = `npm run check`).

## Metadata
**Confidence breakdown:**
- Pattern to copy: HIGH — read in full, identical to cycle pinning.
- Three-way split sites: HIGH — every site enumerated with file:line.
- Icon swap: HIGH — sites confirmed, Rocket export verified.
- Test impact: MEDIUM — store + PinnedTabStrip tests confirmed needing updates; Sidebar/ReleasesTab likely safe but must be run.

**Research date:** 2026-05-31
**Valid until:** stable in-repo pattern — valid until these files are refactored.
