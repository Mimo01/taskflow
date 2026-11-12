---
phase: quick-261112-spn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/release-notes/parse.ts
  - taskflow/src/lib/release-notes/parse.test.ts
  - taskflow/src/lib/release-notes/lint.ts
  - taskflow/src/lib/release-notes/lint.test.ts
  - taskflow/src/lib/release-notes/legacy-render.test.tsx
  - taskflow/src/lib/release-notes/__fixtures__/samples.ts
  - taskflow/scripts/lint-release-notes.mjs
  - taskflow/scripts/bump-version.mjs
  - taskflow/scripts/release.sh
  - taskflow/docs/RELEASE-NOTES.md
  - taskflow/src/services/releases.ts
  - taskflow/src/services/releases.test.ts
  - taskflow/src/hooks/useReleaseHistory.ts
  - taskflow/src/components/update/ReleaseNotesBody.tsx
  - taskflow/src/components/update/ReleaseNotesBody.test.tsx
  - taskflow/src/components/update/ReleaseRollup.tsx
  - taskflow/src/components/update/UpdateDialog.tsx
  - taskflow/src/components/update/UpdateDialog.test.tsx
  - taskflow/src/components/update/WhatsNewDialog.tsx
  - taskflow/src/components/update/WhatsNewDialog.test.tsx
  - taskflow/src/routes/settings/Settings.tsx
  - taskflow/src/routes/settings/Settings.test.tsx
  - taskflow/src/routes/settings/UpdatesSection.tsx
  - taskflow/src/routes/settings/UpdatesSection.test.tsx
autonomous: true
requirements: [QUICK-261112-spn]

must_haves:
  truths:
    - "Every historical release body (CHANGELOG 1.0–1.14.20 and GitHub bodies v0.1.0–v1.14.20, variants V1–V16) renders in the new app: titles shown by default, description shown on click, raw-markdown fallback when unparsable, 'No release notes' when empty"
    - "Old clients still render new short notes correctly: the notes remain plain GitHub markdown (lead paragraph + ### sections + bullets), proven by legacy-render.test.tsx rendering them through the old ReactMarkdown + remarkGfm path; CI is untouched, and lastSeenChangelog stays a raw markdown string"
    - "The approved CONTEXT.md example (including the plain Fixed bullet 'Duplicate notifications, package mismatches, peek over-scroll') passes lintReleaseNotes with zero errors"
    - "release.sh / bump-version.mjs reject wordy notes before any file is written, unless --allow-wordy-notes is passed; --skip-bump only warns and its behaviour is otherwise unchanged"
    - "Update available modal shows 'Update available', 'current → new · date', '(N releases)' when skipping, a headline, grouped expandable titles and a roll-up of skipped releases; the download progress replaces the footer and cannot be dismissed (no Stop Download)"
    - "What's new modal shows a check icon, 'Updated to X.Y.Z', 'from <lastSeenVersion>', the same notes body plus roll-up, and 'See all updates' (opens Settings → Updates) / 'Got it' footer"
    - "Settings → Updates loads ALL releases (follows the Link pagination), groups them by minor version in collapsible groups, and supports search, type filter chips and an Installed highlight"
  artifacts:
    - path: "taskflow/src/lib/release-notes/parse.ts"
      provides: "parseReleaseNotes, summarizeNotes, NoteKind/NoteItem/NoteSection/ParsedNotes types"
      exports: ["parseReleaseNotes", "summarizeNotes"]
    - path: "taskflow/src/lib/release-notes/lint.ts"
      provides: "lintReleaseNotes used by scripts and tests"
      exports: ["lintReleaseNotes"]
    - path: "taskflow/docs/RELEASE-NOTES.md"
      provides: "Written release-notes format instructions with example"
    - path: "taskflow/src/services/releases.ts"
      provides: "fetchAllReleases (Link pagination, sort, draft/prerelease handling), selectRollup"
      exports: ["fetchAllReleases", "selectRollup"]
    - path: "taskflow/src/hooks/useReleaseHistory.ts"
      provides: "Shared TanStack query ['github-releases','all'] for all three surfaces"
      exports: ["useReleaseHistory"]
    - path: "taskflow/src/components/update/ReleaseNotesBody.tsx"
      provides: "Single shared notes renderer (headline, small-caps groups, expandable bullets, raw fallback)"
      exports: ["ReleaseNotesBody"]
  key_links:
    - from: "taskflow/scripts/bump-version.mjs"
      to: "taskflow/src/lib/release-notes/lint.ts"
      via: "direct .ts import (Node type stripping) before package.json write"
      pattern: "lintReleaseNotes"
    - from: "taskflow/src/components/update/UpdateDialog.tsx"
      to: "ReleaseNotesBody + useReleaseHistory"
      via: "import; roll-up gated on open + non-dev version"
      pattern: "ReleaseNotesBody"
    - from: "taskflow/src/components/update/WhatsNewDialog.tsx"
      to: "/settings?section=updates"
      via: "useNavigate after setLastSeenVersion"
      pattern: "section=updates"
    - from: "taskflow/src/routes/settings/UpdatesSection.tsx"
      to: "useReleaseHistory"
      via: "replaces the per_page=20 single fetch"
      pattern: "useReleaseHistory"
