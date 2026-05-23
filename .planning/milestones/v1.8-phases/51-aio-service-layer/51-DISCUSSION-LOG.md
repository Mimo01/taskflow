# Phase 51: AIO Service Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 51-AIO Service Layer
**Areas discussed:** Probe mechanism, Settings toggle placement, AIO URL config, Project ID resolution

---

## Probe Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| In-app 'Test AIO Connection' button | Settings → Connections gets a button. Tries 3 base path variants with Bearer auth, persists result as aioBaseUrl. | |
| External curl / Postman script | Developer runs curl against live instance, documents working variant. Simpler. | ✓ |
| Tauri command probe on connect | App probes automatically when Jira credentials are saved. | |

**User's choice:** External curl / Postman script

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-coded after probe | Developer records working path in client.ts constant. | |
| Stored in settings.store.ts as aioBasePath | App enters value into a Settings field. | |
| Probe findings in CONTEXT.md as Key Decisions only | Findings documented, planner uses to hardcode correct path. | ✓ |

**User's choice:** Probe findings recorded in CONTEXT.md as Key Decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Include specific curl commands in plan | Plan tasks list exact curl for each variant. | ✓ |
| Leave to developer discretion | Plan says 'probe the live instance' — developer figures out approach. | |

**User's choice:** Include specific curl commands in the plan

**Notes:** 3 variants to probe: `/rest/aio-tcms/1.0/`, `/rest/aio-tcms-api/1.0/`, `/plugins/servlet/aio/`. Probe must also confirm `GET /testrun?issueKey=` works without a project ID.

---

## Settings Toggle Placement

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Integrations' section | 5th Settings sidebar entry. AIO is an optional third-party plugin. | ✓ |
| Existing Connections section | Alongside Jira/GitLab cards. One less sidebar entry. | |
| Existing Workflow section | Alongside sprint collapse, comment sort toggles. | |

**User's choice:** New 'Integrations' section

**Notes:** User initially questioned whether the toggle is needed at all ("If the user doesn't use AIO it just won't be called"). Clarified that Phase 54 adds an AIO section to issue detail — without the toggle, every issue detail open would fire an AIO API call (and fail) for non-AIO users. Also discussed auto-detect (one-time silent probe, cache result as aioBaseUrl) — user chose explicit toggle for clarity.

---

## AIO URL Config

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from jiraBaseUrl — no separate input | aioBaseUrl = jiraBaseUrl + working path constant. | ✓ |
| Separate aioBaseUrl input in Integrations section | User pastes full AIO base URL. Flexible for edge cases. | |

**User's choice:** Derive from jiraBaseUrl — no separate input

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-coded constant in aio/client.ts | Probe finds variant once, developer sets constant. | ✓ |
| Stored in auth store as aioApiPath at runtime | App probes on first use, stores winner. | |

**User's choice:** Hard-coded constant in aio/client.ts

**Notes:** AIO is on the same Jira host (confirmed). Single known deployment — code-level constant is appropriate.

---

## Project ID Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch all AIO projects, match by name on projects page | No pre-mapping. Phase 52 shows all AIO projects directly. | |
| Resolve lazily per feature | Each feature fetches what it needs at call time. | ✓ |

**User's choice:** Resolve lazily per feature

| Option | Description | Selected |
|--------|-------------|----------|
| Assume issueKey query param works — probe will confirm | GET /testrun?issueKey=PROJ-123. Probe confirms this. | ✓ |
| Derive AIO project ID from Jira issue's project key | Extract key, fetch AIO project list, match by name, cache. | |

**User's choice:** Assume issueKey query param works — probe will confirm

**Notes:** If probe confirms issueKey param works on `/testrun`, no project ID mapping is needed for Phase 54. Phase 52 projects page uses GET /project directly — no mapping needed there either.

---

## Claude's Discretion

None — all areas resolved with explicit user choices.

## Deferred Ideas

- Auto-detect AIO on startup (one-time silent probe, no toggle) — considered, user preferred explicit toggle
- Separate aioBaseUrl input field — considered, AIO is always same host
- In-app 'Test AIO Connection' button — considered for probe, external curl chosen for simplicity
