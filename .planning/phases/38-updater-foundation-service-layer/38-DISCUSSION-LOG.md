# Phase 38: Updater Foundation + Service Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 38-Updater Foundation + Service Layer
**Areas discussed:** Update check behavior, Version injection strategy, Update state machine design, Signing key management

---

## Update Check Behavior

### Background indication

| Option | Description | Selected |
|--------|-------------|----------|
| Completely silent | Check happens invisibly. Only surface something when an update is actually found. | ✓ |
| Subtle status indicator | Small spinner or icon in header/statusbar during checks. | |
| Toast on completion | Brief toast after each check saying 'Up to date' or 'Update available'. | |

**User's choice:** Completely silent
**Notes:** None

### Error handling

| Option | Description | Selected |
|--------|-------------|----------|
| Fail silently, retry next interval | No error shown to user. Just try again at the next scheduled check. | |
| Log to dev tools only | Silent to the user but visible in Developer Tools request log. | ✓ |
| Show error after multiple failures | Silent for first 3 failures, then show a subtle warning. | |

**User's choice:** Log to dev tools only
**Notes:** None

### Launch timing

| Option | Description | Selected |
|--------|-------------|----------|
| After a short delay | Wait ~5-10 seconds after launch to check. Avoids competing with initial data loads. | ✓ |
| Immediately on launch | Check starts as soon as the app opens. | |
| Only on manual trigger initially | First check waits for configured interval. | |

**User's choice:** After a short delay (~5-10s)
**Notes:** None

---

## Version Injection Strategy

### Runtime version source

| Option | Description | Selected |
|--------|-------------|----------|
| Vite define + Tauri config | Build script reads git tag, writes to tauri.conf.json, Vite injects as import.meta.env constants. | ✓ |
| Tauri command from Rust | Rust side reads version from Cargo.toml/env at compile time, exposes via invoke(). | |
| Environment file | CI writes a .env or version.json file at build time. | |

**User's choice:** Vite define + Tauri config
**Notes:** None

### Build metadata scope

| Option | Description | Selected |
|--------|-------------|----------|
| Commit SHA + build date | Requirements CI-04 specifies these two. Enough for debugging and About dialog. | ✓ |
| SHA + date + branch + dirty flag | More detailed but branch/dirty irrelevant for tagged releases. | |
| SHA + date + platform/arch | Platform info alongside build info. Though platform/arch detectable at runtime. | |

**User's choice:** Commit SHA + build date
**Notes:** None

---

## Update State Machine Design

### State home

| Option | Description | Selected |
|--------|-------------|----------|
| Zustand store | Consistent with auth.store, settings.store, notifications.store. Reactive subscriptions. | ✓ |
| Standalone service class | Separate from store pattern. Own state management. | |
| TanStack Query | Treat update checks like API calls. refetchInterval for polling. | |

**User's choice:** Zustand store
**Notes:** None

### Frequency setting location

| Option | Description | Selected |
|--------|-------------|----------|
| Existing settings store | Add alongside notificationPollIntervalSecs. Same persistence pattern. | ✓ |
| New update store with persistence | Separate store for all update-related state + config. | |
| Split: config in settings, state in update store | Preference in settings, ephemeral state in separate store. | |

**User's choice:** Existing settings store
**Notes:** None

### State machine scope

| Option | Description | Selected |
|--------|-------------|----------|
| Idle → Checking → Available → Error | Foundation layer only. Download/install states in Phase 39. | |
| Full lifecycle upfront | Idle → Checking → Available → Downloading → Ready → Error. Complete now, no refactoring later. | ✓ |
| Idle → Checking → Result | Ultra-minimal. Just checking and result union. Guaranteed refactor. | |

**User's choice:** Full lifecycle upfront
**Notes:** User prefers building the complete state machine now to avoid refactoring in Phase 39.

---

## Signing Key Management

### Key storage

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions secret | Private key in CI secret only. Public key in tauri.conf.json. | ✓ |
| Local + CI secret | Local copy in password manager plus CI secret. | |
| Hardware token / vault | HSM or cloud vault. Most secure but complex. | |

**User's choice:** GitHub Actions secret
**Notes:** None

### Key backup

| Option | Description | Selected |
|--------|-------------|----------|
| Two locations: password manager + GitHub secret | Generate key, store in password manager and as GitHub Actions secret. Document recovery. | ✓ |
| Three locations for safety | Password manager + GitHub secret + encrypted USB/cloud backup. | |
| Single location with rotation plan | Just GitHub secret with documented rotation process. | |

**User's choice:** Two locations: password manager + GitHub secret
**Notes:** None

### Key generation timing

| Option | Description | Selected |
|--------|-------------|----------|
| Manual pre-step with docs | Document keygen command and backup process. Run manually before CI setup. | ✓ |
| Automated in build script | Build script generates if missing. Risk of accidental regeneration. | |
| Part of phase execution | Phase 38 plan includes key generation task. | |

**User's choice:** Manual pre-step with docs
**Notes:** None

---

## Claude's Discretion

- Exact state machine type definitions and transition functions
- Tauri updater plugin configuration details
- Build script implementation approach
- Update service abstraction for testability
