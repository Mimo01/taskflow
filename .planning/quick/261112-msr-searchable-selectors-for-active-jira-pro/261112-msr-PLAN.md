---
phase: quick-261112-msr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/ui/searchable-select.tsx
  - taskflow/src/components/ui/searchable-select.test.tsx
  - taskflow/src/test/setup.ts
  - taskflow/src/services/gitlab.ts
  - taskflow/src/services/gitlab.test.ts
  - taskflow/src/services/jira/sprints.ts
  - taskflow/src/services/jira/sprints.test.ts
  - taskflow/src/routes/settings/ConnectionsSection.tsx
  - taskflow/src/routes/settings/ConnectionsSection.test.tsx
  - taskflow/src/components/jira/BoardPicker.tsx
  - taskflow/src/routes/onboarding/JiraStep.tsx
  - taskflow/src/routes/onboarding/JiraStep.test.tsx
  - taskflow/src/routes/onboarding/GitLabStep.tsx
  - taskflow/src/components/integrations/AioBlock.tsx
  - taskflow/src/components/integrations/AioBlock.test.tsx
  - taskflow/src/components/integrations/ReleaseManagementBlock.tsx
  - taskflow/src/components/integrations/ReleaseManagementBlock.test.tsx
  - taskflow/src/routes/settings/IntegrationsSection.test.tsx
  - taskflow/src/routes/onboarding/IntegrationsStep.test.tsx
autonomous: true
requirements: [QUICK-261112-msr]

must_haves:
  truths:
    - "In Settings > Connections and in the onboarding wizard, the active Jira project, Jira board, GitLab project pickers open a popover with a search box"
    - "In Settings > Integrations and the wizard Integrations step, the AIO project and Release Management project pickers open the same searchable popover"
    - "Typing in the search box filters options by name AND by key/id (e.g. 'PROJ', '1234', 'group/repo')"
    - "Arrow keys move the highlight, Enter selects, Escape closes without changing the value"
    - "The currently selected option shows a leading check mark; a search with no hits shows 'No matches'"
    - "GitLab project and Jira board lists contain every page, not just the first 100, so search can find any project/board"
  artifacts:
    - path: "taskflow/src/components/ui/searchable-select.tsx"
      provides: "Shared searchable single-select (Popover + cmdk) used by all 7 call sites"
      exports: ["SearchableSelect", "SearchableSelectOption"]
    - path: "taskflow/src/components/ui/searchable-select.test.tsx"
      provides: "Behaviour tests: filter by name/key, keyboard nav, leading check, No matches"
  key_links:
    - from: "ConnectionsSection.tsx, BoardPicker.tsx, JiraStep.tsx, GitLabStep.tsx, AioBlock.tsx, ReleaseManagementBlock.tsx"
      to: "components/ui/searchable-select.tsx"
      via: "import { SearchableSelect }"
      pattern: "SearchableSelect"
    - from: "listGitLabProjects / listProjectBoards"
      to: "all pages of GitLab /projects and Jira agile /board"
      via: "page loop (X-Next-Page / isLast)"
      pattern: "X-Next-Page|isLast"
---

<objective>
Replace the plain Base UI `Select` dropdowns used for choosing the active Jira project, Jira board, GitLab project, AIO project and Release Management project, in both Settings and the onboarding wizard, with ONE shared searchable selector that has a search box, keyboard navigation, a leading check on the selected item and a "No matches" empty state.

Purpose: users with many projects/boards cannot find theirs in a long unsearchable list.
Output: `components/ui/searchable-select.tsx` (+ tests), fully-paginated GitLab project and Jira board fetchers, and 7 migrated call sites.

