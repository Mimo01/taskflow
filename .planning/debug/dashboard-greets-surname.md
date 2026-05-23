---
slug: dashboard-greets-surname
status: resolved
trigger: "on dashboard it greets with surname instead of firstname"
created: 2026-05-23
updated: 2026-05-23
---

# Dashboard Greets With Surname Instead of Firstname

## Symptoms

<!-- DATA_START -->
- **Expected behavior:** Dashboard greeting should display user's first name (e.g., "Hello, Jane")
- **Actual behavior:** Dashboard greeting displays user's surname/last name instead
- **Error messages:** None reported
- **Timeline:** Not specified by user
- **Reproduction:** Visit dashboard view
<!-- DATA_END -->

## Current Focus

- hypothesis: RESOLVED — see Resolution below
- test: vitest src/routes/dashboard/index.test.tsx — 10/10 pass
- expecting: greeting shows "Jane" not "DOE"
- next_action: none

## Evidence

- timestamp: 2026-05-23T17:04:00Z | finding: Dashboard greeting tokenizer uses tokens[0] (first whitespace-split token). Code comment assumes "Firstname Surname" format.
- timestamp: 2026-05-23T17:04:10Z | finding: All setJiraUser call sites pass user.displayName as first arg — store mapping is correct.
- timestamp: 2026-05-23T17:04:20Z | finding: Inspected ~/Library/Application Support/com.taskflow.app/auth.json — jiraUserDisplayName is "DOE Jane ACME (ext.)" — Jira Server on-prem (jira.orange.sk) returns displayName in SURNAME Firstname OrgCode (status) format.
- timestamp: 2026-05-23T17:04:30Z | finding: tokens[0] of "DOE Jane ACME (ext.)" is "DOE" — the surname — explaining the bug exactly.

## Eliminated

- hypothesis: argument order swap in setJiraUser calls | why_eliminated: all call sites confirmed correct (displayName first, name second)
- hypothesis: wrong field from Jira API | why_eliminated: validateJira returns data.displayName; the field is correct, the format is not what the tokenizer assumed

## Resolution

- root_cause: The Jira Server instance at jira.orange.sk returns displayName in "SURNAME Firstname OrgCode (status)" format (e.g. "DOE Jane ACME (ext.)"). The dashboard tokenizer assumed "Firstname Surname" order and took tokens[0], which is the all-caps surname.
- fix: Changed firstName extraction from tokens[0] to tokens.find(t => t !== t.toUpperCase()) ?? tokens[0] — prefers the first mixed-case token (the given name) over any all-uppercase token (surname or org code). Also extended the strip filter to remove parenthesized (X) tokens alongside existing [X] bracket stripping.
- verification: vitest run — 10/10 pass including new Test 9 reproducing "DOE Jane ACME (ext.)" and Test 10 covering "[Disabled]" stripping.
- files_changed: taskflow/src/routes/dashboard/index.tsx, taskflow/src/routes/dashboard/index.test.tsx
