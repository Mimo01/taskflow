# Requirements: Taskflow v1.10

**Defined:** 2026-05-23
**Milestone:** v1.10 Cleanup, Roles Removal & Standup Notes
**Core Value:** Developers and PMs can see everything they need — tasks, MRs, sprint state, notifications, and test execution health — in one place, without switching between Jira, GitLab, and AIO.

## v1.10 Requirements

### Cleanup (tech debt carried from v1.8 + v1.9)

- [x] **CLEAN-01**: Add `useEffect` cleanup for `closeTimer.current` setTimeout in `WorklogsPage.tsx` (WR-01) — fires on unmounted component possible
- [x] **CLEAN-02**: Distinguish `isError` from "cached empty" in `WorklogsPage.tsx` so `ErrorState` renders on network errors after a successful empty result (WR-02)
- [x] **CLEAN-03**: Replace unkeyed `<></>` fragments at `WorklogsPage.tsx:1050/1129/~1240` (Epic/Story/Subtask map callbacks) with `<React.Fragment key={epicKey|storyKey}>` (INT-W1)
- [x] **CLEAN-04**: Move `DatePreset` type from `WorklogsPage.tsx:53` to `src/services/tempo/types.ts` and update all imports (resolves architectural inversion in `tempo-filters.store.ts`)
- [x] **CLEAN-05**: Remove stale `{ id: 'workload', visible: true }` mock entry at `Sidebar.test.tsx:79`
- [x] **CLEAN-06**: Add IDs `51` (NOT_EXECUTED) + `52` (IN_PROGRESS) to `TESTCASE_STATUS_MAP` in `src/services/aio/cycles.ts:335` — in-progress runs currently bucket as `NOT_EXECUTED`
- [x] **CLEAN-07**: Make `AIO_STATUS_MAP` resilient to non-standard AIO instances — fetch from AIO `/config` endpoint when available, or document a per-instance override mechanism

### Roles Removal

- [x] **ROLES-01**: Remove role selection step from startup wizard
- [x] **ROLES-02**: Remove role toggle from Settings (currently in Workflow/Appearance section)
- [x] **ROLES-03**: Remove Dev/PM preset buttons from Sidebar settings
- [x] **ROLES-04**: Remove `role` field from `useSettingsStore` with version bump migration (default everyone → universal access)
- [x] **ROLES-05**: Strip role-gated rendering across all components — audit call sites and remove role conditionals
- [x] **ROLES-06**: Make every sidebar nav item + dashboard surface accessible to all users by default

### Settings UI Cleanup

- [ ] **SETUI-01**: Remove "sidebar items" panel from Settings → Appearance section (duplicates the Sidebar settings page)
- [ ] **SETUI-02**: Sidebar settings — visibility toggles only; remove drag-reorder UI + handlers from `SidebarItemsList.tsx`
- [ ] **SETUI-03**: Default visibility = all sidebar items shown (migration: reset persisted visibility map on store version bump)

### Startup Wizard

- [ ] **WIZ-01**: New "Integrations" step in wizard, between Connections and Done
- [ ] **WIZ-02**: Integrations step exposes AIO toggle; when on, shows project picker (same picker as Settings → Integrations)
- [ ] **WIZ-03**: Integrations step exposes Tempo toggle
- [ ] **WIZ-04**: Wizard completion writes Integrations selections into Settings store (single source of truth — no separate wizard state)

### Standup Notes

- [ ] **STAND-01**: New `/standup-notes` route + sidebar entry "Standup Notes" (visible to everyone post-roles-removal)
- [ ] **STAND-02**: "Yesterday" = last working day — Monday shows Friday's data; weekends skipped; public holidays from Tempo schedule API skipped when Tempo is enabled
- [ ] **STAND-03**: Yesterday recap shows my Tempo worklogs (issue key, duration, comment) — empty section when Tempo disabled
- [ ] **STAND-04**: Yesterday recap shows Jira changelog activity I authored — status transitions + comments
- [ ] **STAND-05**: Yesterday recap shows Git commits I authored on the configured GitLab project (commit message + SHA + linked Jira key when parseable from message)
- [ ] **STAND-06**: Yesterday recap shows MR activity I performed — comments I posted + approvals I gave
- [ ] **STAND-07**: Today section shows my open subtasks/tasks in the current sprint (assignee = me)
- [ ] **STAND-08**: Today section shows pinned issues (read-only — no pin/unpin actions on this page)
- [ ] **STAND-09**: Today section shows planned worklog targets — issues I plan to log time against today (pre-fills Tempo entries)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Local quick-notes overlay on Standup Notes | Rejected by user during v1.10 scoping — not pursuing |
| Export Standup Notes to clipboard/markdown | Rejected by user during v1.10 scoping — not pursuing |
| Configurable "yesterday" window (calendar day vs working day) | Rejected by user during v1.10 scoping — fixed to last-working-day |
| Pin/unpin actions on Standup Notes | Read-only by design — pinning surface stays on the issue itself |
| Multi-day historical recap on Standup Notes | Daily standup focus — single working-day window |
| Standup Notes desktop notification | No signal; user opens manually each morning |
| Preservation of role-gated visibility state | Universal-access model — everyone starts with all items visible |
| Carry-forward TEMPO-03 / Phase 62 SC #1 spec drift in v1.9 docs | Doc-only; v1.9 shipped with documented user override (D-01) |
| `requirements_completed` SUMMARY frontmatter discipline | Process improvement, not code — handled via better SUMMARY templates separately |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 | Phase 65 | Complete |
| CLEAN-02 | Phase 65 | Complete |
| CLEAN-03 | Phase 65 | Complete |
| CLEAN-04 | Phase 65 | Complete |
| CLEAN-05 | Phase 65 | Complete |
| CLEAN-06 | Phase 65 | Complete |
| CLEAN-07 | Phase 65 | Complete |
| ROLES-01 | Phase 66 | Complete |
| ROLES-02 | Phase 66 | Complete |
| ROLES-03 | Phase 66 | Complete |
| ROLES-04 | Phase 66 | Complete |
| ROLES-05 | Phase 66 | Complete |
| ROLES-06 | Phase 66 | Complete |
| SETUI-01 | Phase 67 | Pending |
| SETUI-02 | Phase 67 | Pending |
| SETUI-03 | Phase 67 | Pending |
| WIZ-01 | Phase 68 | Pending |
| WIZ-02 | Phase 68 | Pending |
| WIZ-03 | Phase 68 | Pending |
| WIZ-04 | Phase 68 | Pending |
| STAND-01 | Phase 69 | Pending |
| STAND-02 | Phase 69 | Pending |
| STAND-03 | Phase 69 | Pending |
| STAND-04 | Phase 69 | Pending |
| STAND-05 | Phase 69 | Pending |
| STAND-06 | Phase 69 | Pending |
| STAND-07 | Phase 70 | Pending |
| STAND-08 | Phase 70 | Pending |
| STAND-09 | Phase 70 | Pending |

**Coverage:**
- v1.10 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-23*
*Last updated: 2026-05-23 after initial definition*