---

<objective>
Redesign how taskflow shows updates while staying 100% backwards compatible. The work has four parts:
1. Concise release-notes format enforced by a lint in the release scripts, plus written instructions.
2. One shared parser and one shared notes-body component that render every old and new body.
3. The redesigned "Update available" and "What's new" modals, with a roll-up of skipped versions.
4. A Settings → Updates history that loads every release, groups by minor version, and supports search and filters.

Purpose: release notes are currently long walls of text. Users should see a headline and short titles, with details on demand, across all clients.

Output: the parser and lint library, script changes and docs, the releases service and hook, the ReleaseNotesBody and ReleaseRollup components, and the redesigned UpdateDialog, WhatsNewDialog and UpdatesSection, each with updated tests.

Locked orchestrator decisions:
- Remove "Stop Download".
- Exclude prereleases and drafts from roll-ups and history.
- Use small hand-written placeholder fixtures.
- Do not rewrite CHANGELOG.md history.
- Do not perform an actual release.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261112-spn-redesign-update-display-concise-changelo/261112-spn-CONTEXT.md
@.planning/quick/261112-spn-redesign-update-display-concise-changelo/261112-spn-RESEARCH.md

Repo layout: .planning and git live at the outer root (/Users/mimo/Documents/Projects/taskflow). src, npm, vitest, biome, scripts, docs and CHANGELOG.md live in the inner `taskflow/`. Run every npm/npx command from `taskflow/`.

The pre-commit hook runs the full vitest suite, `biome check --staged` and tsc. Commit RED and GREEN together, one commit per task. Use `git commit -- <paths>` and check `git log -1 --stat` afterwards, because staged files from a failed hook get swept into the next commit.

Source files to read once at the start of each task:
- Task 1: taskflow/scripts/release.sh, taskflow/scripts/bump-version.mjs, the top ~120 lines of taskflow/CHANGELOG.md
- Task 2: taskflow/src/components/update/UpdateDialog.tsx (+ .test), WhatsNewDialog.tsx (+ .test), src/stores/update.store.ts, src/lib/openExternal.ts, src/routes/dashboard/release-detail/ReleaseDescription.tsx (MARKDOWN_COMPONENTS pattern), src/components/ui/dialog.tsx
- Task 3: taskflow/src/routes/settings/UpdatesSection.tsx (+ .test), Settings.tsx (+ .test), src/routes/dashboard/AioCyclesScopeBar.tsx (segmented aria-pressed pattern), src/components/ui/empty-state.tsx

Contracts. Task 1 creates these; Tasks 2 and 3 consume them:
- parse.ts types:
  - `NoteKind = 'new'|'improved'|'fixed'|'removed'|'security'|'other'`
  - `NoteItem { title; detail: string|null; children: NoteItem[]; raw }`
  - `NoteSection { kind; label: string|null; items }`
  - `ParsedNotes { headline: string|null; sections; extra: string[]; structured: boolean; raw }`
