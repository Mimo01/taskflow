---
phase: quick-260607-mhc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/standup-notes/effectiveIdentity.ts
  - taskflow/src/routes/standup-notes/effectiveIdentity.test.ts
  - taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx
  - taskflow/src/routes/standup-notes/StandupPageHeader.tsx
  - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
  - taskflow/src/routes/standup-notes/TodayColumn.tsx
autonomous: true
requirements: [STANDUP-WATCH-01]
must_haves:
  truths:
    - "Standup page header shows a subtle 'Showing: <name> ▼' picker defaulting to the logged-in user"
    - "Selecting a watched Jira person refetches and rerenders both Yesterday and Today columns for that person"
    - "Yesterday commits use best-effort name matching (watched displayName fed as gitlabName); empty if no git match is acceptable"
    - "When a watched person is selected, all gitlabUserId-keyed sections (MR events, reviewer MRs, participating MRs) render empty with a 'not matched' hint and NEVER show the logged-in user's MRs"
    - "Reopening / remounting the page resets the watched person back to the logged-in user"
  artifacts:
    - path: "taskflow/src/routes/standup-notes/effectiveIdentity.ts"
      provides: "Pure resolveEffectiveIdentity(authIdentity, watchedUser) mapping helper + EffectiveIdentity type"
      exports: ["resolveEffectiveIdentity", "EffectiveIdentity"]
    - path: "taskflow/src/routes/standup-notes/effectiveIdentity.test.ts"
      provides: "Unit tests asserting watched mapping sets gitlabUserId=null and feeds displayName as gitlabName"
    - path: "taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx"
      provides: "Subtle header dropdown reusing MentionPopover debounce + server-side fetchAssignableUsers pattern"
      exports: ["default"]
  key_links:
    - from: "taskflow/src/routes/standup-notes/StandupNotesPage.tsx"
      to: "effectiveIdentity.ts#resolveEffectiveIdentity"
      via: "compute effectiveIdentity from auth store + watchedUser state"
      pattern: "resolveEffectiveIdentity"
    - from: "taskflow/src/routes/standup-notes/StandupNotesPage.tsx"
      to: "TodayColumn.tsx"
      via: "pass effective gitlabUserId (null when watched) + jiraUserDisplayName as props"
      pattern: "gitlabUserId=\\{"
    - from: "taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx"
      to: "services/jira/users.ts#fetchAssignableUsers"
      via: "server-side &username= filtered query, debounced term in queryKey"
      pattern: "fetchAssignableUsers"
---

<objective>
Add a subtle "watched person" picker to the standup notes page header. By default the page shows the logged-in user's standup (unchanged behavior). Selecting another Jira person re-derives the entire standup for them — Yesterday (tempo, jira activity, commits, MR events) and Today (sprint filter, reviewer MRs, participating MRs) — by threading an "effective identity" through the existing react-query keys so a switch triggers a fresh fetch.

A watched person carries only `{ displayName, name, key?, avatarUrls? }` — no GitLab numeric ID. Commit matching is best-effort by display name (empty if unmatched = OK). All `gitlabUserId`-keyed sections render empty with a subtle "not matched" hint and MUST NEVER fall back to the logged-in user's `gitlabUserId`. Selection is transient React state, reset on every mount.

Purpose: Let a user peek at a teammate's standup without leaving the page or persisting a mode.
Output: One pure identity helper (unit-tested), one picker component, and wiring across StandupPageHeader, StandupNotesPage, and TodayColumn.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260607-mhc-standup-watched-person-picker/260607-mhc-CONTEXT.md
@.planning/quick/260607-mhc-standup-watched-person-picker/260607-mhc-RESEARCH.md

# Identity-threading targets (read before editing)
@taskflow/src/routes/standup-notes/StandupNotesPage.tsx
@taskflow/src/routes/standup-notes/TodayColumn.tsx
@taskflow/src/routes/standup-notes/StandupPageHeader.tsx

