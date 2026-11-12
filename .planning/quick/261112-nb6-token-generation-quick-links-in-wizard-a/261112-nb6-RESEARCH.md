# Quick 261112-nb6: Token-generation quick links (wizard + Settings) - Research

**Researched:** 2026-11-12
**Domain:** GitLab / Jira DC personal-access-token creation URLs; Tauri external links
**Confidence:** HIGH for GitLab prefill and Jira URL, MEDIUM for GitLab version edges

## Summary

GitLab supports prefilling the PAT form from the URL: `{base}/-/user_settings/personal_access_tokens?name=…&description=…&scopes=a,b`. It does **not** support prefilling the expiry. Jira Data Center has a stable deep link to the PAT tab (`{base}/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens`), but **nothing can be prefilled**. Jira PATs have no scopes; they inherit the user's permissions. So the Jira link opens the right page, and the app shows the suggested name and expiry as copyable hints.

The app writes to GitLab (PUT milestone, PUT MR, POST branch, POST milestone), so the GitLab scope must be **`api`**. `read_api` would break the release-management actions.

The app only sends `Authorization: Bearer <PAT>` to Jira, which Jira Cloud API tokens do not accept. The app therefore effectively supports **Jira Server/DC only**, so Cloud should not get a link.

**Primary recommendation:** Add one pure helper, `lib/token-links.ts`, with `gitlabTokenUrl(base)` and `jiraTokenUrl(base)`. Each returns `string | null`, and `null` hides the link. Add a small shared `TokenLinkHint` component that calls `openExternal`. Render it under the URL input in `JiraStep`, `GitLabStep` and the two `ConnectionsSection` cards. Do NOT touch `TokenSection.tsx`, which is dead code.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Build token-page URL from typed base URL | Client (pure lib fn) | — | Deterministic string work, unit-testable, no network |
| Open link in browser | Tauri opener via `lib/openExternal.ts` | — | Only sanctioned external-open boundary (honours browser preference) |
| Show/hide link + hint text | Client component | — | Reacts to live input state |

## Findings

### 1. GitLab PAT prefill URL

- **Path:** `/-/user_settings/personal_access_tokens`. The official example is `https://gitlab.example.com/-/user_settings/personal_access_tokens?name=Example+Access+token&description=My+description&scopes=api,read_user`. [CITED: docs.gitlab.com/user/profile/personal_access_tokens/]
- **Params:**
  - `name`: optional. If it is missing, the user has to type a name.
  - `description`: optional. The token description field was added in GitLab 17.7. On older versions the param is presumably ignored [ASSUMED].
  - `scopes`: comma-separated. **"The URL must include at least one valid scope."** [CITED: same page]
- **Expiry:** there is no documented URL param, so it can't be prefilled. If left blank, the expiry defaults to 365 days, and admins can lower the maximum. [CITED: same page]
- **Version history:** name/scopes prefill dates back to about GitLab 14.1. [CITED: search snippet of older docs; MEDIUM]
- **Old path:** older versions used `/-/profile/personal_access_tokens`. On GitLab 18.11.3 the old path returns **404, not a redirect**. [CITED: github.com/gitkraken/gk-ade/issues/4] The exact version of the move is unverified. My belief is about 16.x, with the redirect removed later [ASSUMED]. **Use only the `user_settings` path.** Instances older than about 16.x are out of scope; the user can still navigate there manually.
- **gitlab.com vs self-managed:** both use the same route and params, because the docs example is host-agnostic. [CITED]
- **Fine-grained PATs (GitLab 18.10 beta, 19.2 GA)** [CITED: about.gitlab.com/blog/fine-grained-pats/]:
  - The page now has a "Generate token" dropdown with "Legacy token" and "Fine-grained token". Current docs still document `name/description/scopes` prefill on this page, and legacy tokens "continue working as before".
  - Prefill for the fine-grained form (granular permissions) is **not documented**. Treat the link as a legacy-token prefill.
  - [ASSUMED / unverified]: whether a prefilled URL auto-opens the legacy form on 19.x, or the user must click "Generate token → Legacy token" first. Older issue gitlab-org/gitlab#421044 shows a past regression where the form needed manual expansion.
  - **Mitigation:** the hint line under the link should name the scope in plain text, e.g. "Scope: api". The user can then still complete the form if the prefill doesn't apply.

### 2. Minimum GitLab scope: `api`

Audit of `src/services/gitlab.ts` and `notifications.ts` [VERIFIED: codebase grep]:

- **Reads:** `/user`, `/users`, `/groups`, `/projects`, MRs (commits, approvals, discussions, changes, notes, pipelines), labels, milestones, branches, tags, compare, commits, `/search`, `/users/:id/events`. All of these are covered by `read_api`.
- **Writes**, which need `api`:
  - `PUT /projects/:id/milestones/:id` (gitlab.ts:1136)
  - `PUT /projects/:id/merge_requests/:iid` (1293)
  - `POST /projects/:id/repository/branches` (1407)
  - `POST /projects/:id/milestones` (1469)

  These are used by release-detail actions (`useReleaseDetail.ts`).
