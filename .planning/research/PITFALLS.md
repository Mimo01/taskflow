# Pitfalls Research

**Domain:** Drag-and-drop rank/transition + non-blocking peek slideover + bulk subtask creation in Tauri 2 / React 18 / TanStack Query
**Researched:** 2026-06-02
**Confidence:** HIGH (codebase-verified + official docs) / MEDIUM (Tauri webview quirks — platform-specific reports vary)

---

## Critical Pitfalls

### Pitfall 1: Optimistic reorder flicker — TanStack Query cache as DnD source of truth

**What goes wrong:**
When `onDragEnd` fires, the optimistic reorder is written to the TanStack Query cache via `setQueryData`. React re-renders from the cache, which momentarily returns to the pre-drag server order because a background refetch (triggered by invalidation or staleness) overwrites the cache before the mutation call completes. The card visibly snaps back to its old position for a frame, then re-settles — a jarring "flicker on drop" users immediately notice.

The existing backlog optimistic pattern (Phase 74) avoids this for sprint-move operations by snapshotting the `['gh-backlog', boardId]` cache and patching it in place (`queryClient.setQueryData`). The rank-reorder case is more sensitive because the mutation is asynchronous and the data.json poll interval (if active) can fire during the mutation window.

**Why it happens:**
`data.json` polling is route-aware and paused on inactive routes (`useIsActiveRoute`), but when BacklogPage is the active route the poll fires every 60s. If the poll completes between the `setQueryData` optimistic write and the `PUT /rest/agile/1.0/issue/rank` mutation response, the poll response replaces the optimistic order with the server's pre-mutation order.

**How to avoid:**
1. Maintain a **local `items` state** (array of issue IDs in display order) that is the single source of truth for rendered order during an active drag. Only sync this local state from the query cache when `isDragging === false` (gate the `useEffect` with an `isDraggingRef`).
2. In `onDragEnd`: update local state immediately (instant visual confirmation), then fire the mutation. In mutation `onMutate`, also call `queryClient.cancelQueries({ queryKey: ['gh-backlog', boardId] })` to prevent the in-flight poll from overwriting.
3. In mutation `onError`: snapshot was taken in `onMutate`; restore the local state and the query cache from the snapshot.
4. In mutation `onSettled`: call `invalidateGhBacklogData(queryClient, boardId)` to sync fresh server rank order.

**Warning signs:**
- Card returns to old position for one frame after drop
- Optimistic order matches server but still flickers on high-latency connections
- Duplicate rows briefly visible on rapid back-to-back reorders

**Phase to address:**
Drag-to-rank (Backlog) phase — the local-state/isDragging pattern must be in the initial implementation, not retrofitted.

---

### Pitfall 2: GreenHopper rank API requires `rankCustomFieldId` — wrong field ID silently places issue at the end

**What goes wrong:**
The `PUT /rest/agile/1.0/issue/rank` endpoint accepts an optional `rankCustomFieldId`. If omitted, Jira uses the board's default rank field. If the wrong field ID is passed (e.g., derived from a guess rather than the backlog response), the issue is silently placed at the last position instead of the requested position. There is no error — the server returns 200 and the list appears reordered, but the rank field updated is wrong and on next page load the issue is back at the end.

The `GhBacklogResponse` carries `rankCustomFieldId: number` at the top level (confirmed in `types.ts` line 207 and `data.real.json` fixture). This is the authoritative source.

**Why it happens:**
Developers hardcode `customfield_10119` (a common default) rather than reading `data.rankCustomFieldId` from the cached `['gh-backlog', boardId]` response. The rank succeeds silently against the wrong field. The bug only manifests on the next page load.

**How to avoid:**
Read `rankCustomFieldId` directly from the cached `GhBacklogResponse`: `queryClient.getQueryData<GhBacklogResponse>(['gh-backlog', boardId])?.rankCustomFieldId`. Pass this value to the rank mutation. If the value is missing (cache miss or undefined), refuse the mutation and log a warn rather than proceeding with a hardcoded fallback. Write a unit test that asserts the mutation passes the field ID from the fixture, not a hardcoded constant.

**Warning signs:**
- Rank API returns 200 but issue reappears at original position on next `data.json` fetch
- No error in the console or network panel
- Bug is reproducible only after a page reload or data invalidation

**Phase to address:**
Drag-to-rank (Backlog) phase — add the field ID assertion to the unit test for the rank mutation before the mutation code is written.

---

### Pitfall 3: Mixing vertical-rank drag with horizontal-transition drag on the same board in one DnD context

**What goes wrong:**
The sprint board requires **two drag semantics**: rank reorder within a column (vertical, same status) and status transition by dropping onto a different column (horizontal). Using a single `DndContext` with `SortableContext` for both means the sorting strategy (`verticalListSortingStrategy`) assumes items remain in one axis. When a card crosses a column boundary, the `SortableContext` of the source column loses track of the active item and the UI shows a ghost in the wrong column or no ghost at all.

