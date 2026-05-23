---
phase: quick-260518-jqh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira/issues.ts
  - taskflow/src/services/jira/types.ts
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
autonomous: true
requirements:
  - JQH-01  # Jira issue detail sidebar always shows Priority row
  - JQH-02  # Jira issue detail sidebar shows Severity row when customfield_13415 has a value

must_haves:
  truths:
    - "Opening any Jira issue detail always renders a Priority row in the sidebar (value or em-dash fallback)"
    - "Opening a Jira issue whose customfield_13415 (Severity) is populated renders a Severity row showing that value"
    - "Opening a Jira issue whose customfield_13415 is null/missing does NOT render a Severity row"
    - "Issue detail HTTP fetch requests the customfield_13415 field so severity is available in response"
  artifacts:
    - path: "taskflow/src/services/jira/issues.ts"
      provides: "fetchIssueDetail with customfield_13415 in the fields list"
      contains: "customfield_13415"
    - path: "taskflow/src/services/jira/types.ts"
      provides: "JiraIssueDetail.fields includes customfield_13415 optional shape"
      contains: "customfield_13415"
    - path: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
      provides: "Severity MetaRow rendered conditionally + Priority MetaRow with icon (iconUrl img) next to name"
      contains: "Severity"
  key_links:
    - from: "taskflow/src/services/jira/issues.ts (fetchIssueDetail)"
      to: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx (Severity MetaRow)"
      via: "JiraIssueDetail.fields.customfield_13415 flows from network response through useQuery cache into FieldsSection rendering"
      pattern: "customfield_13415"
---

<objective>
On the Jira issue detail page (sidebar) the Severity row is missing entirely and the Priority row is not consistently surfaced as a labeled meta row. Mirror the pattern already shipped on the AIO defects page (quick task 260518-jbe / 260518-joj) so that:

- Priority already renders as a MetaRow with the name text, but is **missing its icon**. The button content must show `priority.iconUrl` as a small `<img>` (w-3.5 h-3.5, like AioCycleDetailPage) next to the name. Em-dash fallback when null/no priority.
- Severity renders as a MetaRow when `customfield_13415` has a value (string from `.value` or `.name`), and is omitted when empty.

Purpose: Reporters and devs viewing a defect or story in TaskFlow need the same triage fields (with icons) they see on the AIO defects table.
Output: Updated `fetchIssueDetail` to request `customfield_13415`, type declaration on `JiraIssueDetail`, Priority icon added in FieldsSection, and a new Severity MetaRow in `FieldsSection` next to Priority.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260518-jbe-on-aio-cycle-detail-defects-page-also-sh/260518-jbe-SUMMARY.md
@.planning/quick/260518-joj-fix-severity-field-to-use-customfield-13/260518-joj-SUMMARY.md

@taskflow/src/services/jira/issues.ts
@taskflow/src/services/jira/types.ts
@taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
@taskflow/src/routes/dashboard/issue-detail/MetaRow.tsx
@taskflow/src/routes/dashboard/AioCycleDetailPage.tsx

<interfaces>
<!-- Severity field shape — already added to AioJiraIssueExtras in services/jira/types.ts during 260518-jbe; extend to JiraIssueDetail.fields the same way. -->

From taskflow/src/services/jira/types.ts (existing v1.8 pattern, lines ~55–58 on Aio interface):
```
reporter?: { displayName: string; name?: string; avatarUrls: { '48x48': string } } | null;
priority?: { name: string; iconUrl?: string } | null;
customfield_13415?: { value?: string; name?: string } | null;
```

From taskflow/src/routes/dashboard/AioCycleDetailPage.tsx (~lines 186–200) — severity extraction pattern to mirror:
- value = `fields.customfield_13415?.value ?? fields.customfield_13415?.name ?? null`
- Conditional render only when value truthy.

From taskflow/src/services/jira/issues.ts (~lines 352–408) — fetchIssueDetail builds a comma-joined `fields=` query. Add `customfield_13415` to the array; no other change needed.

From taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx (~lines 377–414) — existing Priority MetaRow already always renders with `'—'` fallback; only adjustment is to confirm it remains structurally a `<MetaRow label="Priority">` and that no `null`-issue-type gate hides it. Add the new Severity MetaRow immediately after the Priority block (before Assignee).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fetch + type customfield_13415 on JiraIssueDetail</name>
  <files>taskflow/src/services/jira/issues.ts, taskflow/src/services/jira/types.ts, taskflow/src/services/jira/issues.test.ts</files>
  <behavior>
    - Test: `fetchIssueDetail` request URL contains `customfield_13415` in the `fields=` query string.
    - Test: response parsing accepts `customfield_13415: { value: 'Major' }` without TypeScript widening to `unknown`-only — i.e. `JiraIssueDetail.fields.customfield_13415?.value` is accessible.
    - Existing tests (200/401/404 paths) continue to pass.
  </behavior>
  <action>
    In `taskflow/src/services/jira/issues.ts` `fetchIssueDetail`, append `'customfield_13415'` to the `fields` array (before the customFields spread or alongside the other hardcoded fields like `priority`). Do NOT add it via `customFields` argument — severity is a known stable customfield ID for this project (per D-260518-joj which fixed AIO defects to use customfield_13415).

    In `taskflow/src/services/jira/types.ts`, extend the `JiraIssueDetail.fields` shape (around line 138, before the `[key: string]: unknown` index signature) with:
    `customfield_13415?: { value?: string; name?: string } | null;`
    Match the exact shape already declared on the Aio-extras interface block (around line 58). Keep it optional so non-defect issue types that don't return the field do not break typing.

    In `taskflow/src/services/jira/issues.test.ts` add or extend a test in the `fetchIssueDetail` describe block asserting the request URL includes `customfield_13415`. Use the existing `apiFetch` mock pattern (capture first argument via `vi.mocked(apiFetch).mock.calls[0][1]` — the URL is arg index 1 per the existing pattern at line ~192/381). Do NOT introduce new mocks; reuse `customFields` fixture.
  </action>
  <verify>
    <automated>cd taskflow && npm test -- --run src/services/jira/issues.test.ts</automated>
  </verify>
  <done>fetchIssueDetail URL contains `customfield_13415`; JiraIssueDetail type exposes customfield_13415 with `{ value?, name? } | null`; all jira/issues tests pass; tsc has zero new errors.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add priority icon + Severity MetaRow to FieldsSection</name>
  <files>taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx, taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx</files>
  <behavior>
    - Test: When `issue.fields.priority = { name: 'High', iconUrl: 'http://example.com/icon.svg' }`, FieldsSection renders both the icon img and the "High" text inside the priority button.
    - Test: When `issue.fields.priority = { name: 'High' }` (no iconUrl), the "High" text still renders without any img.
    - Test: When `issue.fields.customfield_13415 = { value: 'Major' }`, FieldsSection renders a row with label "Severity" and text "Major".
    - Test: When `issue.fields.customfield_13415 = { name: 'Minor' }` (no `.value`), the row renders "Minor" (mirrors AioCycleDetailPage extraction order: `.value ?? .name`).
    - Test: When `issue.fields.customfield_13415 = null` or undefined, NO row with label "Severity" is rendered.
    - Existing FieldsSection tests, if any, remain green.
  </behavior>
  <action>
    **Priority icon fix:** Inside the existing priority `<button>` (the non-editing branch, around line 407-411), replace the bare `{f.priority?.name ?? '—'}` with a flex row that mirrors `AioCycleDetailPage.tsx` lines 172-180:
    ```tsx
    <div className="flex items-center gap-1.5">
      {f.priority?.iconUrl && (
        <img src={f.priority.iconUrl} alt="" className="w-3.5 h-3.5 shrink-0" />
      )}
      <span>{f.priority?.name ?? '—'}</span>
    </div>
    ```
    Do NOT change the edit-mode Select branch, the mutation logic, or the MetaRow wrapper — only the display-mode button contents change.

    **Severity MetaRow:** Immediately AFTER the existing Priority `MetaRow` block (closing around line 414) and BEFORE the Assignee MetaRow, add a new conditional Severity MetaRow:
    - Compute `severityValue` once: `f.customfield_13415?.value ?? f.customfield_13415?.name ?? null`
    - Render `<MetaRow label="Severity">{severityValue}</MetaRow>` only when severityValue is a non-empty string. Row must be entirely absent when empty.
    - Use existing `MetaRow` component; keep it plain text (no icon needed for severity).

    Create `FieldsSection.test.tsx` if it does not exist using the project's existing React Testing Library + Vitest pattern (see neighboring `IssueDetailSheet.test.tsx` and `AioCycleDetailPage.test.tsx` for setup: `renderWithProviders`-style helpers, `apiFetch` mock, QueryClientProvider wrapper). Mock `useFieldMutation` minimally (it returns a `useMutation` result; passing an object with `isPending: false`, `isError: false`, `mutate: vi.fn()` is sufficient — match the shape currently destructured). Stub `useAuthStore`, `useSettingsStore`, `useBoardId`, and `apiFetch` so the component renders without network or store wiring.

    If creating the test file is non-trivial because of deep store/query coupling, instead add focused tests by extracting the severity-extraction logic into a small pure helper (e.g. `extractSeverity(field): string | null` in the same FieldsSection file or `./utils.ts`) and test the helper directly plus a single React render assertion that the row appears/does not appear given a hand-built `issue` fixture mirroring the shape used in `IssueDetailSheet.test.tsx`.
  </action>
  <verify>
    <automated>cd taskflow && npm test -- --run src/routes/dashboard/issue-detail/FieldsSection.test.tsx && npm run lint -- --quiet src/routes/dashboard/issue-detail/FieldsSection.tsx</automated>
  </verify>
  <done>FieldsSection renders priority icon (iconUrl img) next to name in the edit button; Severity row rendered only when customfield_13415 has a value; all targeted tests pass; lint and tsc clean.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Jira issue detail sidebar now shows: (1) Priority row with its colored icon next to the name, (2) Severity row when the issue has `customfield_13415` populated. The detail fetch also requests `customfield_13415`.</what-built>
  <how-to-verify>
    1. Run `cd taskflow && npm run tauri dev` (or use the running dev session).
    2. Open any Jira issue. Confirm the "Priority" row shows the priority icon (small colored img, e.g. red arrow for Critical) to the left of the priority name.
    3. Open a Jira defect with a Severity set (the same kind visible on the AIO defects page after 260518-joj). Confirm "Severity" row appears with the value.
    4. Open a Jira issue with NO severity (a story or task). Confirm the "Severity" row is entirely absent.
    5. Open DevTools Network, refresh an issue detail, confirm the request URL contains `customfield_13415`.
  </how-to-verify>
  <resume-signal>Type "approved" if all four checks pass, otherwise describe which check failed and the observed behavior.</resume-signal>
