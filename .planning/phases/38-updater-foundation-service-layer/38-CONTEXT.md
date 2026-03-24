# Phase 38: Updater Foundation + Service Layer - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

All infrastructure to detect, download, and manage updates — Tauri updater plugin registered, update service and store operational, build-time version injection working, signing key documented. This phase builds the service layer; update UI (dialogs, progress bars) belongs in Phase 39, and settings/about UI belongs in Phase 40.

</domain>

<decisions>
## Implementation Decisions

### Update check behavior
- **D-01:** Update checks run completely silently — no UI indication during routine checks. Only surface state when an update is actually found.
- **D-02:** On check failure (network error, endpoint down), fail silently to the user but log to Developer Tools request log for debugging.
- **D-03:** First update check runs after a ~5-10 second delay after launch, to avoid competing with initial Jira/GitLab data fetches.

### Version injection strategy
- **D-04:** Git tag version injected via Vite `define` + `tauri.conf.json` version field. Build script reads git tag, writes to tauri.conf.json, and Vite injects as `import.meta.env` constants. Single source of truth for both Tauri updater and frontend.
- **D-05:** Build metadata limited to commit SHA + build date (per CI-04 requirements). No branch/dirty flag — irrelevant for tagged releases. Platform/arch detected at runtime via Tauri APIs.

### Update state machine design
- **D-06:** Update state machine lives in a Zustand store (non-persisted), consistent with auth.store, settings.store, notifications.store patterns.
- **D-07:** Update check frequency setting (1h/6h/12h/24h/manual) added to existing settings store alongside `notificationPollIntervalSecs`. Same LazyStore persistence pattern.
- **D-08:** Full lifecycle state machine built upfront: Idle → Checking → Available → Downloading → Ready → Error. No refactoring needed when Phase 39 adds the UX layer.

### Signing key management
- **D-09:** Ed25519 private key stored as a GitHub Actions secret. Only CI has access. Public key embedded in `tauri.conf.json` for client-side verification.
- **D-10:** Key backup in two locations: password manager (1Password/Bitwarden) + GitHub Actions secret. Recovery process documented.
- **D-11:** Key generation is a manual pre-step with documentation. This phase embeds the public key in config and documents the keygen + backup process. Actual key generation happens before Phase 41 CI setup.

### Claude's Discretion
- Exact state machine type definitions and transition functions
- Tauri updater plugin configuration details
- Build script implementation (shell script vs Node script vs Vite plugin)
- Update service abstraction for testability

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tauri updater
- `taskflow/src-tauri/tauri.conf.json` — Current Tauri config; updater section to be added here
- `taskflow/src-tauri/Cargo.toml` — Current Rust dependencies; `tauri-plugin-updater` to be added here
- `taskflow/src-tauri/src/lib.rs` — Plugin registration site; updater plugin goes here

### Existing patterns
- `taskflow/src/stores/settings.store.ts` — Settings store where update check interval will be added
- `taskflow/src/services/tauri.ts` — Tauri abstraction layer; update service should follow this pattern
- `taskflow/src/lib/tauri-storage.ts` — LazyStore persistence adapter used by settings store

### Build config
- `taskflow/vite.config.ts` — Vite config where `define` constants for version/SHA/date will be injected
- `taskflow/package.json` — Build scripts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `settings.store.ts`: Zustand + persist + LazyStore pattern — update frequency setting fits here naturally
- `tauri.ts`: Single abstraction for all Tauri invoke calls — update service should use this
- `lib.rs`: Plugin registration chain (`.plugin(...)`) — updater plugin follows same pattern
- `api-error.ts`: ApiError class with structured error handling — update errors can follow this pattern

### Established Patterns
- Zustand stores with `persist` middleware for user preferences (settings, auth, pinned-tabs)
- Non-persisted Zustand stores for ephemeral state (filter, breadcrumb, operation-profiler)
- `tauriService.invoke()` for all Rust ↔ frontend communication
- TanStack Query for polling with configurable `refetchInterval` (notifications use this)
- Developer Tools request logging for debugging API calls

### Integration Points
- `lib.rs` `.plugin()` chain — updater plugin registers here
- `tauri.conf.json` — updater endpoint URL and public key configured here
- Settings store — update check interval setting added here
- Developer Tools — update check requests logged here

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 38-updater-foundation-service-layer*
*Context gathered: 2026-03-24*