# Picker pattern to copy + data source
@taskflow/src/routes/dashboard/MentionPopover.tsx
@taskflow/src/services/jira/users.ts
@taskflow/src/services/jira/types.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Effective-identity helper (unit-tested) + WatchedPersonPicker component</name>
  <files>taskflow/src/routes/standup-notes/effectiveIdentity.ts, taskflow/src/routes/standup-notes/effectiveIdentity.test.ts, taskflow/src/routes/standup-notes/WatchedPersonPicker.tsx</files>
  <behavior>
    resolveEffectiveIdentity tests (effectiveIdentity.test.ts):
    - Test 1 (me / watchedUser=null): returns the auth identity unchanged — all 7 fields (jiraUsername, jiraUserKey, jiraUserDisplayName, gitlabUserId, gitlabUsername, gitlabName, gitlabEmail) equal the passed auth values.
    - Test 2 (watched user): jiraUsername = watchedUser.name, jiraUserKey = watchedUser.key ?? null, jiraUserDisplayName = watchedUser.displayName, gitlabName = watchedUser.displayName.
    - Test 3 (watched user critical guard): gitlabUserId === null, gitlabUsername === null, gitlabEmail === null — regardless of what the auth identity holds (verify it does NOT inherit the auth gitlabUserId).
    - Test 4 (isWatched flag): result exposes a boolean (e.g. isWatched) that is false for null watchedUser, true otherwise — used by UI to show the "not matched" hint.
  </behavior>
  <action>
    Create `effectiveIdentity.ts` exporting an `EffectiveIdentity` interface (fields: jiraUsername, jiraUserKey, jiraUserDisplayName all string|null; gitlabUserId number|null; gitlabUsername, gitlabName, gitlabEmail string|null; isWatched boolean) and a pure function `resolveEffectiveIdentity(auth, watchedUser)` where `auth` is the subset of auth-store fields and `watchedUser: JiraAssignableUser | null` (import type from `@/services/jira/types`). When watchedUser is null, return `{ ...auth, isWatched: false }`. When watchedUser is set, map per the field table in RESEARCH.md: name→jiraUsername, key??null→jiraUserKey, displayName→jiraUserDisplayName, displayName→gitlabName, and gitlabUserId/gitlabUsername/gitlabEmail all forced to null, isWatched: true. This is the silent-fallback guard (Pitfall 3) — NEVER reference auth.gitlabUserId in the watched branch. Write the four tests first (RED), then implement (GREEN).

    Create `WatchedPersonPicker.tsx` by copying the MentionPopover query pattern (do NOT reuse MentionPopover directly — it is a textarea-anchored mention listbox). Props: `{ value: JiraAssignableUser | null, meDisplayName: string, jiraBaseUrl: string, projectKey: string | null, onSelect: (u: JiraAssignableUser | null) => void }`. Render a subtle trigger styled like the YesterdayColumn date dropdown (group-hover-revealed ChevronDown, opacity-0 → group-hover:opacity-60, `text-xs text-muted-foreground`) showing `Showing: {value?.displayName ?? meDisplayName}`. Use the shadcn DropdownMenu (`@/components/ui/dropdown-menu`) for the popover container. Inside: a search input bound to local `query` state, debounce 200ms into `debouncedQuery` (copy the MentionPopover effect exactly), and a `useQuery` with key `['standup', 'watched-user-search', jiraBaseUrl, projectKey, debouncedQuery]`, queryFn reading the token via `readSecret('jira-pat')` INSIDE the queryFn (T-62-06: never in key) and calling `fetchAssignableUsers(jiraBaseUrl, token, projectKey, debouncedQuery)` — server-side `&username=` filtering, NO client-side `.filter()` (Pitfall 2). Gate `enabled: !!jiraBaseUrl && !!projectKey` (A1). Render rows with `CachedAvatar` + displayName like MentionPopover. Include a top "Me ({meDisplayName})" row that calls `onSelect(null)`. Selecting any user calls `onSelect(user)`.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/standup-notes/effectiveIdentity.test.ts && npm run check</automated>
  </verify>
  <done>effectiveIdentity.test.ts passes all 4 tests (especially the gitlabUserId===null guard); WatchedPersonPicker.tsx compiles and type-checks; `npm run check` (biome + tsc) is clean.</done>
</task>

