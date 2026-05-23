---
phase: quick
plan: 260318-uth
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/notifications/NotificationRow.tsx
  - taskflow/src/routes/notifications/NotificationRow.test.tsx
autonomous: true
requirements: [QUICK-260318-uth]

must_haves:
  truths:
    - "Each notification row displays source badge, type badge, issue key, entity title, author with avatar, body preview, relative timestamp, and entity state in a compact sleek layout"
    - "Unread rows are visually distinct from read rows with subtle background and bold title"
    - "Hover reveals action buttons (navigate, open in browser, dismiss) without layout shift"
    - "Row design matches the app's existing style: Geist font, shadcn color tokens (muted, accent, border, foreground), rounded corners, clean spacing"
  artifacts:
    - path: "taskflow/src/routes/notifications/NotificationRow.tsx"
      provides: "Redesigned notification row component"
      min_lines: 150
    - path: "taskflow/src/routes/notifications/NotificationRow.test.tsx"
      provides: "Updated tests for new layout"
      min_lines: 50
  key_links:
    - from: "taskflow/src/routes/notifications/NotificationRow.tsx"
      to: "taskflow/src/stores/notifications.store.ts"
      via: "NotificationItem type import"
      pattern: "import.*NotificationItem.*notifications\\.store"
    - from: "taskflow/src/routes/notifications/NotificationPopover.tsx"
      to: "taskflow/src/routes/notifications/NotificationRow.tsx"
      via: "NotificationRow component usage"
      pattern: "<NotificationRow"
---

<objective>
Redesign the NotificationRow component to be sleek, modern, and information-dense while matching the app's design language (Geist font, shadcn tokens, Tailwind utility classes).

Purpose: The current notification row is functional but feels utilitarian. This redesign will make it visually polished with a card-like feel, better typography hierarchy, and maximum data density in a compact space.

Output: Redesigned NotificationRow.tsx with updated tests.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/src/routes/notifications/NotificationRow.tsx
@taskflow/src/routes/notifications/NotificationPopover.tsx
@taskflow/src/stores/notifications.store.ts
@taskflow/src/index.css

<interfaces>
<!-- NotificationRow props interface (must be preserved — NotificationPopover depends on it) -->
From taskflow/src/routes/notifications/NotificationRow.tsx:
```typescript
interface NotificationRowProps {
  item: NotificationItem;
  isUnread?: boolean;
  onClick: () => void;
  onNavigate?: () => void;
  onDismiss?: () => void;
  onOpenInBrowser?: () => void;
}
```

