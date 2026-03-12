---
phase: quick-8
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/stores/onboarding.store.ts
  - taskflow/src/routes/onboarding/RoleStep.tsx
  - taskflow/src/routes/settings/RoleSection.tsx
  - taskflow/src/components/app/Sidebar.tsx
autonomous: true
requirements: [QUICK-8]

must_haves:
  truths:
    - "User can select 'Tech Lead' role in onboarding"
    - "User can select 'Tech Lead' role in settings"
    - "Tech Lead sidebar shows Developer section (My Tasks, Sprint Board, MR Attention) and PM section (Sprint Progress, Workload, Releases) simultaneously"
    - "Existing developer and pm roles are unchanged"
  artifacts:
    - path: "taskflow/src/stores/settings.store.ts"
      provides: "Role type union expanded to include 'tech-lead'"
      contains: "'developer' | 'pm' | 'tech-lead'"
    - path: "taskflow/src/stores/onboarding.store.ts"
      provides: "Onboarding role type expanded to include 'tech-lead'"
      contains: "'developer' | 'pm' | 'tech-lead'"
    - path: "taskflow/src/routes/onboarding/RoleStep.tsx"
      provides: "Third radio option for Tech Lead in onboarding wizard"
      contains: "tech-lead"
    - path: "taskflow/src/routes/settings/RoleSection.tsx"
      provides: "Third radio option for Tech Lead in settings"
      contains: "tech-lead"
    - path: "taskflow/src/components/app/Sidebar.tsx"
      provides: "Tech Lead nav branch with both Developer and PM sections"
      contains: "role === 'tech-lead'"
  key_links:
    - from: "RoleStep.tsx"
      to: "useSettingsStore().setRole"
      via: "handleValueChange cast"
      pattern: "tech-lead"
    - from: "RoleSection.tsx"
      to: "useSettingsStore().setRole"
      via: "onValueChange cast"
      pattern: "tech-lead"
    - from: "Sidebar.tsx"
      to: "useSettingsStore().role"
      via: "role === 'tech-lead' branch"
      pattern: "role === 'tech-lead'"
---

<objective>
Add a "Tech Lead" role that exposes all pages from both the Developer role and PM role in a dual-section sidebar layout.

Purpose: Allow Tech Leads to access My Tasks, Sprint Board, MR Attention, Sprint Progress, Workload, and Releases from a single role without switching.
Output: Five files updated — type definitions, onboarding step, settings section, and sidebar.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/8-add-a-new-role-with-access-to-all-featur/8-CONTEXT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Expand role type in stores</name>
  <files>taskflow/src/stores/settings.store.ts, taskflow/src/stores/onboarding.store.ts</files>
  <action>
    In `settings.store.ts`:
    - Change `role: 'developer' | 'pm' | null` to `role: 'developer' | 'pm' | 'tech-lead' | null` in the `SettingsState` interface (line 34).
    - Change `setRole: (role: 'developer' | 'pm') => void` to `setRole: (role: 'developer' | 'pm' | 'tech-lead') => void` in the interface (line 50).
    - Change the `setRole` implementation parameter type to match: `(role: 'developer' | 'pm' | 'tech-lead')`.

    In `onboarding.store.ts`:
    - Change `role: 'developer' | 'pm' | null` to `role: 'developer' | 'pm' | 'tech-lead' | null` in the `OnboardingState` interface (line 22).
  </action>
  <verify>npx tsc --noEmit -p taskflow/tsconfig.json 2>&1 | grep -E "settings.store|onboarding.store" || echo "No type errors in stores"</verify>
  <done>Both store files compile without type errors; role union includes 'tech-lead' in both files.</done>
</task>

<task type="auto">
  <name>Task 2: Add Tech Lead option to onboarding and settings role pickers</name>
  <files>taskflow/src/routes/onboarding/RoleStep.tsx, taskflow/src/routes/settings/RoleSection.tsx</files>
  <action>
    In `RoleStep.tsx`:
    - Change `handleValueChange` signature from `(value: 'developer' | 'pm')` to `(value: 'developer' | 'pm' | 'tech-lead')`.
    - Change the `onValueChange` cast from `v as 'developer' | 'pm'` to `v as 'developer' | 'pm' | 'tech-lead'`.
    - Add a third radio option after the PM option:
      ```tsx
      <div className="flex items-center space-x-3 border border-border rounded-lg p-4 cursor-pointer hover:bg-accent">
        <RadioGroupItem value="tech-lead" id="role-tech-lead" />
        <Label htmlFor="role-tech-lead" className="cursor-pointer flex-1">
          <span className="font-medium">Tech Lead</span>
          <p className="text-sm text-muted-foreground">Access all developer and PM views</p>
        </Label>
      </div>
      ```

    In `RoleSection.tsx`:
    - Change the `onValueChange` cast from `v as 'developer' | 'pm'` to `v as 'developer' | 'pm' | 'tech-lead'`.
    - Add a third radio option after the PM option:
      ```tsx
      <div className="flex items-center space-x-3 border border-border rounded-lg p-3 cursor-pointer hover:bg-accent">
        <RadioGroupItem value="tech-lead" id="settings-role-tech-lead" />
        <Label htmlFor="settings-role-tech-lead" className="cursor-pointer">
          Tech Lead
        </Label>
      </div>
      ```
  </action>
  <verify>npx tsc --noEmit -p taskflow/tsconfig.json 2>&1 | grep -E "RoleStep|RoleSection" || echo "No type errors in role pickers"</verify>
  <done>Both role picker files compile without type errors and contain the 'tech-lead' radio option.</done>