- parse.ts functions: `parseReleaseNotes(md: string|null|undefined): ParsedNotes` and `summarizeNotes(p): string|null`
- lint.ts: `lintReleaseNotes(md): { errors: string[]; warnings: string[] }`
- Task 2 creates these; Task 3 consumes them:
  - releases.ts: `ReleaseEntry { version; tag; publishedAt; body; prerelease }`
  - releases.ts: `fetchAllReleases(): Promise<ReleaseEntry[]>`, newest first
  - releases.ts: `selectRollup(releases, from, to): ReleaseEntry[]`
  - useReleaseHistory.ts: `useReleaseHistory({ enabled }: { enabled?: boolean })`
  - ReleaseNotesBody.tsx: `ReleaseNotesBody({ notes: string|null|undefined, compact?: boolean, filterKinds?: NoteKind[], highlight?: string })`
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Release-notes parser + lint library, release script guard, written instructions</name>
  <files>taskflow/src/lib/release-notes/parse.ts, taskflow/src/lib/release-notes/parse.test.ts, taskflow/src/lib/release-notes/lint.ts, taskflow/src/lib/release-notes/lint.test.ts, taskflow/src/lib/release-notes/legacy-render.test.tsx, taskflow/src/lib/release-notes/__fixtures__/samples.ts, taskflow/scripts/lint-release-notes.mjs, taskflow/scripts/bump-version.mjs, taskflow/scripts/release.sh, taskflow/docs/RELEASE-NOTES.md</files>
  <behavior>
    - V1 `### Added` + `- **Title** — detail`: kind 'new'. Title and detail are split.
    - V2 em dash inside the bold, as in `**Sprint board — time-in-column badge** — each card…`: the title keeps the inner em dash.
    - V3 `- **Dashboard greeting** now handles …`: title is the whole text, detail is null.
    - V4 `- **X — redesigned Changes tab:**` followed by indented `  - **Grouping:** …`: title has no colon, and the nested bullets become children.
    - V5 plain `- Worklogs: …` bullets and V8 `### Fixed` directly followed by bullets with no blank line both parse.
    - V6 lead paragraph and V13 leading newline: the paragraph becomes `headline`.
    - V7 lead paragraph + bullets with no heading, and V10 unheaded bullet groups separated by blank lines: everything goes into a single implicit section with kind 'other' and label null.
    - V9 `## Added` at h2: maps to 'new'.
    - Heading synonyms map to the same kind: Changed/Improved → 'improved', Fixed/Bug fixes → 'fixed', Removed/Deprecated → 'removed', Security → 'security'. An unknown heading gives 'other' and keeps its label.
    - V11 lowercase raw commit subjects: plain titles.
    - V12 prose with a `Co-Authored-By:` trailer: the trailer is dropped, structured is false, and raw is kept.
    - V14 '' and null: structured false and raw ''.
    - V15 `'## v2.0\n- New feature'`: the version heading is skipped, and there is one item titled 'New feature'.
    - V16 inline code with braces in a title is preserved.
    - The approved new-format example from CONTEXT.md parses to:
      - headline 'Notifications got a full redesign.'
      - three sections (new, improved, fixed)
      - first item title 'Notification panel' with detail 'stacks per issue, quick actions'
    - Trailing '.' is stripped from titles.
    - summarizeNotes returns the headline, else the first item title, else the first raw line, else null.
    - lintReleaseNotes on the approved CONTEXT.md example, copied VERBATIM into the fixture (including the plain Fixed bullet `- Duplicate notifications, package mismatches, peek over-scroll`, 61 chars, no bold): `errors` is exactly `[]`. This is an explicit named test case in lint.test.ts.
    - lintReleaseNotes on a 1.14.20-style long entry (no headline, long details): errors.
    - Bullet classification for length limits: a bullet is "bold-titled" when its raw text (after the `- `/`* ` marker) starts with `**`; otherwise it is "plain". Determine this from `NoteItem.raw`, not from the parsed title.
    - lintReleaseNotes reports each threshold as its own error:
      - missing headline
      - headline over 120 chars, or more than one sentence
      - bold-titled bullet: title over 50 chars (applies ONLY to bold-titled bullets)
      - bold-titled bullet: detail over 70 chars, or containing '. ' or ';'
      - plain bullet: whole bullet text (marker stripped, trimmed) over 90 chars (plain bullets are NOT subject to the 50-char title limit)
      - a section with more than 6 bullets
      - more than 3 Fixed bullets
      - more than 14 bullets total
      - no ### section
    - Explicit lint cases in lint.test.ts:
      - PASS: the approved example (above).
      - PASS: a plain bullet of exactly 90 chars.
      - FAIL: a plain bullet of 91+ chars (e.g. a long comma-joined list of fixes) yields one error naming the 90-char plain-bullet limit.
      - FAIL: a bold-titled bullet whose title is 51+ chars yields one error naming the 50-char title limit.
    - lintReleaseNotes gives a warning only for an unknown heading.
    - Backwards compatibility (legacy-render.test.tsx): rendering the approved example and a second new-format fixture through the OLD rendering path, `render(<ReactMarkdown remarkPlugins={[remarkGfm]}>{notes}</ReactMarkdown>)` (exactly what the pre-change UpdateDialog/WhatsNewDialog did), shows:
      - the headline as a paragraph (`getByText('Notifications got a full redesign.')`);
      - each `###` heading as a level-3 heading (`getByRole('heading', { level: 3, name: 'New' })`, likewise Improved and Fixed);
      - each bullet title in a list item, bold titles inside `<strong>` (e.g. `getByText('Notification panel').tagName === 'STRONG'`), and the plain Fixed bullet text present;
      - no literal `**` or `###` characters leak into the rendered text content.
  </behavior>
  <action>
