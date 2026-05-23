# Phase 61: Tempo Probe + Service Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 61-tempo-probe-service-layer
**Areas discussed:** Probe plan + fallback, worklogs.ts scope, Settings toggle UI, Tempo host + auth shape

---

## Probe Plan + Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| /rest/tempo-timesheets/4/ | Standard path for most Jira DC installations | |
| /rest/tempo-timesheets/3/ | Older Tempo plugin versions (pre-9.x) | |
| Probe both paths in order | Try /4/ first, fall back to /3/ if 404; document working path | ✓ |
| I know the path already | User provides exact base path | |

**User's choice:** Probe both paths in order

---

| Option | Description | Selected |
|--------|-------------|----------|
| Document + block Phase 62 | Record failure, mark TEMPO-06 blocked; no service module built | ✓ |
| Add Tempo token to Stronghold now | Add 'tempo-token' credential + Settings field if PAT fails | |
| Build service module anyway | Full layer with TODO on auth; Phase 62 handles credential | |

**User's choice:** Document + block Phase 62 — if PAT returns 401, Phase 61 ends with documentation only.

---

## worklogs.ts Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full implementation with pagination | Complete paginated fetch; tests prove exhaustion | ✓ |
| Single-page fetch, pagination deferred | Fetch one page; pagination added in Phase 62 | |
| You decide | ROADMAP already implies full loop via pagination-exhaustion test requirement | |

**User's choice:** Full implementation with pagination

---

| Option | Description | Selected |
|--------|-------------|----------|
| from + to as YYYY-MM-DD strings | Simple ISO strings; match Tempo API directly | |
| from + to as Date objects | Convert inside function | |
| You decide | — | ✓ |

**User's choice:** Claude decides — YYYY-MM-DD strings chosen (matches API, no serialization).

---

| Option | Description | Selected |
|--------|-------------|----------|
| By username (array) + date range | Fetch for specific team members; maps to TEMPO-03 people filter | ✓ |
| By project key + date range | All worklogs for the Jira project | |
| Both filters optional | Username list and project both optional | |

**User's choice:** By username (array) + date range

---

## Settings Toggle UI

| Option | Description | Selected |
|--------|-------------|----------|
| Plain toggle only (no sub-UI) | Just checkbox + description; no extra fields needed | ✓ |
| Show a sidebar link / shortcut | 'Go to Tempo viewer' link shown when enabled | |
| Show team member pre-selection | Multi-select pre-populating default people filter | |

**User's choice:** Plain toggle only — Tempo uses the same Jira base URL and PAT, nothing extra to configure.

---

## Tempo Host + Auth Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — same host as Jira | tempoFetch uses jiraBaseUrl + Jira PAT; same pattern as aioFetch | ✓ |
| Separate host | Needs own base URL field | |
| Unknown — probe will tell | Assume same host; probe determines if separate field needed | |

**User's choice:** Yes — same host as Jira

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — mirror aioFetch exactly | Same signature; dev-tools operation grouping works out of the box | ✓ |
| Simpler — no apiPath parameter | Tempo has one path; slightly simpler | |
| You decide | Mirror safer for consistency | |

**User's choice:** Mirror aioFetch exactly

---

## Claude's Discretion

- `from`/`to` parameter format: YYYY-MM-DD strings chosen (simpler, matches Tempo API directly)
- Exact Tempo pagination API shape (offset/limit vs cursor) — Claude adapts based on probe result
- `TEMPO_API_PATH` as a single constant vs. dual-path like AIO — single constant (probe-confirmed path)

## Deferred Ideas

None — discussion stayed within phase scope.
