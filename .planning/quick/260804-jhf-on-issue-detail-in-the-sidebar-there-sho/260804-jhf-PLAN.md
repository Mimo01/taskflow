---
phase: quick-260804-jhf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx
autonomous: false
requirements: [QUICK-260804-JHF]

must_haves:
  truths:
    - "Issue detail sidebar shows a 'Deployment package' row directly below the 'Fix Versions' row"
    - "The row displays the value of customfield_15725 for issues that have it set"
    - "The row renders an em-dash placeholder (no crash) when customfield_15725 is absent, null, or an empty array"
  artifacts:
    - path: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
      provides: "extractDeploymentPackage helper + Deployment package MetaRow"
      contains: "extractDeploymentPackage"
    - path: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx"
      provides: "Unit coverage for extractDeploymentPackage value shapes"
      contains: "extractDeploymentPackage"
    - path: "taskflow/src/services/jira.ts"
      provides: "customfield_15725 declared on JiraIssueDetail['fields']"
      contains: "customfield_15725"
  key_links:
    - from: "taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx"
      to: "issue.fields.customfield_15725"
      via: "direct field read passed to extractDeploymentPackage"
      pattern: "customfield_15725"
---

<objective>
Add a read-only "Deployment package" field to the issue detail sidebar, rendered
directly under the existing "Fix Versions" row, sourced from Jira custom field
`customfield_15725`.

Purpose: users need the deployment package visible alongside fix version without
opening Jira.
Output: new pure extractor + MetaRow in `FieldsSection.tsx`, typed field on
`JiraIssueDetail`, unit tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
@taskflow/src/routes/dashboard/issue-detail/MetaRow.tsx
@taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx

Key facts established by investigation (do not re-derive):
- `fetchIssueDetail` (taskflow/src/services/jira.ts:1658) requests
  `?fields=*navigable,attachment`, so `customfield_15725` is ALREADY present in
  the response payload when the field is navigable. No fetch/service change is
  required beyond the type declaration.
- `FieldsSection.tsx` is the single sidebar field renderer, consumed by
  `issue-detail/IssueDetailSidebar.tsx` (used by both the detail page and the
  peek sheet). Editing it covers every sidebar surface.
- Precedent for a read-only custom field: the Severity block at
  `FieldsSection.tsx:688-696` — a pure exported extractor (`extractSeverity`,
  line 61) plus a `<MetaRow>`. Mirror that shape exactly.
- The Fix Versions `<MetaRow label="Fix Versions">` block ends at
  `FieldsSection.tsx:1051`; the Flagged block starts at line 1052.
- `MetaRow` signature: `({ label, children }: { label: string; children: React.ReactNode })`.
- `JiraIssueDetail['fields']` has an index signature (`[key: string]: unknown`)
  plus explicit optional custom-field entries such as
  `customfield_13415?: { value?: string; name?: string } | null` (jira.ts:1514).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add extractDeploymentPackage pure helper with tests</name>
  <files>taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx, taskflow/src/routes/dashboard/issue-detail/FieldsSection.test.tsx</files>
  <behavior>
    extractDeploymentPackage(field: unknown): string | null
    - `'PKG-1'` (plain string) -> `'PKG-1'`
    - `{ value: 'PKG-1' }` -> `'PKG-1'`
    - `{ name: 'PKG-1' }` -> `'PKG-1'`
    - `{ value: 'A', name: 'B' }` -> `'A'` (value wins, matching extractSeverity)
    - `[{ value: 'A' }, { name: 'B' }]` -> `'A, B'` (multi-select shapes joined)
    - `['A', 'B']` -> `'A, B'`
    - `[]` -> `null`
    - `null` / `undefined` / `{}` / `''` -> `null`
  </behavior>
  <action>
    Export a pure function `extractDeploymentPackage` from
    `FieldsSection.tsx`, placed immediately after the existing
    `extractSeverity` helper (around line 65), with a short doc comment noting
    it reads `customfield_15725`. Accept `unknown` because the real Jira value
    shape for this field is unconfirmed — handle string, single option object
    with `value`/`name`, and arrays of either, trimming and dropping empty
    entries, joining survivors with `', '`. Return `null` for every
    non-representable input rather than throwing. Do not add any mutation /
    edit affordance — this field is display-only.

    Add a `describe('extractDeploymentPackage')` block in
    `FieldsSection.test.tsx` next to the existing `extractSeverity` describe
    (line 187), covering every case listed in `<behavior>`. Import the helper
    from `./FieldsSection` alongside the existing `extractSeverity` import.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard/issue-detail/FieldsSection.test.tsx</automated>
  </verify>
  <done>All extractDeploymentPackage cases pass; no changes to extractSeverity behavior.</done>
