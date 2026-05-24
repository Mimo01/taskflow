---
phase: 69
slug: standup-notes-route-yesterday-recap
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-25
---

# Phase 69 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Tauri webview → Jira Server (apiFetch) | Outbound authenticated JQL search + per-issue changelog/comment fetch | Jira PAT (Bearer), internally-computed date, project key |
| Tauri webview → GitLab API (apiFetch) | Outbound authenticated commit + MR-event fetch | GitLab PAT (PRIVATE-TOKEN), numeric project/user IDs, date window |
| Tauri webview → Tempo API (apiFetch) | Outbound authenticated worklog + schedule fetch | Jira PAT, date range, user key |
| internally-computed date → JQL/URL string | `resolveYesterdayDate()` output interpolated into JQL + query params | Fixed YYYY-MM-DD string (never user-typed) |
| API response → issue-grouping join → DOM | Untrusted external strings (commit messages, MR titles, Jira summaries) rendered as React children | Third-party text content |
| navigator.clipboard | User-initiated Copy markdown of the assembled standup summary | User's own activity summary |
| Route registration → router | `/standup-notes` exposed to all users (post-ROLES-06 universal-access) | No sensitive write action |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-69-01 | Tampering | JQL injection via `date` in `fetchYesterdayJiraActivity` | mitigate | `date` from `resolveYesterdayDate()` (local components, never user input); full JQL `encodeURIComponent`-encoded (`jira.ts:906-909`) | closed |
| T-69-02 | Information Disclosure | Jira PAT leak | mitigate | Token only in `Authorization: Bearer` header; from `readSecret('jira-pat')`; never in queryKey/returned objects/logs; redacted in dev-log (`apiFetch.ts:85-86`) | closed |
| T-69-03 | Denial of Service | Per-issue Jira comment fetch fan-out | accept | `maxResults=50` cap + per-issue `try/catch` graceful degradation (`jira.ts:909,956-973`) | closed |
| T-69-04 | Tampering | URL param injection via date/since/until in `fetchUserCommits` | mitigate | `date` internally computed; since/until `encodeURIComponent`-encoded; numeric IDs from auth store (`gitlab.ts:1116-1118`) | closed |
| T-69-05 | Information Disclosure | GitLab PAT leak | mitigate | Token only in `PRIVATE-TOKEN` header; from `readSecret('gitlab-pat')`; never in queryKey; redacted in dev-log (`gitlab.ts:1127,1203`) | closed |
| T-69-06 | Denial of Service | GitLab events API fan-out | accept | Exactly two `Promise.allSettled` requests (commented + approved), each `per_page=100`; failures isolated (`gitlab.ts:1210`) | closed |
| T-69-07 | Elevation of Privilege | `/standup-notes` reachable without role gate | accept | Post-ROLES-06 universal-access model; no sensitive write action in route shell | closed |
| T-69-08 | Information Disclosure | Clipboard placeholder (Plan 03) | accept | Superseded by T-69-12; shipped code writes real summary inside `try/catch` (`StandupNotesPage.tsx:285`) | closed |
| T-69-09 | Information Disclosure | Tokens leaking via React Query queryKey cache | mitigate | T-62-06: no `jiraToken`/`gitlabToken` in any of the six queryKey arrays; `enabled` gates on `!!token`; fresh token inside queryFn | closed |
| T-69-10 | Tampering | XSS via commit message / MR title / Jira summary | mitigate | Zero `dangerouslySetInnerHTML`/`innerHTML` across all six standup-notes components; external strings are auto-escaped React children | closed |
| T-69-11 | Denial of Service | One slow/failing source blocking the page | mitigate | Four independent `useQuery` hooks with isolated error/loading states; per-source ErrorState/Skeleton (`StandupNotesPage.tsx:143-213`, `YesterdayColumn.tsx:492-573`) | closed |
| T-69-12 | Information Disclosure | Clipboard content (issue keys / comment snippets) | accept | User-initiated Copy markdown; content is the user's own activity summary (`StandupNotesPage.tsx:272-292`) | closed |
| T-69-SC | Tampering | npm/cargo supply-chain (new installs) | mitigate | Zero dependency files touched by Phase 69 commits; `navigator.clipboard` used natively; `tech_stack.added: []` | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-69-01 | T-69-03 | Daily standup volume is low; per-issue `try/catch` + `maxResults=50` cap + `getJiraLimit()` bounded concurrency limit the blast radius | mimopn@gmail.com | 2026-05-25 |
| AR-69-02 | T-69-06 | Bounded to two parallel requests (commented + approved), each `per_page=100`; `Promise.allSettled` isolates per-request failure | mimopn@gmail.com | 2026-05-25 |
| AR-69-03 | T-69-07 | Post-ROLES-06 universal-access model — all routes visible to all authenticated users by design; no sensitive write action exposed by the standup shell | mimopn@gmail.com | 2026-05-25 |
| AR-69-04 | T-69-08 | Plan 03 empty-string clipboard placeholder superseded in Plan 04 by T-69-12 (real summary, user-initiated); intermediate state not present in shipped code | mimopn@gmail.com | 2026-05-25 |
| AR-69-05 | T-69-12 | Clipboard write is explicitly user-initiated via the Copy markdown button; content is the user's own activity summary assembled for standup use; no background/automatic access | mimopn@gmail.com | 2026-05-25 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-25 | 13 | 13 | 0 | gsd-security-auditor (sonnet) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-25