From taskflow/src/stores/notifications.store.ts:
```typescript
export interface NotificationItem {
  id: string;
  source: 'jira' | 'gitlab';
  entityTitle: string;
  author: string;
  authorAvatarUrl?: string;
  bodyPreview: string;
  fullBody: string;
  createdAt: string;
  url?: string;
  notificationType?: NotificationType;
  entityState?: string;
  parentKey?: string;
  parentSummary?: string;
  mrProjectId?: number;
  mrIid?: number;
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Redesign NotificationRow with sleek modern layout</name>
  <files>taskflow/src/routes/notifications/NotificationRow.tsx</files>
  <action>
Completely redesign the NotificationRow component while preserving the EXACT same props interface (NotificationRowProps) so NotificationPopover continues to work unchanged.

**Layout redesign — single-line-dense card style:**

1. **Container:** Remove the outer `div.group.relative` wrapper. Make the button itself the group container. Use `rounded-md` for subtle card feel. Add `border border-transparent hover:border-border` for hover card effect. Keep `border-l-3` (not border-l-4) for source accent — orange-500 for Jira, purple-500 for GitLab. Use tighter padding: `px-3 py-2`.

2. **Top row (metadata):** Single flex row with all metadata densely packed:
   - LEFT: Compact avatar (w-5 h-5 rounded-full, smaller than current w-6 h-6) next to author name as `text-[11px] font-medium text-muted-foreground` (no more "by" prefix — just the name).
   - CENTER-LEFT: Source pill badge — keep current Jira orange / GitLab purple pills but make them smaller: `text-[9px] px-1 py-0 leading-tight`. Remove the unread blue dot from inside the source badge.
   - CENTER: Type badge — keep existing colorMap but use `text-[9px] px-1 py-0 rounded-sm` for tighter fit.
   - RIGHT: Relative timestamp `text-[10px] text-muted-foreground/60` on default, action buttons on hover (same swap pattern). Place an unread indicator dot (w-1.5 h-1.5 rounded-full bg-blue-500) to the left of the timestamp when isUnread.

3. **Title line:** `text-[13px] leading-snug` — extract the issue key from entityTitle (text before first colon) and render it as `font-mono text-muted-foreground text-[11px]` inline before the title text which is `font-medium` when unread, `font-normal` when read. Truncate with `truncate`. This line goes directly below the metadata row with no margin gap (just the natural line height).

4. **Body preview line:** `text-[11px] text-muted-foreground/70 line-clamp-1` (single line, not 2). Keep the arrow-format change rendering for issue-update/mr-note types but make it single-line with items separated by a middle dot. For plain text body, use `line-clamp-1`.

5. **Bottom metadata strip** (optional, only when data exists): A single flex row `text-[10px] text-muted-foreground/50 gap-2` showing:
   - Parent story context: `parentKey` as mono font if present
   - Entity state chip: Keep colored chip but use `text-[9px] px-1 py-0 rounded-sm border` (smaller than current)
   - These should be inline, not stacked

6. **Unread vs read distinction:** Unread rows get `bg-accent/30` (subtle, not heavy), title gets `font-medium`. Read rows get transparent bg, title `font-normal text-foreground/80`.

7. **Hover actions:** Keep the same ActionButton component and hover swap pattern (timestamp hidden, actions shown). Make action buttons `p-0.5` with `w-3 h-3` icons for tighter fit. Add a subtle `rounded-sm` and `hover:bg-accent` instead of `hover:bg-muted`.

8. **Density support:** Add `density-compact:py-1.5 density-comfortable:py-2.5` to the main button.

Keep all existing helper functions (getRelativeTime, getInitials, linkifyText, labelMap, colorMap, ActionButton). Only change the layout/JSX in the default export and ActionButton styling.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/notifications/NotificationRow.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>NotificationRow renders a sleek, compact card-style layout with issue key extracted and highlighted, dense metadata row, single-line body preview, and all data fields visible. Props interface unchanged — NotificationPopover works without modification.</done>
</task>

<task type="auto">
  <name>Task 2: Update tests for redesigned layout</name>
  <files>taskflow/src/routes/notifications/NotificationRow.test.tsx</files>
  <action>
Update the test file to match the new layout structure. The props interface is unchanged, so test setup stays the same.

Changes needed:
1. Remove test for "by J.Smith" text — now just renders "J.Smith" without "by" prefix.
2. Update border class test if border-l-4 changed to border-l-3.
3. Add test: "extracts and renders issue key separately from title" — for an item with entityTitle "PROJ-123: Fix login bug", verify both "PROJ-123" and "Fix login bug" appear (the key in mono style).
4. Add test: "renders unread dot indicator when isUnread is true" — check for a small blue dot element.
5. Add test: "renders parent key when parentKey is provided" — create item with parentKey "PROJ-100", verify it appears.
6. Keep existing tests for: entity title rendering, body preview rendering, type label rendering, entityState chip rendering, source badge text.
7. Adjust any selectors that relied on the old DOM structure (e.g., if looking for button className, ensure the selector matches the new structure).

Run `npx vitest run src/routes/notifications/NotificationRow.test.tsx` to verify all pass.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/notifications/NotificationRow.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>All notification row tests pass, covering the redesigned layout including issue key extraction, unread dot indicator, parent key display, source badges, type badges, and entity state chips.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Redesigned notification row with sleek modern card-style layout, dense metadata, extracted issue keys, and maximum data visibility</what-built>
  <how-to-verify>
    1. Open the app and trigger some notifications (or have existing ones)
    2. Open the notification popover from the header bell icon
    3. Verify rows look sleek and modern:
       - Issue key (e.g. PROJ-123) appears in mono font, separated from title
       - Author avatar + name on top line, source and type badges compact
       - Body preview is single-line and compact
       - Parent story keys appear when present
       - Entity state chips (merged/closed/opened) appear inline
    4. Verify unread rows have subtle blue dot and slightly tinted background
    5. Hover over a row — verify action buttons (arrow, external link, X) appear where timestamp was
    6. Click a row to toggle read/unread — verify visual state changes
    7. Confirm overall style matches the rest of the app (Geist font, consistent colors)
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `cd taskflow && npx vitest run src/routes/notifications/NotificationRow.test.tsx` — all tests pass
- `cd taskflow && npx tsc --noEmit` — no TypeScript errors
- NotificationPopover renders NotificationRow without any changes needed
</verification>

<success_criteria>
- Notification rows are visually sleek with card-like hover, compact badges, extracted issue keys
- Maximum data density: source, type, author, avatar, issue key, title, body preview, timestamp, parent key, entity state all visible
- Unread/read states clearly distinguishable with subtle dot indicator
- Hover actions work without layout shift
- All existing functionality preserved (click toggle, navigate, dismiss, open in browser)
- Tests pass, TypeScript compiles
</success_criteria>

<output>
After completion, create `.planning/quick/260318-uth-redesign-the-notification-row-to-look-sl/260318-uth-SUMMARY.md`
</output>