</task>

<task type="auto">
  <name>Task 2: Render Deployment package row under Fix Versions and type the field</name>
  <files>taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx, taskflow/src/services/jira.ts</files>
  <action>
    In `jira.ts`, add to `JiraIssueDetail['fields']` (next to
    `customfield_13415` at line 1514) an explicit optional entry:
    `customfield_15725?: unknown;` with a one-line comment "Deployment package
    (project-specific custom field; shape unconfirmed — read via
    extractDeploymentPackage)". Keep it `unknown` so consumers must go through
    the extractor.

    In `FieldsSection.tsx`, insert a new `<MetaRow label="Deployment package">`
    immediately after the closing `</MetaRow>` of the Fix Versions block
    (currently line 1051) and before the Flagged block. Read
    `f.customfield_15725`, pass it through `extractDeploymentPackage`, and
    render the result as plain text. Unlike Severity, ALWAYS render the row
    (the request is for a visible field under fix version): when the extractor
    returns `null`, render an em-dash `—` wrapped in
    `className="text-muted-foreground"`. Give the value span
    `data-testid="deployment-package-value"` so UI assertions can target it.
    No popover, no click handler, no mutation wiring.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard/issue-detail/ &amp;&amp; npm run check</automated>
  </verify>
  <done>Row renders between Fix Versions and Flagged; biome + tsc clean; existing issue-detail tests still pass.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>A read-only "Deployment package" sidebar row under Fix Versions, sourced from customfield_15725 via a shape-tolerant extractor.</what-built>
  <how-to-verify>
    1. Run the app (`npm run tauri dev` in `taskflow/`, or the dev flow already in use).
    2. Open an issue that is known to have a Deployment package set in Jira.
    3. Confirm the sidebar shows "Deployment package" directly BELOW "Fix Versions"
       and ABOVE "Flagged", and that the displayed text matches what Jira shows
       for that issue (not `[object Object]`, not a raw JSON blob).
    4. Open an issue with no deployment package and confirm the row shows "—".
    If the value renders as `[object Object]` or is blank on an issue that has a
    value, report the raw payload shape so the extractor can be extended.
  </how-to-verify>
  <resume-signal>Type "approved" or paste the raw customfield_15725 value that failed to render</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira REST → renderer | Untrusted/unvalidated custom-field payload of unknown shape enters the UI |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-jhf-01 | Denial of Service | FieldsSection render path | mitigate | extractDeploymentPackage accepts `unknown` and returns `null` for every unhandled shape; never throws, so a surprise payload cannot blank the sidebar |
| T-jhf-02 | Information disclosure | Deployment package row | accept | Field content is already visible to the same user in Jira; rendered as plain text (React auto-escapes), no HTML/wiki interpretation |
| T-jhf-SC | Tampering | package installs | accept | No new dependencies added by this plan |
</threat_model>

<verification>
- `npx vitest run src/routes/dashboard/issue-detail/` passes
- `npm run check` (biome + tsc) clean
- `grep -n "customfield_15725" taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx taskflow/src/services/jira.ts` returns hits in both files
- Human verification of real Jira data confirms the rendered value
</verification>

<success_criteria>
- "Deployment package" row appears between Fix Versions and Flagged in the issue
  detail sidebar (both full page and peek sheet, since both use FieldsSection)
- Value from customfield_15725 renders as readable text; missing value renders "—"
- No new network requests (field already arrives via `fields=*navigable`)
- Biome + tsc baseline stays GREEN
</success_criteria>

<output>
Create `.planning/quick/260804-jhf-on-issue-detail-in-the-sidebar-there-sho/260804-jhf-SUMMARY.md` when done
</output>
