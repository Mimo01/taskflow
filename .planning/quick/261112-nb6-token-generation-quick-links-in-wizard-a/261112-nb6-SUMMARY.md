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

## Follow-up (UAT): GitLab fine-grained token

User asked for the GitLab link to open a fine-grained token, not legacy. Commit 84f84140.

- Link now opens `{base}/-/user_settings/personal_access_tokens/granular/new` (route from GitLab `config/routes/user_settings.rb`; GitLab ≥ 18.10, GA 19.2).
- That form reads no prefill params. `granular_new` takes none, and the Vue form reads only `source_token_id` for duplicating a token. So there's no prefill: the hint names the token, says to allow all groups/projects, and lists the permissions as a checklist (`TokenLinkHint` gained an optional `details` prop).
- Permissions were derived by mapping every GitLab endpoint in services/gitlab.ts + notifications.ts against docs `fine_grained_access_tokens_rest.md`. All are covered. Read: Project, Group, Merge Request, Branch, Commit, Repository, Repository Tag, Label, Work Item, Event, User (instance-level User Read needed for GET /users search). Update: Merge Request, Work Item (milestones are Work Item). Create: Branch, Work Item. Use: Global Search.

**Decision (UAT):** reverted in `HEAD` (revert of 84f84140). The user chose to keep the prefilled legacy link and to add fine-grained once GitLab supports prefill on `granular/new` (tracking: gitlab-org/gitlab#572290). The permission mapping above stays valid for that future change.

**Final (UAT approved):** hint copy removed entirely — the UI shows only the "Create a token ↗" link (b1f813f3 shortened it, 9076b4c4 dropped it). `TokenLinkHint` takes just `url`.