</task>

<task type="auto">
  <name>Task 3: Add Tech Lead sidebar branch with dual-section nav</name>
  <files>taskflow/src/components/app/Sidebar.tsx</files>
  <action>
    In `Sidebar.tsx`, extend the `Work section (role-specific)` block:

    1. Change the outer condition from `(role === 'developer' || role === 'pm')` to `(role === 'developer' || role === 'pm' || role === 'tech-lead')`.

    2. Replace the existing section label from a single "Work" heading to a conditional: show "Work" for developer/pm (as today), and for tech-lead show two labeled sub-sections. The updated nav block should be:

    ```tsx
    {(role === 'developer' || role === 'pm' || role === 'tech-lead') && (
      <div className="mt-2">
        {/* Developer and PM roles: single "Work" label */}
        {(role === 'developer' || role === 'pm') && (
          <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:block">
            Work
          </p>
        )}

        {/* Developer role links */}
        {(role === 'developer' || role === 'tech-lead') && (
          <>
            {role === 'tech-lead' && (
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:block">
                Developer
              </p>
            )}
            <Link to="/my-tasks" className={NAV_LINK_CLASS}>
              <CheckSquare className="h-4 w-4 shrink-0" />
              <span className="hidden md:block">My Tasks</span>
            </Link>
            <Link to="/sprint-board" className={NAV_LINK_CLASS}>
              <KanbanSquare className="h-4 w-4 shrink-0" />
              <span className="hidden md:block">Sprint Board</span>
            </Link>
            <Link to="/mr-attention" className={NAV_LINK_CLASS}>
              <GitMerge className="h-4 w-4 shrink-0" />
              <span className="hidden md:block">MR Attention</span>
            </Link>
          </>
        )}

        {/* PM role links */}
        {(role === 'pm' || role === 'tech-lead') && (
          <>
            {role === 'tech-lead' && (
              <p className="px-3 py-1 mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:block">
                PM
              </p>
            )}
            <Link to="/sprint-progress" className={NAV_LINK_CLASS}>
              <BarChart2 className="h-4 w-4 shrink-0" />
              <span className="hidden md:block">Sprint Progress</span>
            </Link>
            <Link to="/workload" className={NAV_LINK_CLASS}>
              <Users className="h-4 w-4 shrink-0" />
              <span className="hidden md:block">Workload</span>
            </Link>
            <Link to="/releases" className={NAV_LINK_CLASS}>
              <Tag className="h-4 w-4 shrink-0" />
              <span className="hidden md:block">Releases</span>
            </Link>
          </>
        )}
      </div>
    )}
    ```

    No changes to the bottom section (debug logs, settings). No changes to the Dashboard link.
  </action>
  <verify>npx tsc --noEmit -p taskflow/tsconfig.json 2>&1 | grep -E "Sidebar" || echo "No type errors in Sidebar"</verify>
  <done>Sidebar compiles without type errors; role === 'tech-lead' branch exists showing both Developer and PM link sections with labeled headings.</done>
</task>

</tasks>

<verification>
Run full TypeScript check across the project:

```bash
cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit
```

Expected: zero type errors introduced by this change. Pre-existing errors (confirmed out-of-scope) are acceptable.
</verification>

<success_criteria>
- `'developer' | 'pm' | 'tech-lead'` union present in settings.store.ts and onboarding.store.ts
- Three radio options rendered in RoleStep.tsx (onboarding) and RoleSection.tsx (settings)
- Sidebar shows "Developer" section + "PM" section simultaneously when role === 'tech-lead'
- Developer role behavior unchanged (shows single "Work" label + 3 developer links)
- PM role behavior unchanged (shows single "Work" label + 3 PM links)
- No new TypeScript compilation errors
</success_criteria>

<output>
After completion, create `.planning/quick/8-add-a-new-role-with-access-to-all-featur/8-SUMMARY.md`
</output>
