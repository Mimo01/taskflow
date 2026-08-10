---
phase: 82
slug: my-tasks-page
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-15
---

# Phase 82 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Phase 82 (My Tasks page) is a **read-only personal-task viewer** over already-authenticated
Jira/GitLab data. It introduces no new authentication, no new write endpoints, and (after the
UAT hardening) no new persistence. The threat register below was authored at plan time across
plans 82-01…82-05 and verified against the implementation.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → Jira REST search | New JQL search queries for All-Assigned / All-Reported scopes | Issue data, scoped to the current user (assignee/reporter = currentUser()) |
| app → system clipboard | "Copy issue key" / "Copy link" row actions | Non-sensitive issue key + public `${jiraBaseUrl}/browse/${key}` URL |
| reused: LogWorkPopover → Jira | Existing, already-validated worklog write path (unchanged) | Worklog duration (validated by parseDuration in the reused component) |
| ~~app → Tauri Store (my-tasks.json)~~ | **Eliminated during UAT** — scope is now transient component state; the persisted store was deleted | (none — no on-disk persistence) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-82-01 | Information Disclosure | my-tasks-sort.ts | accept | Pure in-memory transform over data already on the client; no new egress, persistence, or logging | closed |
| T-82-02 | Information Disclosure | my-tasks persisted store | mitigate→eliminated | UAT removed scope persistence entirely; `my-tasks.store.ts` deleted, scope is local `useState`. No issue data, PII, or tokens ever persisted (verified: no `my-tasks.json` / `useMyTasksStore` refs remain) | closed |
| T-82-03 | Tampering | my-tasks.json on-disk file | accept→moot | File no longer written (store removed). Original acceptance (local-disk tampering = broader compromise) no longer applicable | closed |
| T-82-04 | Information Disclosure | fetchAllAssignedHierarchy JQL | mitigate | JQL hard-codes `assignee = currentUser()` (jira.ts:669); no assignee param accepted from UI (verified: none in MyTasksPage.tsx) | closed |
| T-82-05 | Denial of Service | fetchAllSearchPages full pagination | accept | Unbounded page count is the explicit D-06 requirement; PAGE_SIZE=200 + react-query staleTime:30s bound practical cost for a single authenticated desktop user | closed |
| T-82-06 | Information Disclosure | clipboard copy actions | accept | Only the issue key and public browse URL are copied — no credentials, no issue body; data already on screen | closed |
| T-82-07 | Tampering / Input Validation | LogWorkPopover (reused) | transfer | Worklog duration validation owned by the existing, already-tested LogWorkPopover (parseDuration); unchanged here | closed |
| T-82-08 | Information Disclosure | My Tasks data render | mitigate | Page renders only what the currentUser-scoped service functions return; sprint grouping reads already-fetched fields client-side and adds no broadening query (verified) | closed |
| T-82-09 | Spoofing / Tampering | client-side route registration | accept | SPA route is local to the already-authenticated desktop app; Jira PAT still gates all data; no server-side authz bypassed | closed |
| T-82-10 | Information Disclosure | fetchAllReportedHierarchy JQL (added during UAT) | mitigate | New All-Reported scope hard-codes `reporter = currentUser()` (jira.ts:739); no reporter param accepted from UI. Same mitigation pattern as T-82-04 | closed |
| T-82-SC | Tampering | npm/pip/cargo installs | mitigate | Zero new packages across the phase — `git diff 049f6807..HEAD -- taskflow/package.json` is empty (verified) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-82-01 | T-82-05 | Unbounded pagination is the explicit D-06 product requirement; cost is bounded by PAGE_SIZE + staleTime for a single desktop user | Milan Mozolak | 2026-06-15 |
| AR-82-02 | T-82-06 | Clipboard copies only non-sensitive identifiers already visible on screen | Milan Mozolak | 2026-06-15 |
| AR-82-03 | T-82-09 | Client-side SPA route bypasses no server authz; Jira PAT gates all data | Milan Mozolak | 2026-06-15 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-15 | 11 | 11 | 0 | gsd-secure-phase (orchestrator-verified) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-15
