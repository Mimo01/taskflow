# Quick Task 260531-l0f: Pin releases (alongside issues & AIO cycles) - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Task Boundary

Currently users can pin Jira issues and AIO cycles to the pinned-tab strip. Add the
ability to pin **releases** (Jira fix versions) the same way: a Pin/Unpin control on the
Release detail page, a pinned-release tab in the strip, persistence across sessions, and
correct click-through navigation back to the release.

</domain>

<decisions>
## Implementation Decisions

### Tab / release icon
- Use the lucide **`Rocket`** icon for pinned-release tabs in the strip.
- ALSO unify the release icon to `Rocket` everywhere a release is identified, replacing the
  current mismatched icons:
  - Sidebar nav "Releases" item: `sidebar-items.ts` `iconName: 'Tag'` → `'Rocket'`.
  - Releases list page header: `ReleasesTab.tsx` `icon={Package}` → `Rocket`.
  - Release detail page header: `ReleaseDetailPage.tsx` header `<Package />` (next to `v{id}`) → `Rocket`.
  - Do NOT change the `<Tag />` used for the "Labels" section in ReleaseDetailPage — that is a
    labels icon, not a release icon.

### Persistence behavior
- Pinned releases **persist globally** across active-project switches, exactly like pinned
  issues and cycles do today (Zustand persisted store).
- Store release display metadata (name + versionId + projectKey) so the tab can render its
  label and navigate correctly even when the active project differs — mirror the existing
  `pinnedCycleMeta` pattern with a `pinnedReleaseMeta` map.

### Pin button placement
- Pin/Unpin control lives in the **Release detail page header actions** (top-right), matching
  the placement and style of the Pin buttons on issue and cycle detail pages.

### Claude's Discretion
- **Key format / collision avoidance:** Releases are identified by a numeric `versionId`
  (e.g. `12345`), which contains no `-` and would be misclassified as an issue by the existing
  `!key.includes('-CY-')` discriminator. Use a recognizable prefix (e.g. `REL-{versionId}`)
  so release keys are unambiguously distinguishable from both issue keys and `-CY-` cycle
  keys. Planner to confirm the exact discriminator and update main.tsx routing/filtering
  accordingly.
- Whether to store `projectKey` in `pinnedReleaseMeta` (needed if release fetch/navigation
  requires project context) — follow the cycle meta pattern.

</decisions>

<specifics>
## Specific Ideas

Key files (from codebase exploration):
- Store: `taskflow/src/stores/pinned-tabs.store.ts` (`pinnedKeys`, `pinnedCycleMeta`, `togglePin`, `removePin`, `setPinnedCycleMeta`, `clearCycleMeta`)
- Tab strip renderer: `taskflow/src/components/app/PinnedTabStrip.tsx` (`ResolvedTab = IssueTab | CycleTab` union; add `ReleaseTab`)
- Tab resolution + navigation: `taskflow/src/main.tsx` (~lines 165-216 resolution, ~516-523 onTabClick)
- Release detail (add pin button): `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` (route `/release/:versionId`, header ~line 447)
- Release type: `taskflow/src/services/jira/types.ts` `JiraFixVersion`
- Cycle pin button reference pattern: `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` (~lines 800-817)
- Issue pin button reference: `taskflow/src/routes/dashboard/IssueDetailContent.tsx` (~lines 321-332)
- Icon targets: `sidebar-items.ts:70`, `ReleasesTab.tsx:16,315`, `ReleaseDetailPage.tsx:449`

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above. Implementation mirrors the
existing in-repo cycle-pinning pattern.

</canonical_refs>
