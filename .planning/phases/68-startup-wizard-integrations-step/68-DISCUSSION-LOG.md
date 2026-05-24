# Phase 68: Startup Wizard — Integrations Step - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 68-startup-wizard-integrations-step
**Areas discussed:** Continue gating, AIO picker reuse, Integrations step fidelity

---

## Continue Gating

### Q1: AIO on, no project selected — Continue button behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Always enabled | Continue never gated; null project key exits wizard | |
| Disabled until project picked | Continue disabled until project selected | ✓ |
| Warn but allow | Soft warning below picker; non-blocking | |

**User's choice:** Disabled until project picked

---

### Q2: AIO on, project list fails to load — can user still Continue?

| Option | Description | Selected |
|--------|-------------|----------|
| Allow Continue on error | Environmental failure shouldn't block wizard | |
| Keep Continue disabled on error | Consistent strict gating; user must retry or disable AIO | ✓ |

**User's choice:** Keep Continue disabled on error

---

### Q3: AIO on, project list empty — what then?

| Option | Description | Selected |
|--------|-------------|----------|
| Allow Continue if list is empty | Nothing to pick; Continue enabled | |
| Force AIO off if list is empty | Auto-disable AIO when empty | |
| Block until AIO is disabled | Show message: disable AIO to continue | ✓ |

**User's choice:** Block until AIO is disabled

---

### Q4: AIO on, projects still loading — Continue button?

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled while loading | Consistent with strict gating | ✓ |
| Enabled while loading | Skip past a pending fetch | |

**User's choice:** Disabled while loading (recommended)

---

## AIO Picker Reuse

### Q1: How to share AIO picker logic between IntegrationsSection and wizard step?

| Option | Description | Selected |
|--------|-------------|----------|
| Extract a shared component | New AioProjectPicker component; both import it | ✓ |
| Copy inline | Duplicate logic in IntegrationsStep.tsx | |
| Embed IntegrationsSection with layout prop | Import IntegrationsSection; pass compact={true} | |

**User's choice:** Extract a shared component (recommended)

---

### Q2: Where should the extracted component live?

| Option | Description | Selected |
|--------|-------------|----------|
| src/components/integrations/ | Clean separation for shared integration UI | |
| src/components/settings/ | Originating directory | |
| You decide | Claude picks based on conventions | ✓ |

**User's choice:** You decide (Claude's discretion)

---

### Q3: What should the extracted component encapsulate?

| Option | Description | Selected |
|--------|-------------|----------|
| AIO picker only | Toggle + conditional picker; Tempo not extracted | |
| Both AIO + Tempo | Full integrations block as one component | |

**User's choice:** You decide (Claude's discretion)

---

## Integrations Step Fidelity

### Q1: Replicate full edge case handling from IntegrationsSection?

| Option | Description | Selected |
|--------|-------------|----------|
| Full fidelity | Loading, error/retry, empty state, stale key warning | ✓ |
| Skip stale-key warning only | Less relevant on first run | |
| Simplified | Basic toggle + select; no edge case handling | |

**User's choice:** Full fidelity (recommended)

---

### Q2: Visual style of Integrations step?

| Option | Description | Selected |
|--------|-------------|----------|
| Match wizard step style | Centered, max-w-lg, py-8 (JiraStep/GitLabStep) | ✓ |
| Match settings section style | Full-width flex-col gap-8 | |

**User's choice:** Match wizard step style (recommended)

---

### Q3: Navigation buttons on the Integrations step?

| Option | Description | Selected |
|--------|-------------|----------|
| Back + Continue | Standard wizard nav | ✓ |
| Continue only | No back button | |

**User's choice:** Back + Continue (recommended)

---

## Claude's Discretion

- Location for extracted shared AIO component — `src/components/integrations/` or similar
- Whether extracted component covers AIO only or AIO + Tempo
- `completedSteps` tracking for Integrations step (step 3 has no validation flag)
- Commit ordering within the plan

## Deferred Ideas

None — discussion stayed within phase scope.