Call sites found (all must migrate; no per-site re-implementation):
1. `routes/settings/ConnectionsSection.tsx` ~L221 — Jira "Active Project" (`id="jira-project-picker"`, options from `listJiraProjects`)
2. `routes/settings/ConnectionsSection.tsx` ~L443 — GitLab "Active Project" (`id="gitlab-project-picker"`, options from `listGitLabProjects`)
3. `components/jira/BoardPicker.tsx` ~L93 — Jira board (multi-board branch only, `id="jira-board-picker"`); shared by Settings (ConnectionsSection L247) and wizard (JiraStep L219)
4. `routes/onboarding/JiraStep.tsx` ~L193 — wizard Jira project (`id="jira-project"`)
5. `routes/onboarding/GitLabStep.tsx` ~L165 — wizard GitLab project (`id="gitlab-project"`)
6. `components/integrations/AioBlock.tsx` ~L113/L122 — AIO project (`id="aio-project"`); mounted by Settings IntegrationsSection and wizard IntegrationsStep
7. `components/integrations/ReleaseManagementBlock.tsx` ~L85 — RM project (`id="rm-project"`, with "None" option); mounted by both IntegrationsSection and IntegrationsStep

Out of scope: `routes/settings/TokenSection.tsx` also has project Selects but is dead code (not imported by Settings.tsx or anything else) — do NOT touch it.

Fetch audit (fetch-once page-cap pitfall): `listJiraProjects` (`/rest/api/2/project`) and `fetchAioProjects` (`/project`) return the full list unpaginated — client-side filtering is correct. `listGitLabProjects` fetches ONE page (`per_page=100`) and `listProjectBoards` fetches ONE page (`maxResults=100`) — both capped; Task 2 makes them fetch all pages so client-side search over the full list is truthful. Projects/boards lists are small enough to load fully (no server-side search needed).

WIZARD_VERSION decision: do NOT bump `lib/onboarding-rerun.ts`. The steps' content, gating and stored values are unchanged; only the picker affordance changes, which doesn't justify re-running the wizard for existing users.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Repo layout: `.planning/` and git root are the outer `taskflow/`; source, npm, vitest, biome run from the inner `taskflow/taskflow/`. All commands below `cd /Users/mimo/Documents/Projects/taskflow/taskflow` first.

Reference sources (read, do not modify unless listed in a task):
@taskflow/src/components/ui/person-picker.tsx — field-variant trigger styling (h-8, border-input, ChevronDown) and PopoverContent width `w-[max(20rem,var(--anchor-width))] max-w-(--available-width)`; copy these, they match SelectTrigger.
@taskflow/src/components/ui/command.tsx — cmdk wrappers (`Command`, `CommandInput`, `CommandList`, `CommandEmpty`). NOTE: its `CommandItem` renders a TRAILING CheckIcon; the project convention is a LEADING check (Fix Versions / EpicPicker), so items must use `Command as CommandPrimitive` from `cmdk` directly (`CommandPrimitive.Item`) instead of the shared `CommandItem`.
@taskflow/src/components/ui/epic-picker.tsx — leading `Check` slot convention (~L115-122).
@taskflow/src/routes/dashboard/release-detail/NotCoveredFixActions.tsx — existing Popover + Command composition in this codebase (~L112-155).
@taskflow/src/components/integrations/AioBlock.test.tsx — currently mocks `@/components/ui/select` with a native `<select>` stand-in; that mock becomes irrelevant for migrated sites.

