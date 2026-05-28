# Quick Task 260528-20i: Fix Biome Lint Problems - Research

**Researched:** 2026-05-28
**Domain:** Biome 2.4.8 lint/style/format — TypeScript/React/Tauri project
**Confidence:** HIGH (all findings verified against live biome output and test runs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Target auto-fixable rules first (`biome check --write`)
- noNonNullAssertion: add null guards (`?.`, `if (foo)`) where intent is obvious and safe; NO biome-ignore suppression; skip assertions requiring deep domain knowledge
- useNamingConvention: rename to camelCase where clearly wrong; `// biome-ignore lint/style/useNamingConvention: intentional` for intentional cases; do NOT rename everything strictly

### Claude's Discretion
- noArrayIndexKey (20): use judgment on stable unique identifiers
- useExhaustiveDependencies (18): fix only where missing dep is clearly safe to add
- Other small rule groups (useTemplate, useNodejsImportProtocol, useLiteralKeys, useImportType, noCommaOperator): fix all

### Deferred Ideas (OUT OF SCOPE)
- a11y rules (noLabelWithoutControl, useSemanticElements, useKeyWithClickEvents, useButtonType, noStaticElementInteractions, noSvgWithoutTitle, useAriaPropsSupportedByRole): not in scope
</user_constraints>

---

## Summary

The project has 1,084 total biome diagnostics (53 errors, 1,031 warnings, 9 infos) across 418 files. The bulk is useNamingConvention (650) and noNonNullAssertion (293). Critically: **`biome check --write` auto-fixes almost nothing from these two dominant categories** — useNamingConvention is labeled "safe fix" but produces NO automatic rename in practice (verified via live test). The executor must manually edit every named violation.

The real auto-fix yield from `npm run fix` (`biome check --write ./src`) covers: 37 format errors + 16 organizeImports issues + 1 useImportType = ~54 diagnostics eliminated with zero manual effort. Everything else is manual.

**Primary recommendation:** Run `npm run fix` first to clear format/imports noise, then work through the violation categories in order: small rules (6+3+3+1+1=14 diagnostics), then noNonNullAssertion (293, batch by file), then useNamingConvention (650, batch by category).

---

## Issue Inventory (Verified Against Live Output)

| Category | Count | Severity | Auto-fix via `--write`? | Manual strategy |
|----------|-------|----------|------------------------|-----------------|
| lint/style/useNamingConvention | 650 | warn | **No** (labeled safe but no rename applied) | See Section A |
| lint/style/noNonNullAssertion | 293 | warn | No (unsafe) | See Section B |
| format | 37 | error | **Yes** | `npm run fix` |
| lint/correctness/useExhaustiveDependencies | 18 | warn | No (unsafe) | See Section C |
| assist/source/organizeImports | 16 | error | **Yes** | `npm run fix` |
| lint/suspicious/noArrayIndexKey | 15 | warn | No (no fix) | See Section D |
| lint/a11y/* (all categories) | 57 | warn | No | Out of scope |
| lint/style/useTemplate | 6 | info | No (`--unsafe` only) | See Section E |
| suppressions/unused | 4 | warn | No | See Section F |
| lint/complexity/useLiteralKeys | 3 | info | No (`--unsafe` only) | See Section E |
| lint/style/useNodejsImportProtocol | 3 | info | No (`--unsafe` only) | See Section E |
| lint/style/useImportType | 1 | warn | **Yes** | `npm run fix` |
| lint/complexity/noCommaOperator | 1 | warn | No (no fix) | See Section E |

**Auto-fix total (npm run fix):** ~54 diagnostics
**Manual work total:** ~990 diagnostics

---

## Section A: useNamingConvention (650 warnings)

### What biome actually flags

Three distinct sub-messages:
- **"This object property name should be in camelCase."** — 549 occurrences, almost all in test files and service files
- **"This property name should be in camelCase."** — 100 occurrences, TypeScript interface/type properties
- **"This variable name should be in camelCase or PascalCase or CONSTANT_CASE."** — 1 occurrence (`src/services/stronghold.ts:25`)

### The two root causes

**Root cause 1: Snake_case REST API type definitions (100 "property name" warnings)**

Files like `src/services/gitlab.ts` (58 violations), `src/services/aio/types.ts` (5), `src/services/jira.ts` (2), etc. define TypeScript interfaces that mirror API response shapes:
```ts
// These are INTENTIONAL — they mirror GitLab/Jira REST API JSON keys
export interface GitLabGroup {
  full_path: string;        // biome warns here
}
export interface GitLabMR {
  avatar_url: string;       // biome warns here
  web_url: string;          // biome warns here
  project_id: number;       // biome warns here
}
```
Renaming these would require cascading changes in every file that accesses `.full_path`, `.avatar_url`, etc. — AND rename breaks the destructuring from API responses. **These must be suppressed, not renamed.**

Suppression comment format:
```ts
export interface GitLabGroup {
  // biome-ignore lint/style/useNamingConvention: mirrors GitLab REST API response shape
  full_path: string;
}
```

**Root cause 2: PascalCase object shorthand in mock/lookup maps (549 "object property name" warnings)**

Two patterns:
```ts
// Pattern A: Component icon lookup map (Sidebar.tsx, etc.)
const ICON_MAP: Record<string, ComponentType<...>> = {
  LayoutDashboard,   // shorthand for LayoutDashboard: LayoutDashboard
  ClipboardList,
  KanbanSquare,
  // ...
};
// These keys ARE used as string lookups: ICON_MAP[nav.iconName]
// Renaming to layoutDashboard: LayoutDashboard BREAKS the string key lookup

// Pattern B: Test mocks with PascalCase names (vi.mock return values)
vi.mock('@/services/stronghold', () => ({
  LazyStore: vi.fn(),  // This is the class name, intentional PascalCase
}));
```

For mock objects returning PascalCase class/component names, add suppression per property:
```ts
vi.mock('@/services/stronghold', () => ({
  // biome-ignore lint/style/useNamingConvention: PascalCase class name required by mock contract
  LazyStore: vi.fn(),
}));
```

For ICON_MAP-style lookup objects, suppress per entry OR add a biome.json override (see below).

### biome.json override to add (reduces volume significantly)

The config already allows variables in camelCase/PascalCase/CONSTANT_CASE. Add a convention for object-like contexts if you want to allow all three at the object level too — but note the config does NOT cover `objectLiteralMember` or `classMember` selectors, only `variable` and `function`. The current config triggers on literal object properties.

If the team decides to allow `CONSTANT_CASE` for object members (like `ICON_MAP` entries), add:
```json
{
  "selector": { "kind": "objectLiteralMember" },
  "formats": ["camelCase", "PascalCase", "CONSTANT_CASE"]
}
```
[ASSUMED] — Biome 2.x selector syntax for `objectLiteralMember`. Verify against biome.json schema before committing.

### High-volume files to target first

| File | Count | Pattern |
|------|-------|---------|
| `src/services/gitlab.test.ts` | 87 | mock objects + type-property snake_case |
| `src/services/jira.ts` | 42 | snake_case in type annotations + mock objects |
| `src/services/gitlab.ts` | 58 (property) | REST API interface properties |
| `src/services/linkEngine.test.ts` | 23 | mock objects |
| `src/routes/dashboard/AioCycleDetailPage.test.tsx` | 22 | mock objects |

### The 1 variable name violation
`src/services/stronghold.ts:25` — check if it's a local variable with an underscore or other non-standard casing. Straightforward rename.

---

## Section B: noNonNullAssertion (293 warnings)

### Distribution

- **Test files:** 62 occurrences — in test assertions like `expect(row!.subtasks...)`, `const buttons = dropdown!.querySelectorAll(...)`. These are typically post-`querySelector` assertions where the test already verifies presence.
- **Source files:** 231 occurrences — split into two patterns:

### Pattern 1: React Query `queryFn` with `enabled` guard (safe → use `?.`)

This is the most common source pattern, especially in large page components:
```ts
// BEFORE (biome warns on each !)
useQuery({
  queryFn: () => fetchSprintData(jiraBaseUrl!, jiraToken!, activeJiraProject!),
  enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
});

// AFTER: optional chaining is safe because queryFn only runs when enabled=true
// BUT: these function parameters don't accept undefined — ?? '' fallback needed
useQuery({
  queryFn: () => fetchSprintData(jiraBaseUrl ?? '', jiraToken ?? '', activeJiraProject ?? ''),
  enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
});
```

**Important:** Do not use `?.` here — `fetchSprintData(jiraBaseUrl?.replace(...))` returns `string | undefined` which likely violates the function signature. Use `?? ''` or `?? 0` null-coalescing instead.

The pattern `jiraBaseUrl!.replace(/\/$/, '')` in queryFn is safe to convert to `(jiraBaseUrl ?? '').replace(/\/$/, '')`.

### Pattern 2: Post-filter chain assertions (safe → keep `!` or use type guard)

```ts
// BEFORE
.filter((d) => !d.isLoading && d.issue)
.map((d) => d.issue!.fields.status?.name)

// AFTER OPTION A: add explicit type guard in filter
.filter((d): d is typeof d & { issue: NonNullable<typeof d.issue> } => !d.isLoading && !!d.issue)
.map((d) => d.issue.fields.status?.name)

// AFTER OPTION B: biome-ignore (user SAID no suppression — so Option A or restructure)
// AFTER OPTION C: simplify with ?.
.filter((d) => !d.isLoading && d.issue)
.map((d) => d.issue?.fields.status?.name)
// Note: changes return type from string|undefined to string|null|undefined — check callers
```

The user said to prefer `?.` where safe. For post-filter chains, `?.` changes the type but is functionally correct.

### Pattern 3: Test assertions (safe to keep or convert)

```ts
// BEFORE
expect(row!.subtasks.map((s) => s.key)).toContain('ESHOP-10-S1');

// AFTER (using non-null assertion in tests is conventional; safest change is null-guard)
expect(row?.subtasks.map((s) => s.key)).toContain('ESHOP-10-S1');
// OR add assertion:
if (!row) throw new Error('row should exist');
expect(row.subtasks.map((s) => s.key)).toContain('ESHOP-10-S1');
```

Since `noExplicitAny: off` is already set for test files (biome.json override), and no override exists for `noNonNullAssertion`, test files must be cleaned like production files.

### High-volume files to target

| File | Count |
|------|-------|
| `src/routes/dashboard/AioCycleDetailPage.tsx` | 34 |
| `src/routes/dashboard/SprintBoardTab.tsx` | 26 |
| `src/routes/dashboard/BacklogPage.tsx` | 21 |
| `src/routes/dashboard/AioProjectOverviewPage.tsx` | 20 |
| `src/routes/worklogs/WorklogsPage.tsx` | 20 |

### Assertions to skip (domain knowledge required)

- Any `!` inside a complex data transformation pipeline where the null check semantics interact with multiple business logic conditions
- `cycleKey!`, `projectKey!` passed to multiple functions in the same block where the enabled guard is several screens away

---

## Section C: useExhaustiveDependencies (18 warnings)

All 18 are in specific files. Categorized by fix safety:

### Safe to fix — add missing dep

| File:Line | Issue | Safe fix |
|-----------|-------|---------|
| `hooks/useMentionUserMap.ts:22` | missing `wikiTexts`, missing `initialMap`, extra `textsFingerprint` | Restructure: derive fingerprint inside the effect instead of as a separate dep |
| `hooks/useResizable.ts:69` | missing `direction` | Add `direction` to deps array — it's a parameter that should re-run the effect |
| `routes/dashboard/DiscussionThreads.tsx:76` | missing `linkCtx`, over-specific `linkCtx.activeGitlabProjectPath` | Replace `linkCtx.activeGitlabProjectPath` with `linkCtx` |
| `routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx:96` | missing `dispatch` | Add `dispatch` — from useReducer, stable reference |
| `routes/dashboard/create-edit-issue/useCreateEditForm.ts:189` | missing `initialValues`, over-specific `initialValues?.summary` | Replace `initialValues?.summary` with `initialValues` |

### Caution — understand before fixing

| File:Line | Issue | Note |
|-----------|-------|------|
| `components/ui/cached-avatar.tsx:54` | extra `url` | If `url` is intentionally excluded (e.g. only triggers on mount), removing it changes behavior |
| `routes/dashboard/AioProjectOverviewPage.tsx:364` | extra `projectKey` | Verify: does re-running this effect on projectKey change cause a problem? |
| `routes/dashboard/BacklogPage.tsx:552` | `applyFilters` changes on every re-render | `applyFilters` is likely a non-memoized function — fix by wrapping in `useCallback` or moving the logic inside the effect |
| `routes/dashboard/MentionPopover.tsx:34` | extra `debouncedQuery` | Debounced values as deps can cause the original query to be missed; intentional pattern |
| `routes/dashboard/SprintBoardTab.tsx:192` | `stickyHeaderInnerRef.current` and `.style` (×2 each) | Refs don't trigger re-renders; using `.current` as a dep is always a false positive — `biome-ignore` is correct here |

### SprintBoardTab ref pattern — use biome-ignore

```ts
useEffect(() => {
  // ... uses stickyHeaderInnerRef.current
// biome-ignore lint/correctness/useExhaustiveDependencies: ref.current is intentionally not a dep
}, [/* other deps */]);
```

### SprintBoardTab localIssues.length extra dep

```ts
// Line 728: extra dep `localIssues.length`
// If the effect uses localIssues.length but not the array contents, .length is correct
// Check: does it use localIssues items? If yes, change to localIssues. If only .length, it's correct and biome-ignore applies.
```

---

## Section D: noArrayIndexKey (15 warnings)

**Biome has no auto-fix for this rule.**

### Safe to suppress (static/no-reorder lists)

These lists don't change order and items have no meaningful identity:

| File | Context | Verdict |
|------|---------|---------|
| `components/app/KeyboardShortcutsPanel.tsx:123` | Keyboard shortcut key chips (`{keys.map((k, i) => <Keycap key={i}>}`) | Safe suppress — static content, no reorder |
| `components/app/StepIndicator.tsx:26` | Wizard step circles (`steps.map((_, index) => <div key={index}>`) | Safe suppress — static step count |
| `routes/dashboard/AioCyclesSkeleton.tsx:16` | Skeleton loader rows | Safe suppress — skeleton has no identity |
| `routes/dashboard/index.tsx:77` | Background SVG path curves (`AMBIENT_CURVES.map((c, i) => <path key={i}>`) | Safe suppress — static constant array |
| `routes/dashboard/issue-detail/ChangelogEntry.tsx:41` | Changelog field diff entries | Check if entries have IDs |

### Need unique keys (dynamic/reorderable lists)

| File | Context | Fix |
|------|---------|-----|
| `routes/dashboard/AioProjectOverviewPage.tsx:467` | Dynamic list — check if items have keys | Use item.key or item.id |
| `routes/dashboard/DiscussionThreads.tsx:255` | Discussion threads | Use thread.id or similar |
| `routes/dashboard/MergeRequestListPage.tsx:279` | MR list | Use mr.iid |
| `routes/dashboard/issue-detail/AioTestRunsSection.tsx:299` | Test runs | Use testRun.id or testRun.key |
| `routes/notifications/NotificationRow.tsx:297` | Notifications | Use notification.id |

**Suppression format for JSX key attribute (critical placement note):**

The `biome-ignore` comment must be on the line IMMEDIATELY before the line containing the `key={i}` attribute — not before the opening JSX tag. If the opening tag and key are on different lines:

```tsx
// WRONG: comment suppresses the opening tag line, not the key={i} line
// biome-ignore lint/suspicious/noArrayIndexKey: static render
<Keycap
  key={i}   // violation is HERE (line +1 from opening tag, +2 from comment)
>

// CORRECT: comment must immediately precede the line with key={i}
<Keycap
  // biome-ignore lint/suspicious/noArrayIndexKey: static render
  key={i}
>
```

This is also the fix for the 4 `suppressions/unused` violations in `IssueActivityGroup.tsx` — the existing comments are one line too early relative to the `key={i}` attribute line.

---

## Section E: Small Rule Groups (14 total)

All except `noCommaOperator` have auto-fixes available via `--write --unsafe` (useTemplate, useLiteralKeys, useNodejsImportProtocol) or `--write` (useImportType). However, the user's `npm run fix` script runs `biome check --write` (not `--unsafe`), so only `useImportType` gets auto-fixed.

### useTemplate (6 — info level)
`biome check --write --unsafe ./src` would auto-fix these. They are string concatenations like `'/path/' + id` → `` `/path/${id}` ``. Files: `useIsActiveRoute.ts`, `internalLinks.ts`, `WikiRenderer.tsx` (×2), `useNodejsImportProtocol.ts` (×3). Low risk — but `--unsafe` flag touches ALL unsafe-fixable rules, so run separately and review diff.

**Manual fix pattern:**
```ts
// BEFORE
return '/route/' + projectKey + '/detail';
// AFTER
return `/route/${projectKey}/detail`;
```

### useLiteralKeys (3 — info level)
In `AioProjectOverviewPage.test.tsx:278,321`. Computed property `obj['key']` → `obj.key`.
```ts
// BEFORE
result['status']
// AFTER
result.status
```

### useNodejsImportProtocol (3 — info level)
`import path from 'path'` → `import path from 'node:path'`. Safe rename. 3 files to check.

### useImportType (1 — warning)
`src/routes/onboarding/IntegrationsStep.test.tsx:7` — `import { QueryClient, QueryClientProvider }` where both are only used as types. Auto-fixed by `npm run fix`:
```ts
// AFTER (biome --write will produce this)
import { type QueryClient, type QueryClientProvider } from '@tanstack/react-query';
```

### noCommaOperator (1 — no fix available)
`src/routes/dashboard/BacklogPage.tsx` — a comma operator like `(a, b)` as an expression. Manual fix: split into separate statements.

---

## Section F: suppressions/unused (4 warnings)

These are `biome-ignore` comments that have no effect because the comment is misplaced relative to the actual violation line. All are in `src/routes/standup-notes/IssueActivityGroup.tsx` (lines 107, 120) and `src/stores/settings.store.test.ts` (lines 18, 20).

For `IssueActivityGroup.tsx`: the biome-ignore comments suppress `noArrayIndexKey` but are placed before the `<button>` opening tag line, while the actual `key={i}` violation is on the next line. Move each comment to immediately precede the `key={i}` line (see Section D placement note).

For `settings.store.test.ts:18,20`: the suppression comments suppress `assist/source/organizeImports` — after `npm run fix` reorganizes imports, these suppressions will either become valid or the import order will be corrected. Remove them if import order is no longer an issue post-fix.

---

## Execution Order (Recommended)

1. **`npm run fix`** — auto-fixes format (37) + organizeImports (16) + useImportType (1). Total ~54 issues cleared. Commit.

2. **Small rules manual pass** — `useTemplate` (6), `useLiteralKeys` (3), `useNodejsImportProtocol` (3), `noCommaOperator` (1) = 13 issues. All straightforward string/import transforms. Commit.

3. **suppressions/unused** — fix 4 misplaced biome-ignore comments. Commit.

4. **noArrayIndexKey** — 15 issues: 5-7 suppressions for static lists, 5-8 real key fixes. Commit.

5. **useExhaustiveDependencies** — 18 issues: ~5 safe dep adds, ~3 biome-ignores for ref deps, ~10 need judgment. Commit.

6. **noNonNullAssertion — source files first** — 231 issues, batch by file starting with AioCycleDetailPage.tsx (34), SprintBoardTab.tsx (26), BacklogPage.tsx (21). Commit after each file or logical group.

7. **noNonNullAssertion — test files** — 62 issues. Convert `querySelector!` results to null-guarded access. Commit.

8. **useNamingConvention — interface properties** — 100 "property name" issues. Mostly `// biome-ignore` for API shape interfaces. Commit.

9. **useNamingConvention — object property shorthand** — 549 issues. Batch by file, suppress intentional PascalCase shorthand in mocks and lookup maps. Commit after each file.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead |
|---------|-------------|-------------|
| Null guard for post-filter chain | Type predicate factory function | Inline type predicate in `.filter((x): x is NonNullable<T> => x != null)` |
| Batch biome-ignore insertion | Script to inject comments | Manual batch edit in IDE — biome-ignore placement is line-sensitive, scripts miss context |

---

## Common Pitfalls

### Pitfall 1: biome-ignore placement for JSX key attribute
**What goes wrong:** Comment placed before `<ComponentName>` opening tag, but violation is on `key={i}` several lines later.
**Prevention:** Always place `// biome-ignore` on the line immediately before the exact violation line. For multi-line JSX, this means inside the JSX tag, not before the opening angle bracket.

### Pitfall 2: `?? ''` vs `?.` for non-null assertion removal
**What goes wrong:** Using `foo?.bar` converts `string` to `string | undefined`, breaking TypeScript type of function argument.
**Prevention:** When removing `!` from function arguments, use `?? ''` / `?? 0` / `?? []` to preserve non-nullable type. When chaining property access (`foo!.bar?.baz`), use `foo?.bar?.baz` (returns `T | undefined` which is usually fine for JSX rendering).

### Pitfall 3: biome --write --unsafe modifies more than intended
**What goes wrong:** Running `--write --unsafe` to fix useTemplate also applies any other unsafe fixes (noNonNullAssertion has unsafe fix, useExhaustiveDependencies has unsafe fix). These unsafe fixes may be wrong.
**Prevention:** Do NOT run `--write --unsafe` globally. If using it, run on specific files only: `npx biome check --write --unsafe src/hooks/useIsActiveRoute.ts`.

### Pitfall 4: Renaming snake_case TypeScript interface properties
**What goes wrong:** Renaming `full_path` to `fullPath` in the GitLab interface requires changing every access site AND every object literal that constructs that shape (mock data, API response transformations).
**Prevention:** Always suppress, never rename, properties that mirror external API shapes.

### Pitfall 5: useCallback to fix useExhaustiveDependencies "changes on every render"
**What goes wrong:** Wrapping a function in `useCallback` requires its own dependency array, which may also be wrong.
**Prevention:** For "changes on every render" warnings, prefer moving the function definition inside the `useEffect` body, or converting to `useReducer`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | biome.json `objectLiteralMember` selector syntax exists in Biome 2.x | Section A | Override wouldn't work; suppression approach still valid |

---

## Sources

### Primary (HIGH confidence — verified by running tools)
- Live `npx biome check --reporter=json` run against the full `src/` directory — all counts and file paths confirmed
- `npx biome explain <rule>` for noNonNullAssertion, useNamingConvention, noArrayIndexKey, useExhaustiveDependencies, useTemplate, useLiteralKeys, useImportType, useNodejsImportProtocol — fix types confirmed
- Live test: `npx biome check --write` and `--write --unsafe` on `/tmp/test_naming.ts` — confirmed useNamingConvention produces NO auto-rename even with `--unsafe`
- Direct source file inspection: `src/services/gitlab.ts`, `src/services/jira.ts`, `src/routes/standup-notes/IssueActivityGroup.tsx`, `src/components/app/Sidebar.tsx`, `src/routes/dashboard/SprintBoardTab.tsx`
- `taskflow/biome.json` — confirmed version 2.4.8, existing conventions config

### Research Date: 2026-05-28
### Valid Until: 60 days (biome rules change slowly)
