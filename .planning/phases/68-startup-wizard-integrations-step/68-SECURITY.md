---
phase: 68
slug: startup-wizard-integrations-step
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-24
---

# Phase 68 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| App → Jira/AIO API | AioBlock fetches AIO project list using PAT read from Stronghold IPC. Pre-existing boundary, unchanged by this phase. | projectKey/name list (read-only, non-sensitive) |
| App → Settings store | IntegrationsStep writes aioEnabled, tempoEnabled, selectedAioProjectKey via typed Zustand setters on wizard completion. | booleans + projectKey string (no PAT, no credentials) |
| OnboardingWizard → Step components | Static STEP_COMPONENTS array selects the rendered component by clamped store step index. | Component reference only |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-68-01 | Information Disclosure | Jira PAT read in AioBlock | accept | PAT read via `readSecret('jira-pat')` Stronghold IPC; never placed in Zustand or onboarding store; identical to pre-extraction IntegrationsSection behavior | closed |
| T-68-02 | Tampering | AIO project list response rendering | accept | Project list rendered as text in React Select; React escapes all output; values are projectKey/name only — no HTML injection path; data is read-only | closed |
| T-68-03 | Information Disclosure | PAT used in IntegrationsStep gating query | accept | PAT read via `readSecret('jira-pat')` Stronghold IPC; held only in component-local state for query lifetime; never persisted to onboarding or settings store | closed |
| T-68-04 | Tampering | Settings store writes (aioEnabled/tempoEnabled/selectedAioProjectKey) | accept | Writes via existing typed store setters; values are booleans or a projectKey selected from a fetched list — no free-text injection path | closed |
| T-68-05 | Tampering | STEP_COMPONENTS array indexing in OnboardingWizard | accept | Static array literal; `CurrentStep = STEP_COMPONENTS[step] ?? DoneStep` guards all out-of-range indices; no external input controls the step index beyond the clamped store value | closed |
| T-68-SC | Tampering | Supply chain (npm/pip/cargo installs) | mitigate | Zero new packages installed in this phase (confirmed by RESEARCH.md Package Legitimacy Audit); legitimacy checkpoint not required | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-68-01 | T-68-01 | PAT never leaves Stronghold IPC boundary; identical pattern to pre-existing IntegrationsSection. No new exposure introduced by component extraction. | Milan Mozolak | 2026-05-24 |
| AR-68-02 | T-68-02 | AIO project list is read-only metadata (projectKey/name). React escaping eliminates injection. Low value target with no write path. | Milan Mozolak | 2026-05-24 |
| AR-68-03 | T-68-03 | PAT is component-local for query lifetime only; IntegrationsStep reuses the established AioBlock + Stronghold pattern without persistence. | Milan Mozolak | 2026-05-24 |
| AR-68-04 | T-68-04 | Store writes are booleans and a fetched projectKey; typed setters enforce value domain. No injection path exists. | Milan Mozolak | 2026-05-24 |
| AR-68-05 | T-68-05 | STEP_COMPONENTS is a static literal; the `?? DoneStep` fallback eliminates any out-of-range rendering risk. Wizard step is clamped by store logic before array access. | Milan Mozolak | 2026-05-24 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-24 | 6 | 6 | 0 | gsd-security-auditor (short-circuit: register_authored_at_plan_time=true, threats_open=0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-24