- **Conclusion:** `read_api` is read-only, so the writes would return 403. `scopes=api` is sufficient on its own, because `api` grants full read/write API access, including `/user` and email. [ASSUMED: api ⊇ read_user for GET /user. This is standard GitLab behaviour and already works today.] No `read_repository`, `write_repository` or `read_user` is needed: branches and tags are created through the REST API, not git.

### 3. Jira

- **PAT page (DC/Server 8.14+):** `{base}/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens`. It is widely used in third-party READMEs and on real instances. [CITED: github.com/jonnyhoff/jira-time; MEDIUM]
- **Official docs:** they describe only the navigation (Avatar → Profile → Personal access tokens) and give no UI URL. [CITED: confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html]
- **No newer DC 9.x/10.x path found.** Atlassian docs don't publish one. [Unverified negative]
- **Form fields:** name, plus optional "expire automatically after N days". **No URL prefill is documented or known.** The docs list no params, and the plugin servlet tab takes only `selectedTab`. [CITED: same confluence page; "not supported" is a negative claim based on absence of documentation]
- **Scopes:** none. A PAT "matches the user's current permission level". [CITED]
- **Admin limits:**
  - Max expiry is set by `atlassian.pats.max.tokens.expiry.days` (default 365).
  - `atlassian.pats.eternal.tokens.enabled` (default true) controls whether tokens without expiry are allowed.
  - Users are limited to 10 tokens each, with expired tokens counting. [CITED]
- **Cloud:**
  - Cloud uses `id.atlassian.com/manage-profile/security/api-tokens` with Basic `email:token`. Personal access tokens do not exist on Cloud.
  - `jira.ts` sends only `Bearer`. Its header comment claims Cloud supports Bearer PAT, which is **wrong** for API tokens [ASSUMED from Atlassian community answers, MEDIUM].
  - **Recommend:** do not offer a Cloud link. If the host ends in `.atlassian.net`, hide the link, or show "Jira Cloud isn't supported (needs a Server/Data Center PAT)". Planner's choice; hiding is the minimal option.
  - Side note: the `ConnectionsSection` Jira placeholder is `https://yourorg.atlassian.net`, which is misleading. The onboarding placeholder is `https://jira.example.com`. Optionally align it to `https://jira.example.com`.

### 4. Fallback UX for Jira (no prefill)

Show a link plus one muted hint line, for example:

> Create a token ↗ — Name it **Taskflow**; set an expiry per your org policy (max 365 days by default). No permissions to pick — the token acts as you.

Keep the name as one constant, `TOKEN_NAME = 'Taskflow'` (matches `tauri.conf.json` productName), and use it in both the GitLab URL and the Jira hint. A copy button for the name is optional; the name is short enough to type. Per user preferences: no toast, keep it inline, and keep it compact (one line under the URL field).

For GitLab, the hint is "Opens GitLab with name and `api` scope prefilled — pick an expiry."

### 5. Integration points [VERIFIED: codebase]

| File | URL state | Where link goes |
|---|---|---|
| `src/routes/onboarding/JiraStep.tsx` | `jiraUrl` from `useOnboardingStore` (live input) | Under the Jira URL `<Input>` / above the token field |
| `src/routes/onboarding/GitLabStep.tsx` | `gitlabUrl` from `useOnboardingStore` (live) | Same position |
| `src/routes/settings/ConnectionsSection.tsx` | `draftUrl` local `useState`, seeded from `initialBaseUrl` (live) in both `JiraConnectionCard` and the GitLab card | Under each URL input / beside the "Jira Token" / "GitLab Token" label |
| `src/routes/settings/TokenSection.tsx` | — | **Dead code, not imported** (confirmed; 261112-msr also left it untouched). Do not edit. |

- Derive the link from the **live** input (`jiraUrl` / `draftUrl`), not the saved `auth.store` base URL. The user hasn't saved yet when they need the token.
- **Open via `openExternal(url)`** from `@/lib/openExternal`. Never import `openUrl` directly; the module header mandates this. Render a `<button type="button">` styled as a link, not an `<a href>`, because the Tauri webview would navigate in-app.
- **Tests:** mock it with `vi.mock('@/lib/openExternal', …)`, as `DeploymentPackageWarning.test.tsx` and `DiscussionThreads.test.tsx` do.
- **AIO** (`IntegrationsStep`) reuses `jiraBaseUrl` with the stored Jira token and needs no separate token. Out of scope.

### 6. Pitfalls

1. **Context path:** the base may be `https://host/jira` or `https://host/gitlab`. Append to the path; never use `new URL('/secure/…', base)` with a leading slash, because that drops the context path. Pattern: `const b = new URL(input.trim()); const root = b.origin + b.pathname.replace(/\/+$/, ''); return root + '/-/user_settings/…'`. Also drop the incoming `search` and `hash`.
2. **Validation before showing:**
   - Return `null` unless `new URL()` parses and the protocol is `http:` or `https:`. This blocks `javascript:` and `file:`.
   - Also require a hostname containing a `.` or equal to `localhost`, so a half-typed `https://ji` doesn't flash a link. Debouncing is optional.
   - Do not require the user to have pressed Test first.