Project rules: pre-commit runs full vitest + biome + tsc, so RED+GREEN go in ONE commit per tdd task. Never run `biome --write` over all of src — only on the files you touched. Commit with `git commit -- <paths>` and check `git log -1 --stat` (failed hooks leave files staged).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Shared SearchableSelect component</name>
  <files>taskflow/src/components/ui/searchable-select.tsx, taskflow/src/components/ui/searchable-select.test.tsx, taskflow/src/test/setup.ts</files>
  <behavior>
    - Renders a trigger button with the given `id` (so `<Label htmlFor>` works) showing the selected option's `triggerLabel ?? label`, or a muted `placeholder` when value is null / not in options
    - Clicking the trigger opens a popover with a focused search input (placeholder from `searchPlaceholder`, default "Search…")
    - Typing "proj" keeps options whose label OR keywords contain it (case-insensitive); typing an id/key that appears only in `keywords` (e.g. "1234", "group/repo") also matches
    - A search with zero hits shows "No matches" (overridable via `emptyText`)
    - ArrowDown/ArrowUp moves the highlight, Enter selects the highlighted option → `onValueChange(value)` called once and popover closes
    - Clicking an option calls `onValueChange(value)` and closes; Escape closes without calling `onValueChange`
    - The selected option has a visible leading check (data-testid `${testIdPrefix}-check`, default prefix "searchable-select") and `aria-selected`/`data-checked` semantics; non-selected rows keep the slot empty so labels align
    - Search text resets when the popover closes; `disabled` prevents opening
  </behavior>
  <action>
    Create `searchable-select.tsx` exporting `SearchableSelectOption` = { value: string; label: ReactNode; keywords: string[]; triggerLabel?: ReactNode } and `SearchableSelect` with props: `id?`, `value: string | null`, `onValueChange(value: string)`, `options`, `placeholder?` (default "Select…"), `searchPlaceholder?`, `emptyText?` (default "No matches"), `disabled?`, `aria-label?`, `testIdPrefix?`, `className?` (trigger).
    Compose: Base UI `Popover` (open state local, like PersonPicker) → `PopoverTrigger` styled exactly like PersonPicker's `variant="field"` default size (h-8 text-sm, border-input, truncating label span, `ChevronDown` at the end) → `PopoverContent align="start" className="w-[max(20rem,var(--anchor-width))] max-w-(--available-width) p-0"` → `Command` (from ui/command) → `CommandInput` → `CommandList className="max-h-64"` → `CommandEmpty` → one `CommandPrimitive.Item` per option.
    For each item pass `value={opt.value}` and `keywords={opt.keywords}` so cmdk's built-in filter matches on value + keywords; put the human name AND key/id into `keywords` at call sites (cmdk uses value for identity, so value must be unique — use the id/key string). Item `onSelect` → close popover then `onValueChange(opt.value)`. Item layout: a fixed-width leading slot (size-4) containing lucide `Check` (size-3.5) only when `opt.value === value`, then the label in a `truncate min-w-0 flex-1` span. Reuse the shared CommandItem's row classes (rounded-sm px-2 py-1.5 text-sm, `data-selected:bg-muted`) minus its trailing check. Set `data-checked` on the selected item.
    Use cmdk's `Command` `loop` so arrow keys wrap; cmdk already provides ArrowUp/Down/Enter. Escape is handled by the Popover. Reset search by keeping the `CommandInput` value in local state cleared on close.
    Tests: render with ~4 options (e.g. Jira-like `{value:'PROJ', label:'PROJ — Project One', keywords:['PROJ','Project One']}` plus a GitLab-like one whose id only appears in value/keywords), use userEvent to open, type, ArrowDown+Enter, Escape, assert callbacks and the check testid. If cmdk throws in jsdom because `Element.prototype.scrollIntoView` is missing, add a no-op stub to `src/test/setup.ts` (check first: currently only ResizeObserver is mocked). Write tests first, then implement; single commit (pre-commit runs full suite).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/components/ui/searchable-select.test.tsx && npx biome check src/components/ui/searchable-select.tsx src/components/ui/searchable-select.test.tsx src/test/setup.ts</automated>
  </verify>
  <done>All behaviour tests pass; component exported; biome clean on touched files; committed as `feat(quick-261112-msr): add shared SearchableSelect`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fetch every page of GitLab projects and Jira boards</name>
  <files>taskflow/src/services/gitlab.ts, taskflow/src/services/gitlab.test.ts, taskflow/src/services/jira/sprints.ts, taskflow/src/services/jira/sprints.test.ts</files>
  <behavior>
    - listGitLabProjects: when page 1 returns 100 projects with header `X-Next-Page: 2` and page 2 returns 30 with empty `X-Next-Page`, result has 130 projects in order and exactly 2 requests were made, each with `&page=N`
    - listGitLabProjects: when `X-Next-Page` header is absent, stops when a page returns fewer than 100 items
    - listGitLabProjects: 401/403/other on ANY page throws the same errors as today (no silent partial list); existing single-page test still passes
    - listProjectBoards: page 1 `{values:[100 boards], isLast:false}`, page 2 `{values:[5], isLast:true}` → 105 boards; second request uses `startAt=100`
    - listProjectBoards: stops on `isLast:true`, on an empty `values` page, and after a hard cap of 20 pages; any failure still returns [] (existing contract)
  </behavior>
  <action>
    In `services/gitlab.ts` `listGitLabProjects`: keep the same query (`membership=true&per_page=100&order_by=last_activity_at&sort=desc`), add `&page=${page}` and loop: accumulate results, continue while `response.headers.get('X-Next-Page')` is non-empty, or — if the header is null — while the page length equals 100. Hard cap 50 pages. Keep the existing per-response error mapping (401 → ApiError 'Invalid token…', 403 → ApiError 'lacks required permissions', network → 'Cannot reach…') and apply it to every page. Do NOT change the return type or sort order.
    In `services/jira/sprints.ts` `listProjectBoards`: loop over `startAt` (0, then += values.length) with `maxResults=100`, accumulating mapped boards until `data.isLast === true`, `values` is empty, or 20 pages; keep `type=scrum` and the "any failure → []" contract. Edit `services/jira/sprints.ts` (the module JiraStep/ConnectionsSection import `listProjectBoards` from), not legacy jira.ts.
    Add tests for the behaviours above next to the existing ones (gitlab.test.ts `describe('listGitLabProjects')`; create `sprints.test.ts` cases for listProjectBoards if absent — mock `apiFetch`/global fetch the same way the existing file does). Tests first, then implementation, one commit.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/services/gitlab.test.ts src/services/jira/sprints.test.ts && npx biome check src/services/gitlab.ts src/services/gitlab.test.ts src/services/jira/sprints.ts src/services/jira/sprints.test.ts</automated>
  </verify>
  <done>Both fetchers return all pages; pagination tests pass; existing tests unchanged and green; committed as `fix(quick-261112-msr): paginate GitLab project and Jira board lists`.</done>