**Why it happens:**
`@dnd-kit/sortable`'s `verticalListSortingStrategy` and `rectSortingStrategy` are both column-local. They do not know about sibling columns. Multi-column kanban boards need a custom `collisionDetection` strategy that distinguishes "drop on same column" (rank reorder) from "drop on different column" (transition).

**How to avoid:**
Use `closestCenter` collision for within-column rank reorder, and use a **custom droppable zone** (not a SortableContext item) for the column headers or column drop areas for cross-column transition. The drag architecture should be:
- Each column is a `Droppable` target identified by its status ID.
- Cards within a column are `Sortable` items for rank reorder.
- On `onDragEnd`: if `active.data.current.sortable.containerId === over.id`, it is a rank reorder. If they differ, it is a status transition.
- For the split per-transition drop zone feature: render each valid transition target as a separate named droppable (not the column header), visible only during drag.

On the backlog (ranked list), there is no horizontal dimension — use only `verticalListSortingStrategy` without column droppables.

**Warning signs:**
- Drag ghost appears at wrong position when crossing column boundary
- `onDragEnd` fires with `over === null` when dropping on a column (not a card)
- Rank reorder fires when dropping cross-column, instead of transition

**Phase to address:**
Drag-to-transition (Sprint Board) phase — the droppable/sortable split is architecture, not a detail. Must be designed before the first drag is implemented on the board.

---

### Pitfall 4: Per-transition split drop zones derive stale transition data — the `peekGhTransitions` miss case

**What goes wrong:**
The per-transition drop zones on the sprint board must show only valid target transitions for the dragged card's current status. These are derived via `peekGhTransitions(queryClient, projectId, issueTypeId)` — a synchronous cache read that returns `undefined` when the envelope is not loaded. If the board renders before the `['gh-transitions-envelope', projectId]` query settles, `peekGhTransitions` returns `undefined` and the drop zones are not rendered. The user drags a card and sees empty drop zones or no drop zones.

Additionally, the transition list is filtered through `filterTransitionsForStatus(transitions, currentStatusId)` but the card's `currentStatusId` comes from the adapted issue in the TanStack Query cache. If the cache is stale (e.g., the status was changed from the issue detail panel and the sprint board has not yet re-fetched), the filter produces the wrong valid-transition set.

**Why it happens:**
`peekGhTransitions` is intentionally synchronous (no `await`, no hook call inside a map) so it can be called during render for every card simultaneously. The tradeoff is that it returns `undefined` on cache miss. Phase 73 already wired `invalidateGhAllData` from `FieldsSection.transitionMutation.onSettled` to keep the board live after issue-detail status changes — but the transitions envelope is separate from allData.

**How to avoid:**
1. Ensure `useGhTransitions(projectId, issueTypeId)` is called at the board level (not per-card) during board mount, pre-warming the envelope cache before any drag starts. The board already renders cards with their project ID — a single `useGhTransitions` call at the parent is sufficient.
2. During drag: read drop zone targets from the pre-warmed cache via `peekGhTransitions`. If still `undefined`, show a "Loading transitions…" placeholder drop zone rather than nothing.
3. After a successful status transition on the board, call `invalidateGhTransitions(queryClient, projectId)` in addition to `invalidateGhAllData`. Stale transitions become visible only if a transition's `fromStatusId` list changes — rare, but possible after workflow edits.

**Warning signs:**
- Drop zones do not appear during first drag after board load
- After inline issue-detail status change, drag shows wrong available transitions
- Cards with different issue types show the same transition options (type indexing broken)

**Phase to address:**
Drag-to-transition (Sprint Board) phase — transition pre-warming must be a named step in the implementation plan.

---

### Pitfall 5: Transitions with `hasScreen: true` or `hasValidators: true` silently block the drag-drop

**What goes wrong:**
The GreenHopper `GhTransition` type carries `hasScreen: boolean` and `hasValidators: boolean`. Dragging a card into a drop zone and triggering `POST /rest/api/2/issue/{key}/transitions` on a transition that has a required screen returns HTTP 400 with a workflow validation error body. The optimistic update has already moved the card visually. The rollback restores the card — but with no user-facing explanation, the card appears to "refuse to drop" with no feedback.

A validator might also block the transition (e.g., "all subtasks must be done before moving story to Done") returning HTTP 400 or HTTP 500 with a workflow error. The current `postTransition` call (used by `StatusPopover`) handles rollback but surfaces a generic "Failed" label, which is acceptable for a deliberate click but disorienting when caused by a drag.

**Why it happens:**
The transition list shown during drag does not filter out `hasScreen` or `hasValidator` transitions — they appear as valid drop targets. The user drops and the POST fails. Screen-required transitions need a modal form; validator-blocked transitions need an explanation.