3. **Trailing slash / pasted page URL:** users often paste `https://jira.x.com/secure/Dashboard.jspa` or `https://gitlab.x.com/group/project`. Strip trailing slashes. Do not try to infer roots from deep paths. That is out of scope, and the services use the base as-is anyway.
4. **Encoding:** build the query with `URLSearchParams` (`name`, `description`, `scopes`). It encodes spaces as `+`, which matches the docs example. The comma in `scopes=api` is fine unencoded or as `%2C` (Rails splits after decoding) [ASSUMED]. Prefer setting `scopes` last, as a literal `api`.
5. **Jira selectedTab colon:** keep the literal `com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens`. If it goes through `URLSearchParams`, the colon becomes `%3A`, which Jira decodes fine [ASSUMED]. A string literal avoids the question entirely.
6. **Cloud host:** for `*.atlassian.net`, return `null` or the "unsupported" hint (see §3).
7. **Old GitLab (< ~16.x):** the `user_settings` path 404s there. This is accepted; a doc note is enough.

## Code Example (shape only)

```ts
// src/lib/token-links.ts
export const TOKEN_NAME = 'Taskflow';
function baseRoot(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.origin + u.pathname.replace(/\/+$/, '');
  } catch { return null; }
}
export function gitlabTokenUrl(raw: string): string | null {
  const root = baseRoot(raw); if (!root) return null;
  const q = new URLSearchParams({ name: TOKEN_NAME, description: 'Used by the Taskflow desktop app' });
  return `${root}/-/user_settings/personal_access_tokens?${q}&scopes=api`;
}
export function jiraTokenUrl(raw: string): string | null {
  const root = baseRoot(raw); if (!root) return null;
  if (new URL(root).hostname.endsWith('.atlassian.net')) return null;
  return `${root}/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens`;
}
```

## Validation Architecture

- **Framework:** vitest 4 (`npm test` in `taskflow/taskflow`). The pre-commit hook runs the full suite, so RED and GREEN go in one commit.
- **Unit tests, `src/lib/token-links.test.ts`:**
  - plain host
  - trailing slash
  - context path `/gitlab` and `/jira`
  - query/hash stripped
  - empty, garbage, `javascript:`, half-typed host → `null`
  - `.atlassian.net` → `null`
  - GitLab URL contains `scopes=api` and `name=Taskflow`
- **Component tests:**
  - extend `JiraStep.test.tsx` and `ConnectionsSection.test.tsx`; add a GitLabStep test if none exists
  - the link is hidden with an empty URL and shown after typing
  - clicking calls the mocked `openExternal` with the expected URL
- **Manual UAT:** click the GitLab link against the real self-managed instance and confirm the name and `api` are prefilled, plus whether the legacy form auto-opens. Click the Jira link and confirm the PAT tab opens.

## Security Domain

- V5 input validation: protocol allowlist (`http`/`https`) before opening, since the URL is user-typed.
- Least privilege: `api` is the minimum given the four write endpoints. Document why `read_api` is insufficient in the helper's comment.
- No secrets are involved; the link carries no token.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | `description` param ignored silently on GitLab < 17.7 | Low: cosmetic |
| A2 | Prefilled URL lands on/auto-opens the legacy form on GitLab 19.x | Medium: the user may need one extra click; the hint text covers it |
| A3 | `/-/profile/...` to `/-/user_settings/...` move happened around 16.x | Low: only very old instances are affected |
| A4 | Jira Cloud API tokens do not work with `Bearer` (app is DC-only) | Low: we only hide a link on Cloud |
| A5 | `%3A` / `%2C` encodings are accepted | None if string literals are used as in the example |

## Open Questions

1. On Cloud hosts: hide the link silently, or show "Cloud not supported"? Recommendation: hide (minimal), and fix the misleading `atlassian.net` placeholder.
2. Should the user's actual GitLab version be checked through UAT on their instance? Yes, because A2 is the only real unknown.

## Sources

- https://docs.gitlab.com/user/profile/personal_access_tokens/ — prefill params, 365-day default, legacy/fine-grained dropdown
- https://github.com/gitlabhq/gitlabhq/blob/master/doc/user/profile/personal_access_tokens.md — description added 17.7, no expiry param
- https://about.gitlab.com/blog/fine-grained-pats/ — fine-grained GA 19.2, legacy PATs keep working
- https://gitlab.com/gitlab-org/gitlab/-/work_items/421044 — past regression: form not auto-expanded with params
- https://gitlab.com/gitlab-org/gitlab/-/work_items/576129 — legacy form moving to a dedicated page (path unspecified)
- https://github.com/gitkraken/gk-ade/issues/4 — `/-/profile/personal_access_tokens` 404 on 18.11.3
- https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html — Jira PAT fields, 8.14+, expiry properties, no scopes
- https://github.com/jonnyhoff/jira-time — DC PAT page deep-link usage
