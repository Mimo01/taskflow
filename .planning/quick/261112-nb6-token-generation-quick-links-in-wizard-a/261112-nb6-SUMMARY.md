# Quick 261112-nb6: Token-generation quick links Summary

Jira and GitLab "Create a token" quick links now appear under the token field in the wizard (JiraStep, GitLabStep) and in both Settings → Connections cards, driven by the live URL input.

## Commits
- 00e07768: token-link builders (`lib/token-links.ts`) + shared `TokenLinkHint` component, with tests
- 1699bbc6: wiring into the four places, tests for JiraStep and ConnectionsSection

## Behaviour
- GitLab link: `{base}/-/user_settings/personal_access_tokens?name=Taskflow&description=…&scopes=api`; context path kept.
- Jira link: DC PAT tab deep link; hidden for `*.atlassian.net`. Hint gives the name and an expiry note.
- No link for empty, half-typed, or non-http(s) URLs. Opens through `openExternal` via a button.
- The Settings Jira placeholder changed from `https://yourorg.atlassian.net` to `https://jira.example.com`.
- `WIZARD_VERSION` unchanged; `TokenSection.tsx` untouched.

## Deviations
- Minor: the hint strings are exported as `JIRA_TOKEN_HINT` / `GITLAB_TOKEN_HINT` from `lib/token-links.ts` (not in the plan's file list entry for exports) so wizard and Settings share identical copy.
- No GitLabStep test file (per plan); GitLab path covered by the ConnectionsSection and unit tests.

## Pending UAT
Confirm the GitLab prefill (name and `api`, and whether the legacy form auto-opens) on the real instance, and that the Jira link opens the PAT tab.

## Self-Check: PASSED
