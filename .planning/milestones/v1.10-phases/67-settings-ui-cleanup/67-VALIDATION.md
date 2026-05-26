---
phase: 67
slug: settings-ui-cleanup
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-25
validated: 2026-05-25
---

# Phase 67 — Validation Strategy

> Per-phase validation contract. Reconstructed retroactively by /gsd:validate-phase on 2026-05-25 (no VALIDATION.md existed).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @testing-library/react (jsdom) |
| **Config file** | `taskflow/vitest.config.ts` |
| **Quick run command** | `cd taskflow && npx vitest run src/routes/settings/ src/test/package-deps.guard.test.ts` |
| **Full suite command** | `cd taskflow && npx vitest run` |
| **Build verify** | `cd taskflow && npm run build` (Phase 59 standing rule — not just tsc) |
| **Estimated runtime** | ~3 seconds (scoped); ~60s full suite |

---

## Sampling Rate

- **After every task commit:** Run the quick run command above (affected files only)
- **After every plan wave:** Run `cd taskflow && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite green AND `npm run build` zero errors
- **Max feedback latency:** ~3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 67-01-01 | 01 | 1 | SETUI-02 (UI) | — | SidebarItemsList renders checkbox-per-item, no drag handle, no `data-sortable-item` | unit | `npx vitest run src/routes/settings/SidebarItemsList.test.tsx` | ✅ | ✅ green |
| 67-01-01 | 01 | 1 | SETUI-02 (store) | — | `reorderSidebarItem` action removed; `setSidebarItemVisible` retained | unit | `npx vitest run src/routes/settings/Settings.test.tsx` | ✅ | ✅ green |
| 67-01-02 | 01 | 1 | SETUI-02 (deps) | — | `@dnd-kit/*` absent from package.json | unit | `npx vitest run src/test/package-deps.guard.test.ts` | ✅ | ✅ green |
| (P66 carry) | — | — | SETUI-03 | — | Default visibility = all items; v22 migration resets persisted map | unit | `npx vitest run src/stores/settings.store.test.ts src/lib/tauri-storage.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure (vitest + jsdom + @testing-library/react) covers all phase requirements.

**Audit gap filled (2026-05-25):** SETUI-02's package-removal aspect (uninstall of all
four `@dnd-kit/*` packages) had no automated guard — it was only grep-verified at
execution time. Added a `@dnd-kit absence guard` describe block to
`src/test/package-deps.guard.test.ts`, mirroring the existing react-grid-layout guard
(Phase 59 / QUAL-03). The behavioral side (no drag UI) was already covered by
`SidebarItemsList.test.tsx`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar items panel removed from Settings → Appearance | SETUI-01 | Pre-satisfied in Phase 66 (PresetButtons + SidebarItemsList already gone from AppearanceSection); the requirement is an absence with no remaining render surface to assert from AppearanceSection's own test | `grep -c 'SidebarItemsList' taskflow/src/routes/settings/AppearanceSection.tsx` → 0 |

---

## Validation Sign-Off

- [x] All requirements have automated verify or a documented manual-only justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (SETUI-02 deps gap filled)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-25

---

## Validation Audit 2026-05-25

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

VALIDATION.md did not exist (State B) — reconstructed from 67-01-SUMMARY.md and
verified against the live suite (61 settings tests + guard green). SETUI-02's
package-removal aspect was the one MISSING automated gap; filled inline with a
`@dnd-kit/*` absence guard. SETUI-01 documented as manual-only (pre-satisfied
removal grep); SETUI-03 covered by the shared settings-store migration tests.
