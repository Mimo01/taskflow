---
phase: quick-260316-tbl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/components/app/PinnedTabStrip.tsx
autonomous: true
requirements: [QUICK-TBL]

must_haves:
  truths:
    - "Loading pinned tab shows placeholder icon and issue key only (~110px compact)"
    - "When data resolves, tab smoothly transitions (~150ms) to show type icon + key + truncated summary"
    - "Loaded tabs are compact and space-efficient with all three elements visible"
    - "Close button remains hover-visible on loaded tabs"
    - "Drag-to-reorder and ghost clone still work correctly"
  artifacts:
    - path: "taskflow/src/components/app/PinnedTabStrip.tsx"
      provides: "Compact pinned tab strip with loading-to-loaded transition"
      min_lines: 200
  key_links:
    - from: "PinnedTabStrip.tsx"
      to: "resolveIssueFromCache"
      via: "Loading vs loaded state branching"
      pattern: "resolved \\? .* : .*"
---

<objective>
Restyle pinned issue tabs to be compact with a smooth loading-to-loaded transition.

Purpose: Loading tabs currently show skeleton placeholders at full size, causing layout jank. The new design shows a compact loading state (placeholder icon + issue key at ~110px), then smoothly transitions to a compact loaded state (type icon + key + truncated summary) with a ~150ms animation.

Output: Updated PinnedTabStrip.tsx with compact tab design and smooth transition.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/components/app/PinnedTabStrip.tsx

<interfaces>
<!-- Current tab structure to preserve -->
From PinnedTabStrip.tsx:
```typescript
interface PinnedTabStripProps {
  pinnedKeys: string[];
  activeKey: string | null;
  onTabClick: (issueKey: string) => void;
  onTabClose: (issueKey: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

interface ResolvedIssue {
  summary: string;
  issueTypeName: string;
}

// resolveIssueFromCache returns ResolvedIssue | undefined
// undefined = still loading, ResolvedIssue = data available
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restyle pinned tabs with compact layout and smooth loading transition</name>
  <files>taskflow/src/components/app/PinnedTabStrip.tsx</files>
  <action>
Redesign the tab rendering in PinnedTabStrip.tsx. Keep all existing logic intact (resolveIssueFromCache, drag-to-reorder, ghost clone, IssueTypeIcon, close button). Only change the visual presentation of individual tabs and the strip container.

**Loading state (resolved === undefined):**
- Show a generic placeholder icon (use Loader2 from lucide-react with `animate-spin` class, w-3.5 h-3.5) and the issue key in monospace font
- Tab width constrained to ~110px (use w-[110px] instead of min-w-[130px] max-w-[220px])
- Height reduced from h-12 to h-9 for compactness
- Single-line layout: icon + key side by side, no stacked flex-col
- Text size: text-[11px] font-mono for the key

**Loaded state (resolved !== undefined):**
- Show colored IssueTypeIcon (w-3.5 h-3.5 instead of w-4 h-4) + issue key + truncated summary all on one line
- Key in font-mono text-[11px], summary in text-[11px] text-muted-foreground truncated
- Separate key and summary with a subtle separator: a middot or thin pipe in text-muted-foreground/40
- Max width ~220px, min width auto (content-driven)
- Same h-9 height

**Transition:**
- Add `transition-all duration-150 ease-in-out` to each tab div so width and content changes animate smoothly
- The width change from ~110px (loading) to content-width (loaded) will animate via the transition

**Container strip:**
- Reduce container height from h-14 to h-10 to match the smaller h-9 tabs
- Keep items-end alignment so tabs sit on the bottom border

**Ghost clone:**
- Update ghost to match the new compact style (h-9 instead of h-12, same single-line layout, smaller text)

**Drop placeholder:**
- Update placeholder divs to use h-9 and appropriate width

**Close button:**
- Keep hover-visible close button, reduce X icon to w-3 h-3 for compact fit
- Keep `ml-auto` positioning
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
- Loading tabs show spinning loader icon + issue key at ~110px width
- Loaded tabs show type icon + key + summary on one compact line with smooth 150ms transition
- Strip height reduced from h-14 to h-10
- Tab height reduced from h-12 to h-9
- Drag-to-reorder still works (ghost and placeholders updated to match)
- Close button still hover-visible
- No TypeScript errors
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Compact pinned tab strip with smooth loading-to-loaded transition animation</what-built>
  <how-to-verify>
    1. Open the app and pin a few issues
    2. Verify tabs are compact (shorter height, tighter spacing)
    3. Reload the app — observe loading state shows placeholder icon + PROJ-123 key at ~110px
    4. Watch the smooth ~150ms transition as data loads and tabs expand to show icon + key + summary
    5. Verify close button appears on hover
    6. Test drag-to-reorder still works correctly
    7. Verify active tab styling (border-primary) still distinguishes the selected tab
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- All existing PinnedTabStrip props and behaviors preserved (click, close, reorder, active state)
- Visual: tabs are noticeably more compact than before
- Visual: loading-to-loaded transition is smooth, not jarring
</verification>

<success_criteria>
- Pinned tabs use compact single-line layout at h-9 height
- Loading state shows placeholder icon + issue key at ~110px
- Loaded state shows type icon + key + summary, all compact
- Smooth ~150ms CSS transition between loading and loaded widths
- Drag-to-reorder and ghost clone work with updated sizing
</success_criteria>

<output>
After completion, create `.planning/quick/260316-tbl-redo-style-for-pinned-task-tabs-compact-/260316-tbl-SUMMARY.md`
</output>
