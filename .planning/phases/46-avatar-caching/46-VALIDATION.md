---
phase: 46
slug: avatar-caching
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-30
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (globals enabled) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npm run test -- --run` |
| **Full suite command** | `cd taskflow && npm run test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd taskflow && npm run test -- --run`
- **After every plan wave:** Run `cd taskflow && npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 46-01-01 | 01 | 1 | CACH-01 | unit | `cd taskflow && npm run test -- --run src/services/avatarCache.test.ts` | ❌ W0 | ⬜ pending |
| 46-01-02 | 01 | 1 | CACH-01 | unit | `cd taskflow && npm run test -- --run src/services/avatarCache.test.ts` | ❌ W0 | ⬜ pending |
| 46-01-03 | 01 | 1 | CACH-02 | unit | `cd taskflow && npm run test -- --run src/services/avatarCache.test.ts` | ❌ W0 | ⬜ pending |
| 46-01-04 | 01 | 1 | CACH-02 | unit | `cd taskflow && npm run test -- --run src/services/avatarCache.test.ts` | ❌ W0 | ⬜ pending |
| 46-02-01 | 02 | 1 | CACH-01 | unit | `cd taskflow && npm run test -- --run src/components/ui/cached-avatar.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `taskflow/src/services/avatarCache.test.ts` — stubs for CACH-01 (memory cache hit, inflight dedup) and CACH-02 (disk init, TTL eviction)
- [x] `taskflow/src/components/ui/cached-avatar.test.tsx` — stubs for CACH-01 (component render states: initials, loaded, no-url)
- [x] `taskflow/src/test/setup.ts` — add `keys()` method to LazyStore mock: `async keys(): Promise<string[]> { return [...this.data.keys()]; }`
- [x] Mock for `@tauri-apps/plugin-http` fetch needed in test files (not globally mocked yet)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Avatar loads from disk on app restart | CACH-02 | Requires actual app restart cycle | 1. Login to app, navigate to board. 2. Quit app completely. 3. Relaunch. 4. Verify avatars appear without network requests in DevTools. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete (Phase 47 cleanup)
