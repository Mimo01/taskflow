# Domain Pitfalls

**Domain:** Cross-platform developer/PM dashboard — on-premise Jira REST API v2 + GitLab integration
**Researched:** 2026-03-10
**Confidence:** HIGH (Jira Server API, GitLab API, PAT security) / MEDIUM (cross-platform packaging, notification reliability)

---

## Critical Pitfalls

Mistakes that cause rewrites or major regressions.

---

### Pitfall 1: Assuming Jira Cloud API Docs Apply to On-Premise (Server/DC)

**What goes wrong:** Jira Cloud and Jira Server/Data Center REST APIs diverge significantly. Developers reference Jira Cloud docs (the default on developer.atlassian.com), build against them, and then hit 404s or wrong field shapes when connecting to the team's old on-premise instance.

**Why it happens:** Atlassian's main developer portal defaults to Cloud. Server API docs are under a separate path (`/server/jira/platform/rest/`). The APIs share many endpoints but differ in:
- Authentication headers: Cloud uses `Authorization: Basic email:api_token` or OAuth; Server uses `Authorization: Basic username:password` or Bearer PAT depending on version
- Field names: Cloud uses `accountId` for user references; Server uses `name` (username) — a breaking difference for any user-lookup, assignee filtering, or mention parsing
- Workflow transition IDs: Cloud numeric IDs are globally unique; Server transition IDs are **per-issue** (same transition name can have different IDs on different issue types — you cannot cache them globally)
- Pagination: Cloud uses cursor-based pagination with `nextPageToken` on some endpoints; Server v2 uses offset-based `startAt` + `maxResults` + `total` throughout — consistently, but differently
- Notification/activity endpoints: Cloud has a richer activity stream API; old Server instances may have no `/rest/activity` endpoint or return empty

**Consequences:** Auth fails silently (returns 200 with a "logged out" HTML page instead of JSON), user lookups break, workflow transitions fail on edge-case issue types, pagination code misses results.

**Prevention:**
- Pin documentation to the Server REST API v2 spec from day one: `{jira-base-url}/rest/api/2/` prefix for all calls
- Test PAT auth with `Authorization: Bearer <token>` header first; fall back to Basic if the instance version is old (pre-7.x)
- Never cache workflow transition IDs globally — always fetch transitions per issue before transitioning
- Use `name` (not `accountId`) for all user-reference fields on Server

**Detection:**
- Auth returning an HTML page with status 200 (login redirect) instead of JSON
- `accountId` field missing from user objects in API responses
- `GET /rest/api/2/myself` returning unexpected shape

**Phase:** Authentication + Jira API integration (earliest phases)

---

### Pitfall 2: Storing PATs in Plaintext in App Config or localStorage

**What goes wrong:** Personal access tokens for both Jira and GitLab are stored as plaintext in a config file, environment variable, or browser localStorage. On a desktop app, this means tokens live unencrypted on disk. On a web app, they are trivially readable by any JavaScript on the page.

**Why it happens:** It's the path of least resistance — store the token, read it back. No key management needed.

**Consequences:** Any process with filesystem access (malware, other apps, backup tools) can exfiltrate both tokens. On macOS/Windows, the system keychain exists specifically for this. localStorage is readable by any extension or injected script.