**Parser (parse.ts).** Implement it exactly per RESEARCH.md "Parser Design": a line-based parser with steps 1–6 and title/detail rules 5a–5d. Constraints:
- No new dependencies.
- No `@/` imports and erasable TS syntax only (no enums or namespaces), because Node imports this file directly via type stripping.
- Relative imports use the `.ts` extension.

**Lint (lint.ts).** Reuse parseReleaseNotes. Use the thresholds listed in the behavior block (Claude's discretion per RESEARCH A1, refined by the orchestrator): the 50-char title limit and the 70-char detail limit apply only to bold-titled bullets; plain (non-bold) bullets are checked against a single 90-char limit on their whole text. Export the numeric limits as named constants (e.g. `LIMITS = { headline: 120, boldTitle: 50, detail: 70, plainBullet: 90, perSection: 6, fixed: 3, total: 14 }`) so tests and docs/RELEASE-NOTES.md stay in sync. Walk children too: nested bullets are checked with the same bold/plain rules.

**Legacy render test (legacy-render.test.tsx).** Imports react-markdown and remark-gfm (both already dependencies) and the fixtures; it does NOT import any new component. It is the explicit proof for the "old clients render new notes" claim, see the behavior block.

**Fixtures (`__fixtures__/samples.ts`).** Export small hand-written string constants, one per variant V1–V16, plus the approved CONTEXT.md example and a 1.14.20-style wordy entry.
- Mirror the real shapes from CHANGELOG.md and RESEARCH.md.
- Use generic placeholder wording only. No customer or company names, no internal hostnames, no personal names (repo policy).
- If you copy anything from the scratchpad rel.json, scrub it first.

**Tests.** Write parse.test.ts and lint.test.ts covering the behavior block. Write them first (RED), then implement (GREEN). Commit both together in this task's single commit.

**bump-version.mjs:**
- Parse argv: the first non-flag argument is the version; `--allow-wordy-notes` is a flag. Keep the existing X.Y.Z validation.
- Import lintReleaseNotes from '../src/lib/release-notes/lint.ts'.
- Run the lint right after reading stdin, BEFORE any file write.
- If there are errors and no override flag: print each error, print a pointer to docs/RELEASE-NOTES.md, and exit 1 with the tree untouched.
- Print warnings without failing.
- Update the header comment and the usage/example strings to the new format, e.g. `printf 'One-line summary.\n\n### Fixed\n- **Bug title**'`, and reference docs/RELEASE-NOTES.md.
- Do not change how CHANGELOG/tag content is written. Keep `--cleanup=verbatim`.

**lint-release-notes.mjs.** Tiny CLI that reads stdin. Flags:
- `--warn-only`: always exit 0.
- `--allow-wordy-notes`: errors are downgraded to warnings.
Exit 1 when there are errors.

**release.sh:**
- Pass `--allow-wordy-notes` through explicitly. The current `--*) ;;` case swallows it.
- In Phase A (pre-flight), when not `--skip-bump`, lint `$RELEASE_NOTES` via lint-release-notes.mjs, before any mutation.
- Forward the flag to bump-version.mjs.
- With `--skip-bump`, lint the already-committed CHANGELOG section (the same awk extraction the script already uses) with `--warn-only`, so a historical entry never blocks. Keep the stdin-unused behaviour on that path.
- Update the header usage, the examples and the empty-tag-body hint (around line 102) to the new format.
- Reference docs/RELEASE-NOTES.md in the header.

**docs/RELEASE-NOTES.md.** Written instructions for Claude, who writes the notes for each release:
- the format: one headline sentence, then `### New` / `### Improved` / `### Fixed` (`### Removed` / `### Security` when needed);
- bullets are `**Title**` optionally followed by ` — short clause`;
- collapse fixes into 1–3 bullets;
- the lint thresholds (including that the 50-char limit is for bold titles and plain bullets get 90 chars) and the override flag;
- the approved example verbatim;
- that the same text goes to CHANGELOG.md, the tag, the GitHub release and the app;
- that old clients render it as plain markdown;
- a "how to derive notes from git log" checklist.

Do not modify any existing CHANGELOG.md entries. Do not run release.sh or bump-version.mjs with a real version.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/release-notes && printf 'x' | node scripts/lint-release-notes.mjs; test $? -eq 1 && printf 'Short summary.\n\n### Fixed\n- **A bug**' | node scripts/lint-release-notes.mjs && printf 'Notifications got a full redesign.\n\n### New\n- **Notification panel** — stacks per issue, quick actions\n- **Epic picker on stories**\n- **Searchable pickers** in Settings and setup\n\n### Improved\n- **Attachment tiles**\n- **No active sprint** messaging\n\n### Fixed\n- Duplicate notifications, package mismatches, peek over-scroll\n' | node scripts/lint-release-notes.mjs && printf 'x' | node scripts/lint-release-notes.mjs --warn-only && bash -n scripts/release.sh && git status --porcelain package.json CHANGELOG.md | wc -l | grep -q '^ *0$' && echo OK</automated>
  </verify>
  <done>
- The parser and lint tests pass for every variant V1–V16, the approved example and the wordy entry.
- The approved example (with its plain 61-char Fixed bullet) lints with zero errors; a 91+ char plain bullet and a 51+ char bold title each fail.
- legacy-render.test.tsx passes: new-format notes render headline, h3 headings and bullet titles through the old ReactMarkdown + remarkGfm path.
- The CLI exits 1 on wordy notes, 0 on good notes, and 0 with --warn-only.
- release.sh passes `bash -n`.
- bump-version.mjs lints before writing anything.
- docs/RELEASE-NOTES.md exists and both script headers reference it.
- Fixtures contain placeholders only.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Shared releases data + ReleaseNotesBody, redesigned Update available and What's new modals</name>
  <files>taskflow/src/services/releases.ts, taskflow/src/services/releases.test.ts, taskflow/src/hooks/useReleaseHistory.ts, taskflow/src/components/update/ReleaseNotesBody.tsx, taskflow/src/components/update/ReleaseNotesBody.test.tsx, taskflow/src/components/update/ReleaseRollup.tsx, taskflow/src/components/update/UpdateDialog.tsx, taskflow/src/components/update/UpdateDialog.test.tsx, taskflow/src/components/update/WhatsNewDialog.tsx, taskflow/src/components/update/WhatsNewDialog.test.tsx</files>
  <behavior>
    - fetchAllReleases pagination: requests `per_page=100`, follows `rel="next"` in the Link header (capped at 10 pages), and tolerates mocks with no headers.
    - fetchAllReleases filtering and sorting: drops drafts, prereleases and tags that fail compare-versions `validate`. Strips the leading `v`. Sorts newest-first via compareVersions. Throws on a non-ok response.
    - selectRollup(releases, '1.14.17', '1.14.20') returns 1.14.18 and 1.14.19 (exclusive both ends), newest first. It returns [] when `from` is invalid or null.
    - ReleaseNotesBody, structured notes: renders the headline, then small-caps group labels derived from kind (NEW / IMPROVED / FIXED / REMOVED / SECURITY, with the 'other' label or none).
      - Titles are visible and details are hidden.
      - Clicking a bullet that has a detail or children sets aria-expanded=true and shows the detail.
      - Bullets without a detail are not buttons.
    - ReleaseNotesBody, other states: unstructured notes render via ReactMarkdown raw; empty notes show 'No release notes'. A Fixed section with more than 3 items collapses to a single 'N fixes' expandable row.
    - UpdateDialog, available state: title 'Update available', a 'current → new' line, the notes body, then the Later and Update now buttons. Update now still calls persistChangelogBeforeRestart with the raw changelog string.
    - UpdateDialog, downloading state: the progress bar replaces the footer, there is NO Stop Download button, and the dialog is not dismissable. The error state keeps Dismiss and Retry.
    - UpdateDialog roll-up: when the history hook returns intermediate releases, it shows '(N releases)' and one compact row per skipped release. When the hook errors or is loading, only the latest notes render.
    - WhatsNewDialog: 'Updated to X.Y.Z', 'from <lastSeenVersion>' (omitted when null or invalid), the notes body from lastSeenChangelog, and the roll-up when available. Got it sets lastSeenVersion. See all updates sets lastSeenVersion and navigates to /settings?section=updates. The open condition is unchanged.
  </behavior>
  <action>
**Execution order (mandatory).** This task is large, so do it in this order. Each step ends with its own tests green. If context runs low, the executor MAY commit after step A (with `git commit -- <step A paths>`) and continue; otherwise make one commit at the end.
- **Step A: data layer and shared body.** releases.ts + releases.test.ts, useReleaseHistory.ts, ReleaseNotesBody.tsx + ReleaseNotesBody.test.tsx. Run `npx vitest run src/services/releases src/components/update/ReleaseNotesBody` until green. These files do not touch the dialogs, so the existing dialog tests still pass.
- **Step B: ReleaseRollup.tsx** (consumes A).
- **Step C: UpdateDialog.tsx + test.**
- **Step D: WhatsNewDialog.tsx + test.**
Do not start a later step until the earlier step's tests pass.

**releases.ts (Step A):**
- Move the GitHub URL here: `https://api.github.com/repos/Mimo01/taskflow-releases/releases?per_page=100`.
- Implement fetchAllReleases and selectRollup as described in the behavior block and RESEARCH "GitHub Releases API Strategy". Use global fetch and read the Link header via `res.headers?.get?.('link') ?? null`.
- Exclude prereleases and drafts entirely (orchestrator decision).

**useReleaseHistory.ts (Step A):**
- useQuery with key `['github-releases','all']`, staleTime 30 min, refetchOnWindowFocus false, retry 1, and an `enabled` param.
- This is the one shared query for all three surfaces (the unauthenticated 60/h rate limit).

**ReleaseNotesBody.tsx (Step A):**
- Parse with useMemo(parseReleaseNotes).
- Render inline title/detail text through a small InlineMarkdown wrapper: ReactMarkdown with `allowedElements` strong/em/code/del/a and `unwrapDisallowed`. Map `a` to a button or anchor that calls openExternal (MARKDOWN_COMPONENTS pattern from ReleaseDescription.tsx). No rehype-raw.
- Each expandable bullet is a full-width `<button aria-expanded>` holding a truncated one-line title with a `title` attribute (one row = one line). Put the › chevron trailing inside the button and rotate it when open. Opacity hover only, so nothing shifts layout.
- The detail and children appear below in muted text.
- Group labels are `text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`.
- The `extra` paragraphs and unstructured bodies render with the existing prose ReactMarkdown styling.
- Optional props:
  - `filterKinds` hides sections whose kind is not listed;
  - `highlight` wraps case-insensitive matches in `<mark>`, or simply keeps items whose text matches when a highlight string is given (used by Task 3 search);
  - `compact` tightens spacing.

**ReleaseRollup.tsx (Step B):**
- Takes the list of skipped ReleaseEntry objects.
- Each release is one row button: `1.14.19 — summarizeNotes(...)`, truncated, with a trailing ›. Expanding the row renders ReleaseNotesBody compact.

**UpdateDialog.tsx (Step C)** ("Compact card" per CONTEXT):
- Header: 'Update available', then the subline `{buildInfo.version} → {version} · {date}`, plus ' (N releases)' when there are intermediates (N = intermediates + 1).
- Body: ReleaseNotesBody for the latest.json changelog, then a 'Skipped releases' ReleaseRollup. The body is capped at `max-h-[60vh] overflow-y-auto` so the footer stays visible.
- Footer: Later / Update now.
- Downloading: the progress bar plus percentage replace the footer in place. Delete the 'Stop Download' button (orchestrator decision). Keep it non-dismissable via the existing isDismissable logic.
- Error: keep Dismiss / Retry.
- Gate the roll-up: call useReleaseHistory with `enabled` only when status is 'available', buildInfo.version does not contain '-dev', and the version is semver-valid. Never block on loading or error.

**WhatsNewDialog.tsx (Step D)** ("same body, celebratory header"):
- Header: a CircleCheck icon, then 'Updated to {buildInfo.version}', then the subline 'from {lastSeenVersion}' only when it is semver-valid.
- Body: ReleaseNotesBody(lastSeenChangelog), then the roll-up from selectRollup(history, lastSeenVersion, buildInfo.version), with the same gating.
- Footer: a 'See all updates' link-style button and a primary 'Got it'.
  - See all updates: setLastSeenVersion(buildInfo.version), then navigate('/settings?section=updates') via useNavigate.
  - Got it: same set as today.
- Keep the open condition and the store fields exactly as they are.
- Read stores via selectors, not getState() in render (React Compiler).

**Tests:**
- Update UpdateDialog.test and WhatsNewDialog.test for the new copy. Wrap renders in QueryClientProvider (retry false) and MemoryRouter, or `vi.mock('@/hooks/useReleaseHistory')` to control the roll-up data. Add cases for the roll-up shown, the fallback, no Stop Download, and the See all updates navigation.
- Add releases.test.ts (mocked fetch with Link headers) and ReleaseNotesBody.test.tsx.
- Do NOT bend production code to satisfy incomplete mocks.

Write each step's tests first. Commit per the execution-order note above (one commit, or Step A then the rest).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/services/releases src/components/update && npx tsc --noEmit -p . && npx biome check src/services/releases.ts src/hooks/useReleaseHistory.ts src/components/update</automated>
  </verify>
  <done>
- Both modals use the shared ReleaseNotesBody and show the roll-up from the shared query, falling back to local notes.
- Stop Download is gone and downloading cannot be dismissed.
- persistChangelogBeforeRestart still stores the raw string.
- The tests, tsc and biome are clean for the touched files.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Settings → Updates history (load all, grouped by minor, search + filters) and ?section deep link</name>
  <files>taskflow/src/routes/settings/UpdatesSection.tsx, taskflow/src/routes/settings/UpdatesSection.test.tsx, taskflow/src/routes/settings/Settings.tsx, taskflow/src/routes/settings/Settings.test.tsx</files>
  <behavior>
    - With 25+ mocked releases across 2 pages (Link header), all versions render. The old 20 cap is gone.
    - Releases are grouped under minor headers ('1.14.x', '1.13.x', ...), newest first. The group with the installed version, or else the newest group, is expanded; the others are collapsed with aria-expanded=false. Clicking a group header toggles it.
    - Each release row shows the version, a relative date and summarizeNotes on one truncated line. The installed version's row has an 'Installed' badge. Expanding a row shows ReleaseNotesBody.
    - Typing in the search filters releases to those whose raw body or version matches (case-insensitive). Groups with matches auto-expand. Zero matches shows a compact EmptyState 'No matching updates'.
    - The type chips (All / New / Improved / Fixed, aria-pressed) restrict both the listed releases and their bodies to the selected kinds.
    - A fetch error shows a compact EmptyState with Retry. Loading shows skeleton rows.
    - Settings opens on the Updates section when the URL has ?section=updates, including when Settings is already mounted and the param changes. Without the param it opens Connections as before.
  </behavior>
  <action>
**UpdatesSection.tsx:**
- Replace the per_page=20 VersionHistoryList fetch with useReleaseHistory() (always enabled here).
- Keep the rest of the section (check-for-updates controls etc.) unchanged.
- Build the history with the existing section header conventions: h3 small-caps label.
- Plain document flow inside the Settings scroller. No card panels, and no inner fixed-height scroll area.

**Controls row:**
- A search Input (input-group with a search icon) and a segmented chip fieldset (All / New / Improved / Fixed) following the AioCyclesScopeBar aria-pressed pattern. For the chips, 'improved' also matches the parsed kind of old 'Changed' headings, because the parser normalises them.

**Grouping:**
- Group key is `major.minor`, sorted with compareVersions.
- Each group header is a `<button aria-expanded>` showing '1.14.x', the release count, and a trailing chevron.
- Each release is a one-line row button: version, relative date (reuse the existing relativeTime helper), summary truncated, trailing ›.
- The installed release (buildInfo.version) gets `<Badge variant="secondary">Installed</Badge>` and a subtle bg-muted/50 row tint.
- An expanded release renders ReleaseNotesBody with `filterKinds` from the chips and the search highlight.
- Precompute parsed notes once per release with useMemo for filtering.

**Empty, error and loading states:**
- Empty or error: compact EmptyState (error has a Retry that calls refetch).
- Loading: Skeleton rows.
- Use an 'Open on GitHub' link per release only if the existing section already has one; otherwise do not add one.

**Settings.tsx:**
- Read `useSearchParams()`. Initialise activeSection from `section` when it is a valid SettingsSection.
- Add a useEffect that syncs when the param changes.
- When the user clicks a nav item, clear or replace the param so it does not stick (setSearchParams with replace).
- Router context: use plain `useSearchParams` (no router-safe shim). A grep at planning time (`grep -rn "<Settings\b" src`, plus importers of `routes/settings/index.tsx` and `routes/routes.tsx` in tests) shows Settings is rendered in exactly two places: `src/routes/routes.tsx` (inside the app router, already has context) and `src/routes/settings/Settings.test.tsx` (all renders go through its local `renderWithQuery` helper). No other test renders Settings, routes.tsx or settings/index.tsx. So the only wrapper fix is in Settings.test.tsx. Before editing, re-run that grep; if a new render site has appeared, add the MemoryRouter wrapper there too and list it in the SUMMARY.

**Tests:**
- In Settings.test.tsx, change the shared `renderWithQuery` helper to also wrap in `<MemoryRouter initialEntries={[entry ?? '/settings']}>` (optional second arg), so all nine existing `renderWithQuery(<Settings />)` calls get router context in one place. Add a ?section=updates case and a param-change-while-mounted case.
- Update UpdatesSection.test.tsx mocks to include headers.get, then add cases for pagination, grouping, search, chips, the Installed badge and error retry. Replace the old 'v1.5.0'/'current' assertions with the new copy.

Write the tests first. Commit everything in one commit. Afterwards run the full suite once to catch cross-file breakage.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/settings src/components/update src/lib/release-notes src/services/releases && npx tsc --noEmit -p . && npx biome check src/routes/settings/UpdatesSection.tsx src/routes/settings/Settings.tsx && npm run test -- --run 2>&1 | tail -5</automated>
  </verify>
  <done>
- Settings → Updates lists every release, grouped by minor in collapsible groups, with search, type chips, an Installed badge and titles-first notes.
- ?section=updates deep-links from the What's new 'See all updates' button.
- The full vitest suite, tsc and biome have no new failures.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| GitHub API → client | Release bodies are remote, untrusted markdown rendered in the webview |
| stdin → release scripts | Notes text authored locally and fed into the CHANGELOG, the tag and CI |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-spn-01 | Tampering/XSS | ReleaseNotesBody / InlineMarkdown | mitigate | ReactMarkdown without rehype-raw (HTML escaped); inline `allowedElements` strong/em/code/del/a + unwrapDisallowed |
| T-spn-02 | Spoofing (navigation) | links in notes | mitigate | `a` mapped to openExternal; the webview never navigates |
| T-spn-03 | DoS | fetchAllReleases | mitigate | Page cap of 10; one shared query (staleTime 30m, no focus refetch) under the 60/h limit; roll-up gated on modal open + non-dev; failures fall back to local notes |
| T-spn-04 | Tampering | release tag content | mitigate | Keep `--cleanup=verbatim`; lint runs before any write, so a failure leaves the tree untouched |
| T-spn-05 | Information disclosure | test fixtures | mitigate | Hand-written placeholder fixtures only; scrub anything taken from rel.json |
| T-spn-SC | Tampering | package installs | accept | No new packages (compare-versions and react-markdown already installed) |
</threat_model>

<verification>
- `cd taskflow && npm run test -- --run` passes (full suite).
- `npx tsc --noEmit` is clean.
- biome reports no new flagged files.
- `bash -n scripts/release.sh` passes.
- `printf 'x' | node scripts/bump-version.mjs 9.9.9` exits non-zero AND `git status` shows no changes to package.json, CHANGELOG.md or tauri.conf.json.
- `git diff HEAD~3 -- taskflow/CHANGELOG.md` is empty (history not rewritten).
- `git diff HEAD~3 -- .github` is empty (CI untouched).
</verification>

<success_criteria>
- One parser and one notes component serve all three surfaces, and all 16 historical variants render.
- New concise format: documented, linted, with an override, and backwards compatible with old clients.
- The modals are redesigned per the CONTEXT decisions, with a skipped-version roll-up and offline fallback.
- Settings history loads all releases, grouped, searchable and filterable.
- No release performed and no CHANGELOG history rewritten.
</success_criteria>

<output>
Create `.planning/quick/261112-spn-redesign-update-display-concise-changelo/261112-spn-SUMMARY.md` when done.
</output>