**How to avoid:**
1. Read `hasScreen` and `hasValidators` from the `GhTransition` shape (available in `transitions.ts`'s `__adaptToJiraTransition` — but these fields are not currently propagated through to the `JiraTransition` shape). Add `hasScreen?: boolean` and `hasValidators?: boolean` to `JiraTransition` during this phase so the board can read them.
2. Filter `hasScreen: true` transitions out of the drag drop zone targets. Transitions requiring a screen can still be triggered via the `StatusPopover` click flow (which can open the screen form).
3. For `hasValidators: true`: show the drop zone but, on API failure with a workflow error body, display an inline toast: "Transition blocked: [validator message from response body]". Do not silently roll back.

**Warning signs:**
- Card snaps back after drop with no error message
- Network panel shows 400 with `{"errorMessages":["Workflow..."]}` body
- Specific transitions only fail for certain issue types or when issue has open subtasks

**Phase to address:**
Drag-to-transition (Sprint Board) phase — `hasScreen`/`hasValidators` filtering must be in the initial drop zone rendering logic.

---

### Pitfall 6: Drag vs click disambiguation — peek opens on card click, drag must not trigger peek

**What goes wrong:**
The universal peek opens on any click that is not on the issue key. Adding drag handles to cards means pointer-down on the card body could be either the start of a drag or the start of a click. If there is no disambiguation, dropping a card (even a 5px drag) fires both `onDragEnd` and the click handler, opening the peek for the dropped card immediately after a transition drop. Conversely, if click is suppressed too aggressively, the user cannot open the peek by clicking a card that happens to have a drag handle.

**Why it happens:**
dnd-kit's `PointerSensor` stops propagation of click events once activation constraints are satisfied. With no activation constraint, any `pointerdown` immediately starts the drag and the subsequent `pointerup` does not fire a click. With a distance constraint (e.g., 8px), a click that does not move 8px fires a click normally — but with a zero-movement quick-drag, neither drag nor click fires (known edge case in dnd-kit issue #495: distance-constrained sensor can emit `onDragStart` without `onDragEnd`).

**How to avoid:**
Use the **delay + tolerance** sensor configuration, not a distance constraint:
```typescript
useSensor(PointerSensor, {
  activationConstraint: { delay: 150, tolerance: 5 },
})
```
150ms hold before drag activates; a quick release (< 150ms) fires the click handler normally. 5px tolerance means a tiny hand-shake during the hold does not abort the drag. This mirrors the approach used by Jira's own board (empirically observed: ~120-150ms delay).

Additionally, on `onDragEnd` set a ref `justDragged = true` and clear it after `requestAnimationFrame`. In the click handler: `if (justDragged) return;` to suppress peek on card that was just dropped.

**Warning signs:**
- Peek opens on every successful drag-drop
- A fast click does not open peek because it is captured as an aborted drag
- dnd-kit drag overlay never disappears (stuck `onDragStart` without `onDragEnd` — distance-constraint edge case)

**Phase to address:**
Both drag phases (backlog rank and board transition) — and the peek slideover phase. All three must agree on the disambiguation contract before any of them ship.

---

### Pitfall 7: Drag inside `@tanstack/react-virtual` — the `rectSortingStrategy` does not work with virtual rows

**What goes wrong:**
`BacklogPage` uses `@tanstack/react-virtual` with `useVirtualizer`. The current code has `useVirtual = false` (the comment explains that `position: absolute` on `<tr>` elements is undefined behavior). If virtualization is re-enabled for the rank-drag feature (to handle very long backlog lists), using `rectSortingStrategy` (the default) fails because it needs all items to be mounted to calculate sort positions. Items outside the viewport are unmounted by the virtualizer.

Additionally, the currently-dragged item may scroll out of the virtual window during a long drag. When it does, the item is unmounted. The `DragOverlay` shows a ghost, but when the drag ends and the overlay animates back, there is no mounted element to animate to — causing an abrupt disappear.

**Why it happens:**
Virtualization intentionally unmounts off-screen rows. `rectSortingStrategy` calls `getBoundingClientRect()` on every item in the list to compute positions. Items outside the viewport have no DOM node to measure.

**How to avoid:**
1. Do not re-enable `useVirtual` in `VirtualizedBacklogTable` as part of the rank-drag feature. The current `useVirtual = false` setting is intentional (see the comment in the source). The active sprint backlog section is bounded in practice (one sprint = 20-50 items) — non-virtual DOM rendering is fine.
2. If the backlog section (unsprinted issues) grows large enough to require virtualization, use `verticalListSortingStrategy` (supports virtualized lists), ensure the active drag item is always included in the rendered set regardless of scroll position (add its ID to the overscan window), and use a `DragOverlay` to render the drag ghost independently of the source item's DOM presence.

**Warning signs:**
- Drag ghost disappears mid-drag when scrolling a long list
- `rectSortingStrategy` console warning: "Could not find draggable node"
- Sort order jumps when passing the virtual window boundary

**Phase to address:**
Drag-to-rank (Backlog) phase — explicitly document the `useVirtual = false` decision in the implementation plan.

---

### Pitfall 8: Tauri webview `mouseup` event loss on Windows — drag state gets stuck

**What goes wrong:**
On Windows, the Tauri webview (WebView2/Edge) has a known bug where clicking on a drag-region within the webview causes the `mouseup` event to be swallowed by the native window manager (Tauri issue #10767). If the drag handle area overlaps with any native drag region, a `pointerdown` is received but no `pointerup` arrives in the webview. dnd-kit's `PointerSensor` never fires `onDragEnd`. The drag overlay remains on screen and follows the pointer indefinitely until the user clicks again.

This is separate from the HTML5 drag API bug (Tauri issue #6695) — dnd-kit uses pointer events, not the HTML5 drag API, but the `mouseup` loss still affects it on Windows when native drag regions overlap.

**Why it happens:**
Taskflow uses `data-tauri-drag-region` on the header titlebar. Card drag handles near the top of the viewport (within the header) may overlap the drag region. Even without overlap, WebView2 on some Windows versions intercepts pointer events differently than macOS WebKit.

**How to avoid:**
1. Explicitly exclude card drag handles from `data-tauri-drag-region` overlap. Cards are in the main scrollable content area, well below the header — this should not be an issue structurally, but verify by inspecting z-index and the element tree.
2. Use dnd-kit's `PointerSensor` (not the HTML5 drag API). Do not use `draggable` HTML attributes — those trigger HTML5 drag which is known-broken in Tauri webviews (issue #6695).
3. Add a global `pointermove` listener during drag that calls `sensor.cancel()` on `pointercancel` — dnd-kit already handles this internally, but verify it fires on Windows.
4. Test on Windows before shipping the drag feature. macOS drag works first; Windows needs explicit validation.

**Warning signs:**
- Drag overlay stays visible after mouse button released (Windows only)
- Board/backlog becomes unresponsive after a drag (stuck drag state)
- Issue only reproducible on Tauri builds, not in browser dev server

**Phase to address:**
Both drag phases — add "test on Windows" as an explicit UAT step. Use `touch-action: none` on all draggable elements (required for PointerSensor on all platforms).

---

### Pitfall 9: Non-blocking peek — shadcn Sheet focus trap blocks the underlying view

**What goes wrong:**
The existing `IssueDetailSheet` uses shadcn's `Sheet` component (`sheet.tsx`), which is built on Radix UI `Dialog`. Radix `Dialog` applies `aria-hidden="true"` to the rest of the document and traps focus inside the sheet via `focus-trap`. This makes the underlying backlog/board completely inaccessible via keyboard and effectively modal — the opposite of the desired non-blocking behavior. The user cannot J/K navigate the underlying list, click another card to swap the peeked issue, or interact with any UI outside the sheet while it is open.

**Why it happens:**
Radix Dialog's accessibility model is designed for modals. Using it for a non-blocking panel is the wrong primitive. The existing `IssueDetailSheet` (used for epics and the old sheet) inherits this behavior.

**How to avoid:**
Do not use shadcn `Sheet` / Radix `Dialog` for the universal peek. Instead, build the peek as a **positioned panel** (`position: fixed; right: 0; top: 0; height: 100vh`) with no focus trap and no `aria-hidden` on the document. Use Radix `FocusScope` with `trapped={false}` if keyboard navigation within the panel is still desired, or simply rely on natural tab order. The panel should have `role="complementary"` or `role="region"` with an `aria-label="Issue preview"`. Escape key closes it via a `useEffect` on `keydown`.

Do not render a backdrop/overlay — the underlying view must remain fully pointer-interactive. Use `z-index` only to float the panel above content, not to block it.

**Warning signs:**
- Clicking the backlog rows behind the open panel does nothing (pointer events blocked)
- Tab key cycles only within the panel, can never reach the list
- Screen reader announces "application" role instead of navigating normally

**Phase to address:**
Universal peek slideover phase — the component must be designed as a positioned panel, not a dialog. This is the single most important architectural decision for the peek.

---

### Pitfall 10: Stale query data when swapping the peeked issue by clicking a different card

**What goes wrong:**
The peek shows issue A (loaded into `['jira-issue-detail', 'A']` query). The user clicks card B in the underlying view. The `issueKey` prop changes to B. The `useQuery` for B fires with `staleTime: Infinity` (the session-persistent cache configured in v1.7). If B was previously opened, TanStack Query immediately returns the cached stale data while refetching in the background. The peek shows B's old description/status/comments for a moment before the fresh data arrives. If the user closes the peek before the background fetch completes, the stale data remains in the cache and the next open of B shows old data again.

This is particularly visible when the user transitions B's status via the board and then opens the peek — the peek shows the pre-transition status until the refetch completes.

**Why it happens:**
`gcTime: Infinity` and `staleTime: Infinity` (v1.7 decisions) trade network requests for instant navigation. The tradeoff is acceptable for read-only views but creates visible stale data for frequently-mutated fields (status, assignee, comments).

**How to avoid:**
For the issue detail queries used inside the peek, use `staleTime: 0` and `refetchOnMount: 'always'`. This ensures a fresh fetch every time the `issueKey` changes. The `gcTime: Infinity` can remain to keep the data in cache between views, but the stale threshold is zero so the background refetch always fires. The peek's loading state should show a skeleton for the fields that are likely to change (status, assignee) while revalidating, rather than showing old data without indication.

Alternatively, on mutation `onSettled` for any status/field mutation, call `queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey] })` — this already happens in some mutation paths (Phase 74) but must be verified for all mutation entry points that affect peek-visible fields.

**Warning signs:**
- Peek shows old status immediately after a board transition for the same issue
- Comment thread appears stale (new comment not visible) on second peek open
- `isFetching` is `true` but the peek shows outdated data without a loading indicator

**Phase to address:**
Universal peek slideover phase — set `staleTime: 0` on the issue-detail query used within the peek. Add a test fixture that verifies the peek query refetches on `issueKey` change.

---

### Pitfall 11: Issue-key click vs row-click disambiguation for the peek

**What goes wrong:**
The product spec requires: click anywhere on a row/card opens the peek, EXCEPT clicking the issue key (e.g., "PROJ-123" link) which navigates to the full-page detail. This requires two separate click targets on the same card. If the row has a global `onClick` handler and the issue key has its own `onClick` with `stopPropagation`, keyboard activation (`Enter` on the row) and assistive technology may bypass the key-specific handler and always trigger the row handler.

Additionally, if the issue key is wrapped in a React Router `<Link>`, the link's default navigation fires before the custom peek handler, causing both the peek to open and the route to change simultaneously.

**Why it happens:**
Global row click handlers and nested interactive elements (links, buttons) have conflicting event bubbling. `stopPropagation` on the key link prevents the peek handler from firing, but pressing Enter on the row (not the link) still fires the row's click handler. Using `<Link>` for the issue key triggers navigation AND bubbles to the row handler if `stopPropagation` is missed.

**How to avoid:**
Structure the card as: row has `onClick` (opens peek) and `role="button"` for keyboard. Issue key is a `<button type="button">` (not `<a>` or `<Link>`) with `onClick={(e) => { e.stopPropagation(); navigate('/issues/' + key); }}`. The key button also handles `onKeyDown` Enter separately. Using a button (not a link) prevents the navigation-before-peek race.

`cursor-pointer` must be on both the row and the key button explicitly — this matches the "fix `cursor-pointer` on clickable areas" requirement already in the v1.12 scope.

**Warning signs:**
- Clicking issue key both opens peek and navigates to full page
- Keyboard Enter on the issue key label opens peek instead of navigating
- Screen reader announces row as a link that triggers peek (incorrect semantic)

**Phase to address:**
Universal peek slideover phase — define the exact click/keyboard event contract in the design before implementing.

---

### Pitfall 12: Bulk subtask creation — partial failure leaves orphaned subtasks with no recovery path

**What goes wrong:**
Bulk creation loops `createIssue` N times in order (confirmed in `PROJECT.md`). If subtask 3 of 5 fails (API error, rate limit, required field missing), subtasks 1 and 2 are already created in Jira. There is no "delete created subtasks" rollback. The user sees a partial failure state with no clear indication of which subtasks were created and which were not. If they dismiss the dialog and retry the entire batch, they get duplicate subtasks 1 and 2.

**Why it happens:**
Sequential `createIssue` calls have no batch atomicity. Each call commits to Jira immediately. A mid-batch failure leaves the project in an inconsistent state.

**How to avoid:**
1. Track creation progress with a per-subtask status array: `[{ title, status: 'pending' | 'creating' | 'created' | 'failed', issueKey?: string, error?: string }]`. Show this state in the preview/progress UI during creation.
2. On partial failure: show the status array with clear per-row indicators (checkmark / spinner / X). Do not retry the entire batch. Provide a "Retry failed" action that only re-attempts the failed items by index, skipping already-created ones.
3. Deduplicate by title+parent: before retrying, check if a subtask with the same summary and parent key already exists. The `['jira-issue-detail', parentKey]` query's subtasks array is the cheapest check.
4. Never reset the status array on dialog close if any subtasks were created — persist it so the user can see what was created even after closing.

**Warning signs:**
- User retries bulk create and ends up with duplicate subtasks
- Progress modal closes on partial failure with no indication of what succeeded
- Created subtasks not visible in the parent's subtask list (cache not invalidated after partial success)

**Phase to address:**
Bulk subtask creation phase — the per-subtask status array must be in the initial state design, not added when the first partial failure is reported.

---

### Pitfall 13: `createmeta` required field validation — fields that are required on the instance but absent from the template

**What goes wrong:**
The subtask template stores fields the user configured: title, description, assignee, priority, etc. When `createIssue` is called, Jira validates against the project's `createmeta` for the subtask issue type. If the project has a required custom field (e.g., a mandatory team-specific `Epic Link` or a required label field) that is not in the template and has no default value, the create call returns HTTP 400 with `{"errors":{"customfield_XXXXX":"Field is required"}}`. The batch fails for every subtask in the template.

**Why it happens:**
`createmeta` returns the required fields at template-build time. But the project's scheme can be modified after the template is saved (a new required field added by a Jira admin). The saved template does not know about the new required field.

Additionally, the existing `CreateEditIssueModal` already uses `discoverCustomFields()` + `createmeta` to discover required fields dynamically — but the subtask template creation UI may not call createmeta fresh each time the user opens the "create" dialog.

**How to avoid:**
1. Call `createmeta` fresh when the user opens the subtask creation wizard (not from a cached snapshot). Use the same `discoverCustomFields` pattern from `CreateEditIssueModal`.
2. On 400 error in `createIssue`: parse the `errors` object to extract the missing field names. Display them in the per-subtask status row: "Failed: 'Epic Link' is required". Surface a "Fill required fields" inline editor for the failed subtask's row before retry.
3. Add a "validate all" dry-run step before committing any creates: call `createmeta` and diff the template's fields against the required field list. Warn about missing required fields before starting creation.

**Warning signs:**
- All subtasks fail with 400, same error
- Error message references a `customfield_` ID rather than a human-readable name
- Template was built on a different project's issue type configuration

**Phase to address:**
Bulk subtask creation phase — the createmeta fresh-fetch must be in the wizard open flow. The required-field diff check is the recommended pre-create validation step.

---

### Pitfall 14: Card color left-edge stripe fails WCAG contrast in dark mode

**What goes wrong:**
Priority colors (e.g., Highest = red, High = orange, Medium = yellow, Low = blue, Lowest = gray) as defined by Jira's default priority scheme are designed for light backgrounds. The hex values `#FF0000` (Highest), `#FF7722` (High), `#FFAA33` (Medium) fail the WCAG 3:1 minimum contrast ratio for UI components against the app's dark mode surface color (`hsl(240 3.7% 15.9%)` from shadcn dark). Yellow/orange priority colors are particularly problematic: they appear washed out or invisible as thin left-edge stripes in dark mode.

**Why it happens:**
The existing `epicColorToTailwind` mapping in `lib/epicColors.ts` maps Jira color names to Tailwind classes optimized for the `bg-` use case (background chips). A 3px left-edge stripe at the same color value does not have enough surface area for the contrast to be perceptually adequate. Also, the Jira priority icon URLs (returned by `fields.priority.iconUrl`) link to SVGs hosted on the Jira instance — these cannot be CSS-colored and may not be legible at small sizes.

**How to avoid:**
1. Define a separate `priorityToStripeColor` map that uses **slightly adjusted HSL values** tuned for dark mode: increase saturation and luminosity for dark mode, decrease for light mode. Use a CSS custom property per priority so the dark-mode override can be applied via Tailwind's `dark:` variant.
2. Supplement the color stripe with a **priority icon** (Lucide icon or the Jira priority icon) displayed inside the card, not just the edge stripe. Color alone cannot be the only indicator (WCAG 1.4.1).
3. Use the 4 most distinct hues: red (Highest/High), amber (Medium), blue (Low/Lowest), with icon+label as fallback when colors are insufficient. Avoid yellow and cyan in the stripe — they fail contrast against both light and dark backgrounds.
4. Test with `prefers-color-scheme: dark` in DevTools and validate each priority stripe with a contrast checker.

**Warning signs:**
- Left-edge stripe is invisible in dark mode (yellow/orange on dark surface)
- Contrast checker reports < 3:1 for any stripe color against the card background
- Users cannot distinguish priorities by color alone without labels

**Phase to address:**
Card colors phase — define the dark-mode-aware color map before implementing the stripe component.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use shadcn Sheet for peek | Reuses existing component | Focus trap blocks underlying view — must be replaced entirely | Never — wrong primitive for non-blocking panel |
| Hardcode `rankCustomFieldId` as a constant | Avoids cache read | Silent rank-to-wrong-field on instances with non-default field IDs | Never |
| Skip `cancelQueries` in rank mutation `onMutate` | Simpler code | Poll overwrites optimistic order, causing flicker | Never for the active-route backlog |
| Single `onClick` on card row without drag/click disambiguation | Simpler event model | Peek opens on every drag drop | Never with drag enabled |
| Retry entire bulk-create batch on partial failure | Simpler retry logic | Duplicate subtasks in Jira | Never |
| Cache createmeta at template-save time | Fewer API calls | Required fields added after save cause silent batch 400s | Only acceptable with an explicit "re-validate" affordance |
| Skip `hasScreen` filtering on drag drop zones | All transitions shown | Cards snap back silently when screen-required transition is dragged | Never — filter at drop zone render time |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GreenHopper rank API | Omit `rankCustomFieldId` | Read `data.rankCustomFieldId` from `GhBacklogResponse` cache; pass explicitly |
| GreenHopper rank API | Use `rankBeforeIssue` / `rankAfterIssue` with a key that is not in the index | Validate the target issue key is present in the current backlog data before calling rank |
| GreenHopper transitions | Not filtering `hasScreen: true` transitions from drop zones | Propagate `hasScreen` through to `JiraTransition`; filter at drop zone render |
| GreenHopper transitions | Calling `peekGhTransitions` before envelope loads | Pre-warm envelope with `useGhTransitions` at board mount; show placeholder if still `undefined` |
| Jira createIssue (subtasks) | Assuming template fields cover all required fields | Fresh `createmeta` call on wizard open; diff required fields before batch create |
| Jira createIssue (subtasks) | No per-subtask status tracking | Track status array `pending/creating/created/failed` per item; never retry already-created |
| dnd-kit PointerSensor in Tauri | Using HTML5 `draggable` attribute | Never use HTML5 drag API in Tauri; use dnd-kit PointerSensor with `touch-action: none` |
| dnd-kit + TanStack Query | Relying on query cache as DnD state | Maintain separate `localItems` state; only sync from cache when `isDragging === false` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `rectSortingStrategy` with virtualized rows | "Could not find draggable node" errors; sort jumps at scroll boundary | Use `verticalListSortingStrategy`; do not re-enable `useVirtual` for the sprint list | Any backlog with virtualization enabled |
| Calling `peekGhTransitions` every render per card | Recomputes `statusMap` on every call (O(n) statuses each time) | Memoize the `statusMap` at the board level; pass as prop to card renderers | Boards with > 10 cards (immediate) |
| Bulk subtask create N sequential awaits | UI blocked during creation; no progress | Use `Promise.allSettled` with a concurrency limit of 2-3; update per-subtask status on each resolution | Batch size > 5 |
| Fresh `createmeta` call per subtask in batch | N × createmeta fetches for N subtasks | Call `createmeta` once at wizard open; cache for session | Batch size > 1 |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Peek opens on drag drop | Unexpected panel opens after every rank reorder | Set `justDragged` ref; suppress peek click handler for one animation frame after drag end |
| No visual feedback during drag for per-transition drop zones | User doesn't know where they can drop | Render highlighted drop zone targets (visible only during drag) showing transition names |
| Bulk create progress dialog closes on any error | User loses track of which subtasks were created | Never auto-close on partial failure; show per-subtask status array; require explicit dismiss |
| Card color stripe too thin to distinguish in dark mode | Users cannot identify priority at a glance | Use 4px stripe + icon; test all color values against dark background in DevTools |
| Peek panel covers ≥ 50% of board in mobile-like window sizes | Underlying view is effectively hidden | Set max-width to 480px; below 768px breakpoint, increase width to 100% and add a close affordance |

---

## "Looks Done But Isn't" Checklist

- [ ] **Drag-to-rank**: `cancelQueries` is called in mutation `onMutate` — verify the poll cannot overwrite the optimistic order
- [ ] **Drag-to-rank**: `rankCustomFieldId` is read from the cache, not hardcoded — verified by unit test asserting the exact field ID from the fixture
- [ ] **Drag-to-transition**: `hasScreen: true` transitions are absent from drop zone targets — test with a fixture that includes a screened transition
- [ ] **Drag-to-transition**: `peekGhTransitions` returns valid data at board mount (envelope pre-warmed) — verified by loading the board and immediately dragging a card
- [ ] **Peek slideover**: no `aria-hidden` on document root when peek is open — inspect DOM with DevTools
- [ ] **Peek slideover**: clicking a backlog row behind the open peek opens the new issue in the peek (row is pointer-interactive) — verified by test
- [ ] **Peek slideover**: issue-key click navigates to full page without opening peek — both actions tested separately
- [ ] **Peek slideover**: `staleTime: 0` on the issue-detail query within the peek — verified by network tab showing fresh fetch on each `issueKey` change
- [ ] **Bulk create**: per-subtask status array is shown in progress UI — manual test with a forced failure on subtask 2 of 4
- [ ] **Bulk create**: retry sends only failed subtasks, not already-created ones — test with partial failure fixture
- [ ] **Card colors**: all priority stripe colors pass 3:1 contrast check in dark mode — verified with DevTools contrast checker
- [ ] **Card colors**: priority indicator includes icon + color (not color alone) — checked against WCAG 1.4.1
- [ ] **Tauri Windows**: drag does not get stuck after drop — manual test on Windows build

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Peek built on shadcn Sheet (focus trap) | HIGH | Full component rewrite as positioned panel; cannot be patched |
| Rank mutation uses wrong `rankCustomFieldId` | LOW | One-line fix in mutation call; add unit test |
| Flicker on drop (cache/local-state mismatch) | MEDIUM | Add `isDraggingRef` gate to cache sync `useEffect`; 30-minute fix |
| Duplicate subtasks from full batch retry | MEDIUM | Add title+parent deduplication check before retry; user must manually delete duplicates in Jira |
| `hasScreen` transitions in drop zones cause silent snap-back | LOW | Filter `hasScreen: true` transitions at drop zone render; propagate field through `JiraTransition` type |
| Card color fails WCAG in dark mode | LOW | Update color map with dark-mode-adjusted values; `dark:` variant CSS property override |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Optimistic reorder flicker | Drag-to-rank (Backlog) | Drop a card on slow connection (throttled DevTools); no flicker observed |
| Wrong `rankCustomFieldId` | Drag-to-rank (Backlog) | Unit test: mutation receives `rankCustomFieldId` matching `data.real.json` fixture |
| Mixed vertical/horizontal DnD context | Drag-to-transition (Sprint Board) | Drop zone architecture review before first card is draggable on the board |
| Stale `peekGhTransitions` on first drag | Drag-to-transition (Sprint Board) | Pre-warming step in board mount; drag a card immediately after load |
| `hasScreen` transition in drop zone | Drag-to-transition (Sprint Board) | Fixture with `hasScreen: true` transition absent from drop zone targets |
| Drag vs click — peek fires on drop | Both drag phases + peek phase | Drop a card; peek must not open. Click a card; peek must open |
| `@tanstack/react-virtual` + drag | Drag-to-rank (Backlog) | `useVirtual = false` documented; no regression on virtualization flag |
| Tauri Windows mouse event loss | Both drag phases | Manual test on Windows Tauri build before phase is marked done |
| Focus trap blocks underlying view | Peek slideover phase | Inspect DOM: no `aria-hidden` on document; click behind open peek navigates correctly |
| Stale query on issue key swap | Peek slideover phase | Network tab: fresh fetch fired each time `issueKey` changes in the peek |
| Partial bulk create failure | Bulk subtask creation phase | Force failure on subtask 2 of 4; verify subtasks 1 created, 3-4 show "failed", retry sends only 3-4 |
| Missing required fields in template | Bulk subtask creation phase | Add a required custom field to the test Jira project; verify pre-create validation surfaces it |
| Card color WCAG fail in dark mode | Card colors phase | DevTools contrast check on each priority stripe in dark mode; all pass 3:1 |

---

## Sources

- Codebase: `taskflow/src/services/jira/greenhopper/transitions.ts` (Phase 72 cache layer, `peekGhTransitions`, `filterTransitionsForStatus`, `GhTransition.hasScreen/hasValidators`), `types.ts` (`GhBacklogResponse.rankCustomFieldId`), `BacklogPage.tsx` (Phase 74 optimistic sprint-move pattern, `useVirtual = false` comment), `SprintBoardTab.tsx` (Phase 73 column architecture, `peekGhTransitions` usage), `IssueDetailSheet.tsx` (existing Sheet primitive)
- dnd-kit drag vs click: [dnd-kit Discussion #476](https://github.com/clauderic/dnd-kit/discussions/476), [dnd-kit Issue #591](https://github.com/clauderic/dnd-kit/issues/591)
- dnd-kit + TanStack Query flicker: [dnd-kit Discussion #1522](https://github.com/clauderic/dnd-kit/discussions/1522)
- dnd-kit + @tanstack/react-virtual: [dnd-kit Issue #1720](https://github.com/clauderic/dnd-kit/issues/1720), [Issue #1674](https://github.com/clauderic/dnd-kit/issues/1674), [Discussion #411](https://github.com/clauderic/dnd-kit/discussions/411)
- Tauri webview drag bugs: [Tauri Issue #6695 (webkit drag)](https://github.com/tauri-apps/tauri/issues/6695), [Tauri Issue #10767 (mouseup loss on Windows)](https://github.com/tauri-apps/tauri/issues/10767)
- TanStack Query optimistic updates: [TanStack Query v4 Optimistic Updates](https://tanstack.com/query/v4/docs/react/guides/optimistic-updates)
- GreenHopper rank API: [Jira Agile REST API — rank endpoint](https://docs.atlassian.com/jira-software/REST/7.3.1/), [RankService 11.2.1](https://docs.atlassian.com/jira-software/11.2.1/com/atlassian/greenhopper/api/rank/RankService.html), [LexoRank management (DC)](https://confluence.atlassian.com/adminjiraserver/managing-lexorank-938847803.html)
- Jira transitions + screens: [Jira workflow transitions blog](https://www.herocoders.com/blog/understanding-jira-workflow-transitions)
- Focus trap / scroll bleed: [react-focus-lock npm](https://www.npmjs.com/package/react-focus-lock), [react-remove-scroll npm](https://www.npmjs.com/package/react-remove-scroll)
- WCAG card colors: [WCAG 2.2 contrast guide](https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025), [InclusiveColors tool](https://www.inclusivecolors.com/)

---
*Pitfalls research for: Drag-and-drop rank + transition + non-blocking peek + bulk subtask creation in Tauri 2 / React 18 / TanStack Query / dnd-kit*
*Researched: 2026-06-02*