**Prevention:**
- On Electron/Tauri desktop: use the OS keychain (`keytar` for Electron, Tauri's `keyring` plugin) for token storage. Never write tokens to `app.getPath('userData')` config files.
- On web app: store tokens only in `sessionStorage` (cleared on tab close) if keychain is unavailable; never `localStorage`. Display a clear warning that tokens are held in memory only.
- Treat tokens exactly like passwords in UX — masked input, no copy-to-clipboard of the full token after save.
- Scope PATs to minimum required permissions at setup time (document this in onboarding).

**Detection:**
- Config file in `~/.config/` or `AppData` contains token strings
- `localStorage.getItem` returns a token string in browser console

**Phase:** Auth/credentials setup (Phase 1) — must be correct before anything else is built on top

---

### Pitfall 3: Polling Too Aggressively and Getting Blocked or Hammering the Server

**What goes wrong:** The app polls Jira and GitLab on short intervals (e.g., every 5–10 seconds) across all active data sets simultaneously. On GitLab.com this triggers rate-limit 429 responses. On old on-premise Jira, the underpowered server slows to a crawl under the load, affecting the whole team.

**Why it happens:** Dashboards feel more live with shorter intervals. Developers test against their own account and don't notice the aggregate load.

**Consequences:** GitLab rate limit (typically 300 req/min per user on GitLab.com, lower on self-hosted with default config) causes 429 errors with a `Retry-After` header that, if ignored, leads to longer bans. Old on-premise Jira servers have no rate limiting but have finite capacity — polling every 5s from multiple tabs/instances is a denial-of-service against the team.

**Prevention:**
- Default polling intervals: no faster than 60s for background data (sprint board, MR list); 30s only for notification-critical paths
- Implement exponential backoff on any 4xx/5xx — do not retry immediately
- Respect `Retry-After` header on 429 responses (GitLab sends this)
- Check `X-RateLimit-Remaining` response header from GitLab before each batch and pause if below threshold
- Use a single poll coordinator (not per-component polling) so adding more dashboard widgets doesn't multiply API calls
- On Jira Server, prefer JQL queries that return multiple issues in one call over N individual issue fetches

**Detection:**
- HTTP 429 responses in network tab
- Jira admin complaints about server slowness
- App console logging repeated failed requests

**Phase:** Data fetching layer (early — architecture decision before feature work)

---

### Pitfall 4: Task-to-MR Linking Breaks on Ticket Number Variations

**What goes wrong:** The linking logic parses `PROJ-123` from MR titles and commit messages, but the regex doesn't handle the full range of real-world variations the team actually uses. Edge cases are missed silently — no link is shown but no error is reported.

**Why it happens:** Developers test the happy path (`[PROJ-123] Fix login bug`), not the full range of real commit/MR title formats used over years.

**Consequences:** MRs appear unlinked on the dashboard; developers complain the feature "doesn't work" and lose trust in the whole app.

**Real variations to handle:**
- Leading format: `PROJ-123`, `[PROJ-123]`, `(PROJ-123)`, `feat/PROJ-123`, `PROJ-123:`, `proj-123` (lowercase project key)
- Multiple tickets in one MR title: `PROJ-123 PROJ-456 fix thing`
- Ticket in branch name (GitLab exposes source branch): `feature/PROJ-123-some-description`
- Ticket in commit message body, not subject line
- Project key with digits: `AB2C-99` (project key is not always pure alpha)
- Ticket IDs in MR description (not just title)

**Prevention:**
- Regex must be case-insensitive and anchor on word boundaries: `/\b([A-Z][A-Z0-9]+-\d+)\b/gi`
- Search title, branch name, AND description for MRs
- Search commit subject AND body for commit-based linking
- Write a test suite of 20+ real MR title formats from the team's history before shipping
- Show "linked tickets" in the UI even if unresolvable (display the ticket key even if the Jira fetch fails), so the link is visible even when Jira is down

**Detection:**
- QA pass: manually check 10 recent MRs — count how many are correctly linked vs missed
- Log unmatched MR titles during development to discover new patterns

**Phase:** Task-MR linking feature (dedicated phase) — test corpus must be gathered from real GitLab history before building

---

### Pitfall 5: Desktop OS Notifications Silently Fail on Some OSes

**What goes wrong:** Desktop notifications work fine on the developer's macOS machine during development but silently fail for Windows users (notification permission not granted, focus assist/do not disturb mode) and Linux users (no notification daemon or wrong D-Bus service).

**Why it happens:** The Web Notifications API (in Electron/Tauri webview) or native notification APIs behave differently across platforms. macOS grants permission on first ask; Windows requires the app to be registered and the user to have not globally blocked it; Linux depends on the desktop environment.

**Consequences:** Core feature (unified notifications hub, in-app badges) silently doesn't work for a subset of users who then have no indication of new activity.

**Prevention:**
- Always call `Notification.requestPermission()` at app startup and handle `denied` state gracefully — show an in-app banner explaining how to re-enable, don't just silently degrade
- Test on Windows 10/11 with Focus Assist on AND off during development
- On Linux, test on at least GNOME and KDE (different notification backends)
- Fall back to in-app badge + sound for all notification events, regardless of OS notification status — the in-app path is the reliable path; OS notifications are a bonus
- Use Electron's `Notification` class (not `window.Notification`) for consistent cross-platform behavior in desktop builds — it wraps the native API more reliably than the web API

**Detection:**
- Test matrix: macOS, Windows 11, Ubuntu GNOME before each release
- Add a "test notification" button in settings during development

**Phase:** Notifications hub (dedicated phase) — platform testing matrix must be defined before shipping

---

## Moderate Pitfalls

---

### Pitfall 6: Jira Workflow Transition IDs Are Not Portable

**What goes wrong:** Developer fetches transition IDs from one issue type (e.g., Story) and hardcodes them. Bug issues or Sub-task issues have different workflow configurations with different transition IDs for the same logical state change ("In Progress", "Done").

**Why it happens:** On-premise Jira allows different workflows per issue type and per project scheme. Most Cloud usage has uniform workflows; Server installations from large orgs often don't.

**Prevention:**
- Always call `GET /rest/api/2/issue/{issueKey}/transitions` before showing transition options for a specific issue
- Display transition names from the response (not hardcoded labels) so they match what users see in Jira
- Never cache transition IDs across issue types

**Phase:** Jira task actions feature

---

### Pitfall 7: Jira JQL Returns Inconsistent Field Sets Without `fields` Parameter

**What goes wrong:** JQL search results return a large but inconsistent set of fields depending on the Jira version, project config, and custom fields. Parsing issue objects without specifying `fields` leads to `undefined` errors when a field is absent on some issue types.

**Prevention:**
- Always pass `?fields=summary,status,assignee,priority,issuetype,fixVersions,comment,updated` (or whatever the app needs) on every JQL search call
- Never assume a field exists — always use optional chaining when reading response fields
- Custom fields (like story points) use `customfield_XXXXX` keys that are instance-specific — document how to discover and configure the correct key at setup

**Phase:** Jira data fetching layer (early)

---

### Pitfall 8: GitLab Pagination Not Fully Traversed

**What goes wrong:** The app fetches the first page of MRs (default 20, max 100) and displays them, silently missing MRs on page 2+. Sprint boards with active work look incomplete.

**Why it happens:** GitLab returns `X-Next-Page` and `X-Total-Pages` headers. Developers miss this.

**Prevention:**
- For list endpoints (MRs, issues), always check `X-Next-Page` header and paginate until exhausted OR implement cursor-based UI (load more / virtual scroll)
- For the notifications hub use-case, fetch the first 2 pages on initial load, then rely on delta polling (only fetch items newer than last-seen timestamp using `updated_after` parameter)
- Set `per_page=100` to minimize round trips

**Phase:** GitLab data fetching layer (early)

---

### Pitfall 9: CORS Blocks All Direct API Calls from a Web App

**What goes wrong:** If Taskflow is built as a web app (browser-based), all Jira Server and GitLab API calls will be blocked by CORS unless the server has been explicitly configured to allow the app's origin. Old on-premise Jira instances almost certainly have not.

**Why it happens:** CORS is a browser security mechanism. Electron/Tauri desktop apps don't have this problem (no browser same-origin policy in the main process). Web apps do.

**Consequences:** Zero API calls work from a pure browser app against the on-premise Jira server. The entire architecture fails unless a proxy is introduced.

**Prevention:**
- If building a web app: ship a lightweight local proxy (Node.js sidecar, browser extension, or self-hosted backend) that forwards requests and adds CORS headers
- Prefer Electron or Tauri desktop packaging — this completely eliminates CORS as an issue since API calls happen in the Node/Rust layer, not in the browser renderer
- Validate this constraint against the team's Jira server config before committing to a web-only architecture

**Detection:**
- First API call in the browser throws `Cross-Origin Request Blocked` in console

**Phase:** Architecture decision (pre-development) — must be resolved before any feature work

---

### Pitfall 10: PAT Expiry Has No Recovery UX

**What goes wrong:** The app stores tokens on setup. Three months later, a GitLab PAT expires. All API calls start returning 401. The app shows a generic error or breaks silently. Users don't know what's wrong.

**Why it happens:** Token expiry is an afterthought during initial development.

**Prevention:**
- On any 401 response, surface a clear "Your [Jira/GitLab] token has expired or is invalid — re-enter it in Settings" banner
- At app startup, call `GET /rest/api/2/myself` (Jira) and `GET /api/v4/user` (GitLab) to validate tokens — show a health indicator in settings
- On GitLab, the API response includes `X-GitLab-Meta: {"token_expires_at": "..."}` on some versions — use this to warn users before expiry

**Phase:** Auth/credentials setup (Phase 1), but also applies to error handling in all phases

---

### Pitfall 11: Releases View Mismatch Between Jira Fix Versions and GitLab Milestones

**What goes wrong:** Jira "fix versions" and GitLab milestones are named and scoped independently. The app assumes they share a naming convention, but in practice version names diverge (Jira: `v2.3`, GitLab: `Sprint 12`, or vice versa).

**Prevention:**
- Do not auto-link by name — provide a manual mapping UI where users can pair a Jira fix version to a GitLab milestone/tag
- Treat GitLab tags as the release signal (not milestones), since tags are immutable and represent actual code releases
- Display both separately with a "linked" indicator rather than merging them into one entity

**Phase:** Releases view feature

---

## Minor Pitfalls

---

### Pitfall 12: Electron Auto-Updater Complexity on All Three Platforms

**What goes wrong:** Auto-update (electron-updater) requires code signing on macOS (notarization), a signing certificate on Windows (otherwise SmartScreen blocks the installer), and a different package format per Linux distro. Setting this up late causes shipping delays.

**Prevention:**
- Decide auto-update strategy in Phase 1 (infrastructure setup), not at release time
- macOS: Apple Developer account + notarization is a prerequisite
- Windows: EV code signing certificate has a 1–5 day procurement lead time
- Linux: Offer AppImage as the universal format; don't try to support .deb + .rpm + snap simultaneously for v1
- Budget 1–2 weeks for signing setup if targeting all three platforms at launch

**Phase:** Cross-platform packaging (dedicated infrastructure phase, early)

---

### Pitfall 13: Role-Based Dashboard State Bleeds Between Users on Shared Machines

**What goes wrong:** Two team members share a machine (or one person uses different role profiles). The app stores role preference globally and the second user sees the wrong dashboard.

**Prevention:**
- Tie role preference (dev vs PM) to the PAT identity — store it keyed by the resolved Jira username or GitLab user ID, not as a single global setting
- On startup, resolve identity from `GET /rest/api/2/myself` and look up role preference by that identity

**Phase:** Auth + role-based dashboard (early)

---

### Pitfall 14: Large Comment Threads Cause Performance Issues in the Notifications Hub

**What goes wrong:** Fetching all comments for all issues to detect new mentions is O(issues * comments). On a sprint with 30 issues each having 20+ comments, this is 600+ items to diff every poll cycle.

**Prevention:**
- Use `updatedDate` filtering: only fetch comments updated since last poll timestamp (`?startedAfter=` or `updated >= "2025-01-01 00:00"` in JQL)
- For the notification hub, maintain a `lastSeenTimestamp` per source and only process deltas
- Consider fetching issue `updated` field first, then only pulling comments for issues that have changed since last check

**Phase:** Notifications hub (dedicated phase)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Auth + credential storage | PAT in plaintext (Pitfall 2); Cloud vs Server auth header format (Pitfall 1) | Use OS keychain from day one; test against actual Server instance |
| Architecture decision (web vs desktop) | CORS blocks all calls from browser (Pitfall 9) | Decide before any feature work; prefer desktop to eliminate entirely |
| Jira API integration | Transition ID not portable (Pitfall 6); missing `fields` param (Pitfall 7); wrong API docs (Pitfall 1) | Lock to Server REST API v2 docs; always specify fields; fetch transitions per-issue |
| GitLab API integration | Pagination not traversed (Pitfall 8); rate limiting (Pitfall 3) | Check `X-Next-Page`; respect `X-RateLimit-Remaining`; use `updated_after` for deltas |
| Data fetching layer | Aggressive polling (Pitfall 3) | Single poll coordinator; 60s minimum intervals; backoff on errors |
| Task-MR linking | Regex misses real formats (Pitfall 4) | Gather real MR title corpus first; case-insensitive word-boundary regex |
| Notifications hub | OS notification silent failure (Pitfall 5); comment fetch performance (Pitfall 14) | In-app badge as primary path; delta polling with timestamps |
| Jira task actions | Workflow transition IDs (Pitfall 6) | Always fetch transitions per issue before transitioning |
| Releases view | Fix version / milestone mismatch (Pitfall 11) | Manual mapping UI; use Git tags as release signal |
| Cross-platform packaging | Code signing delays (Pitfall 12) | Start signing setup in first infrastructure phase |
| Token expiry handling | Silent 401 with no recovery UX (Pitfall 10) | Catch 401 everywhere; surface actionable re-auth banner |

---

## Sources

**Note:** External fetch tools were unavailable during this research session. Findings are drawn from training knowledge (cutoff August 2025) of the following authoritative sources. Confidence levels noted per finding.

| Finding | Confidence | Basis |
|---------|------------|-------|
| Jira Server REST API v2 field differences (accountId vs name, pagination) | HIGH | Atlassian Server REST API v2 docs; well-documented breaking difference |
| Jira transition IDs per-issue behavior | HIGH | Atlassian Server REST API v2 `/issue/{key}/transitions` endpoint spec |
| GitLab rate limiting headers (X-RateLimit-Remaining, Retry-After, X-Next-Page) | HIGH | GitLab REST API documentation, stable since v12 |
| PAT security / OS keychain patterns | HIGH | Electron keytar docs, Tauri keyring plugin, security best practices |
| CORS behavior for web apps vs desktop (Electron/Tauri) | HIGH | Web platform specification, Electron architecture docs |
| Cross-platform code signing requirements | MEDIUM | Electron Builder docs, Apple notarization requirements (may have changed post-Aug 2025) |
| Desktop notification platform differences | MEDIUM | Web Notifications API spec, Electron Notification class docs |
| Jira on-premise activity stream limitations | MEDIUM | Known limitation of old Server versions; specific version cutoff not verified |

- Atlassian Server REST API v2: `{jira-base-url}/rest/api/2/` (authoritative reference for all Server-specific behavior)
- GitLab REST API docs: https://docs.gitlab.com/ee/api/rest/
- Electron Notification class: https://www.electronjs.org/docs/latest/api/notification
- electron-updater / electron-builder: https://www.electron.build/auto-update