<task type="auto">
  <name>Task 2: Lift effective identity into StandupNotesPage and mount picker in header</name>
  <files>taskflow/src/routes/standup-notes/StandupNotesPage.tsx, taskflow/src/routes/standup-notes/StandupPageHeader.tsx</files>
  <action>
    In `StandupNotesPage.tsx`: add `const [watchedUser, setWatchedUser] = useState<JiraAssignableUser | null>(null);` (transient — reset on mount per locked decision, do NOT persist). Compute `const id = resolveEffectiveIdentity({ jiraUsername, jiraUserKey, jiraUserDisplayName, gitlabUserId, gitlabUsername, gitlabName, gitlabEmail }, watchedUser);` after the auth-store reads. Replace every use of the raw auth identity fields in the FOUR page queries + schedule query + referencedKeys/copy-markdown with the corresponding `id.*` field:
    - schedule queryKey/queryFn jiraUserKey → `id.jiraUserKey`
    - tempo queryKey/queryFn jiraUsername → `id.jiraUsername`
    - jiraActivity queryKey/queryFn jiraUsername → `id.jiraUsername`
    - commits queryKey/queryFn gitlabUsername/gitlabName/gitlabEmail → `id.gitlabUsername`/`id.gitlabName`/`id.gitlabEmail`
    - mrEvents queryKey/queryFn/enabled gitlabUserId → `id.gitlabUserId` (so a watched person → null → query auto-disables via existing `!!gitlabUserId` guard; Pitfall 3)
    - handleCopyMarkdown: pass `id.gitlabUserId` to `todayQueryKeys.reviewerMrs`/`participatingMrs` and `id.jiraUserDisplayName` to `generateTodayMarkdown` (Pitfall 5)
    IMPORTANT: keep the gitlabName/gitlabEmail self-heal backfill effect keyed on the AUTH-STORE values (it heals the logged-in user's own profile), not on `id.*`. Pass effective identity to TodayColumn via new props: `watchedGitlabUserId={id.gitlabUserId}`, `watchedDisplayName={id.jiraUserDisplayName}`, `isWatched={id.isWatched}` (Task 3 consumes these). Render `<WatchedPersonPicker>` by passing the new props down through `StandupPageHeader`.

    In `StandupPageHeader.tsx`: extend props with `watchedUser: JiraAssignableUser | null`, `meDisplayName: string`, `jiraBaseUrl: string`, `projectKey: string | null`, `onSelectWatched: (u: JiraAssignableUser | null) => void`. Render `<WatchedPersonPicker>` in the right-side action group, to the LEFT of the sync-status span / Refresh button, so the affordance sits subtly before the existing controls.
  </action>
  <verify>
    <automated>cd taskflow && npm run check && grep -n "id.gitlabUserId" src/routes/standup-notes/StandupNotesPage.tsx | grep -v '^[0-9]*:.*//' | head -1</automated>
  </verify>
  <done>`npm run check` clean; mrEvents query uses `id.gitlabUserId` (verified present); picker renders in header; switching person in the picker changes the page query keys (tempo/jira/commits/mr-events) and triggers refetch.</done>
</task>

<task type="auto">
  <name>Task 3: Thread effective identity into TodayColumn + "not matched" hint</name>
  <files>taskflow/src/routes/standup-notes/TodayColumn.tsx</files>
  <action>
    `TodayColumn` currently self-sources `gitlabUserId` and `jiraUserDisplayName` from `useAuthStore()` (Pitfall 4). Add three props to `TodayColumnProps`: `watchedGitlabUserId: number | null`, `watchedDisplayName: string | null`, `isWatched: boolean`. Use `watchedGitlabUserId` in place of the auth-store `gitlabUserId` for the reviewer-mrs and participating-mrs query keys/queryFns/enabled guards — when a watched person is selected this is null, the existing `enabled: ... && !!gitlabUserId` guards disable both queries (no fallback to the logged-in user's MRs; Pitfall 3). Use `watchedDisplayName` in place of the auth-store `jiraUserDisplayName` for the client-side `filterSprintItems` call (the sprint query key itself need not change — it fetches the whole sprint and filters client-side; Pitfall 1). Keep reading `jiraBaseUrl`, `gitlabBaseUrl`, `activeJiraProject`, `storyPointsFieldKey` from the stores as before.

    Add a subtle "not matched" hint: when `isWatched && !watchedGitlabUserId && gitlabBaseUrl`, render a muted-text line (e.g. `text-xs text-muted-foreground`) above/within the MR sections area such as "GitLab account not matched for {watchedDisplayName} — MRs hidden." Keep copy/styling consistent with existing muted-text patterns (Claude's discretion per CONTEXT). Do NOT render the reviewer/participating MR sections' normal empty/loading UI in a way that implies they belong to me.
  </action>
  <verify>
    <automated>cd taskflow && npm run check && npx vitest run src/routes/standup-notes/TodayColumn.test.tsx</automated>
  </verify>
  <done>`npm run check` clean; TodayColumn accepts watched props and uses watchedGitlabUserId for both MR queries; when watched + no gitlabUserId, MR sections are empty and the "not matched" hint shows; existing TodayColumn tests pass (update test props if the new required props break them).</done>
</task>

</tasks>

<verification>
- `cd taskflow && npm run check` is fully GREEN (biome + tsc) — project baseline.
- `cd taskflow && npx vitest run src/routes/standup-notes/` passes (new effectiveIdentity tests + existing standup tests).
- Manual smoke (executor self-check, no human gate): default load shows logged-in user; picker search returns server-filtered Jira users; selecting a teammate refetches Yesterday + Today; MR sections show the "not matched" hint and no MRs; selecting "Me" restores own data; reload resets to me.
</verification>

<success_criteria>
- Picker is present in the standup header, subtle, defaults to me (truth 1).
- Switching person refetches and rerenders both columns via effective-identity-keyed queries (truth 2).
- Commits use best-effort displayName matching; empty when unmatched is accepted (truth 3).
- gitlabUserId-keyed sections are empty + hinted and NEVER show the logged-in user's MRs when a watched person is selected (truth 4 — the critical correctness guard, enforced by resolveEffectiveIdentity forcing gitlabUserId=null and unit-tested).
- Selection is transient React state; remount resets to me (truth 5).
</success_criteria>

<output>
Create `.planning/quick/260607-mhc-standup-watched-person-picker/260607-mhc-SUMMARY.md` when done.
</output>