</task>

</tasks>

<verification>
- `cd taskflow && npm test` — full suite passes (no regressions in IssueDetailSheet, AioCycleDetailPage, or jira/issues tests).
- `cd taskflow && npm run lint` — zero new warnings/errors in the three modified files.
- `cd taskflow && npx tsc --noEmit` — clean.
- Human visual check passes (checkpoint Task 3).
</verification>

<success_criteria>
1. `fetchIssueDetail` HTTP request includes `customfield_13415` in the `fields=` query.
2. `JiraIssueDetail.fields.customfield_13415` is typed as `{ value?: string; name?: string } | null | undefined`.
3. Issue detail sidebar shows `Severity: <value>` MetaRow when customfield_13415 has `.value` or `.name`; no Severity row otherwise.
4. Issue detail sidebar Priority MetaRow shows the `iconUrl` icon img next to the name; em-dash fallback when no priority; no regression to the click-to-edit Select.
5. All targeted tests green, lint and tsc clean, human verification approved.
</success_criteria>

<output>
On completion, create `.planning/quick/260518-jqh-jira-issue-detail-doesnt-show-priority-a/260518-jqh-SUMMARY.md` using the standard quick-task summary template (mirror the structure of `260518-joj-SUMMARY.md` and `260518-jbe-SUMMARY.md`).
</output>