</task>

<task type="auto">
  <name>Task 3: Migrate all 7 project/board selectors to SearchableSelect</name>
  <files>taskflow/src/routes/settings/ConnectionsSection.tsx, taskflow/src/components/jira/BoardPicker.tsx, taskflow/src/routes/onboarding/JiraStep.tsx, taskflow/src/routes/onboarding/GitLabStep.tsx, taskflow/src/components/integrations/AioBlock.tsx, taskflow/src/components/integrations/ReleaseManagementBlock.tsx, taskflow/src/routes/settings/ConnectionsSection.test.tsx, taskflow/src/routes/onboarding/JiraStep.test.tsx, taskflow/src/components/integrations/AioBlock.test.tsx, taskflow/src/components/integrations/ReleaseManagementBlock.test.tsx, taskflow/src/routes/settings/IntegrationsSection.test.tsx, taskflow/src/routes/onboarding/IntegrationsStep.test.tsx</files>
  <action>
    Replace each `Select/SelectTrigger/SelectContent/SelectItem` block listed in the objective's call-site list with `SearchableSelect`, keeping the SAME `id` (so existing `<Label htmlFor>` and test selectors keep working), the same placeholder text, the same displayed label text, and the same `onValueChange` handler semantics. Remove now-unused `@/components/ui/select` imports per file. Option mapping:
    - Jira project (ConnectionsSection, JiraStep): value `project.key`, label `${key} — ${name}`, keywords `[key, name]`.
    - GitLab project (ConnectionsSection, GitLabStep): value `String(p.id)`, label = whatever text the site renders today (`name_with_namespace`), keywords `[String(p.id), p.name, p.path_with_namespace ?? '', p.name_with_namespace]` (check `GitLabProject` type for available fields); handler still parses the id back to number as today.
    - Board (BoardPicker multi-board branch only; single/zero-board branches unchanged): value `String(board.id)`, label `${name} (${id})`, keywords `[name, String(id)]`, `onValueChange={(v) => onChange(Number(v))}`.
    - AIO (AioBlock): value `p.projectKey`, label as today, keywords `[p.projectKey, p.name]`; the disabled empty-state Select at ~L113 becomes `<SearchableSelect disabled options={[]} … />` with the same placeholder text.
    - RM (ReleaseManagementBlock): keep the `NONE` sentinel as the first option (label "None", keywords ['None']), then `sorted` projects (value `p.key`, label `p.name`, keywords `[p.key, p.name]`); value `rmProjectKey ?? NONE`; handler unchanged; preserve the stale-key trigger fallback (`rmProjectKey` shown when not in list) via the component's placeholder or a `triggerLabel`.
    Do not change data fetching, gating (Continue buttons, IntegrationsStep Option A query), store writes, or layout around the pickers. Do NOT touch dead `TokenSection.tsx`. Per WIZARD_VERSION decision in objective: no bump.
    Tests: the listed test files currently drive these pickers through a mocked `@/components/ui/select` native `<select>` (fireEvent.change / selectOptions). Update the interactions for migrated pickers to the real component: click the trigger by id/label, then click the option by role `option` / text (optionally type in the search box first). Keep the mock only if a file still renders another real Select. Preserve every existing assertion's intent; if a test must change beyond interaction mechanics, note it in the SUMMARY. Add one assertion in ConnectionsSection.test.tsx that typing a project key into the Jira picker's search narrows the options.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && grep -L "SearchableSelect" src/routes/settings/ConnectionsSection.tsx src/components/jira/BoardPicker.tsx src/routes/onboarding/JiraStep.tsx src/routes/onboarding/GitLabStep.tsx src/components/integrations/AioBlock.tsx src/components/integrations/ReleaseManagementBlock.tsx | wc -l | grep -qx ' *0' && ! grep -n "from '@/components/ui/select'" src/components/jira/BoardPicker.tsx src/routes/onboarding/JiraStep.tsx src/routes/onboarding/GitLabStep.tsx src/components/integrations/AioBlock.tsx src/components/integrations/ReleaseManagementBlock.tsx && npx vitest run src/routes/settings src/routes/onboarding src/components/integrations src/components/jira && npx tsc --noEmit && npx biome check src/routes/settings/ConnectionsSection.tsx src/components/jira/BoardPicker.tsx src/routes/onboarding/JiraStep.tsx src/routes/onboarding/GitLabStep.tsx src/components/integrations/AioBlock.tsx src/components/integrations/ReleaseManagementBlock.tsx</automated>
    <human-check>In the app: Settings > Connections (Test Jira, Test GitLab) and Settings > Integrations, then re-run the wizard — each of the 5 pickers opens a search box, filters by name and key/id, shows a leading check on the current value, and "No matches" on garbage input.</human-check>
  </verify>
  <done>All 7 call sites render SearchableSelect with unchanged ids/handlers; no migrated file imports ui/select (ConnectionsSection may only if another Select remains); settings/onboarding/integrations/jira tests, tsc and biome pass; committed as `feat(quick-261112-msr): searchable project/board selectors in settings and wizard`.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira/GitLab/AIO API → UI | Project/board names from remote servers rendered as option labels |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-msr-01 | Tampering/XSS | SearchableSelect option labels | mitigate | Render labels as React text nodes only (no dangerouslySetInnerHTML); keywords are plain strings passed to cmdk |
| T-msr-02 | Denial of Service | Pagination loops in listGitLabProjects / listProjectBoards | mitigate | Hard page caps (50 / 20) and stop on empty page so a misbehaving server can't loop forever |
| T-msr-03 | Information Disclosure | PAT in paginated requests | accept | Same headers/apiFetch path as today; no new endpoints or logging |
</threat_model>

<verification>
- `npx vitest run` (full suite via pre-commit) green; `npx tsc --noEmit` clean; biome clean on touched files.
- `grep -rl "SearchableSelect" taskflow/src` lists the component plus the 6 consumer files.
- No WIZARD_VERSION change in `src/lib/onboarding-rerun.ts` (`git diff --stat` shows it untouched).
</verification>

<success_criteria>
- One shared SearchableSelect powers active Jira project, Jira board, GitLab project, AIO project and RM project pickers in both Settings and the wizard.
- Search matches name and key/id; keyboard navigation; leading check on selection; "No matches" empty state.
- GitLab project and Jira board lists are no longer capped at 100.
</success_criteria>

<output>
Create `.planning/quick/261112-msr-searchable-selectors-for-active-jira-pro/261112-msr-SUMMARY.md` when done
</output>
