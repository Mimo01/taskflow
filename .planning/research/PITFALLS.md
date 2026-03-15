# Pitfalls Research

**Domain:** UX & Branding features added to an existing Tauri 2 + React 18 + TypeScript desktop app
**Researched:** 2026-03-15
**Confidence:** HIGH (Tauri-specific pitfalls verified against official docs and GitHub issues; React/Zustand patterns from official docs and community issue trackers)

---

## Critical Pitfalls

### Pitfall 1: macOS Icon Appears Oversized in the Dock (No Canvas Padding)

**What goes wrong:**
Running `tauri icon app-icon.png` and replacing the existing `src-tauri/icons/` files with the output produces an icon that looks visually larger than all other macOS dock icons. This is not a rendering bug — the icon genuinely occupies more canvas space. macOS requires roughly 18% transparent padding inside the `.icns` file, and Tauri's generator does not add this padding automatically.

**Why it happens:**
Apple's Human Interface Guidelines mandate that macOS app icons include transparent padding so the OS can apply consistent visual weight and shadow compositing across the dock. Tauri's `tauri icon` CLI generates all icon sizes from the source image at full bleed — it does not pad for macOS conventions. The generated `icon.icns` therefore renders as if the artwork fills the entire dock tile, which breaks visual parity with system apps. This is a documented community issue: https://github.com/tauri-apps/tauri/discussions/10999

**How to avoid:**
1. Design or resize the source artwork to approximately 860×860 px placed on a transparent 1024×1024 canvas (about 82 px padding on each side — roughly 8% per side).
2. Run `tauri icon` from this padded source to generate all platform formats simultaneously.
3. If you need a macOS dock icon that looks identical to native Apple apps, replace only `src-tauri/icons/icon.icns` with a macOS-specific version generated from the padded source after the cross-platform run.
4. Do NOT reuse the same full-bleed source for the Windows system tray `.png` — the tray icon must be tight/full-bleed. Keep platform-specific variants separate.
5. Also update the five paths listed under `bundle.icon` in `tauri.conf.json`: `icons/32x32.png`, `icons/128x128.png`, `icons/128x128@2x.png`, `icons/icon.icns`, `icons/icon.ico`.

**Warning signs:**
- In `tauri dev`, the dock icon looks noticeably larger than Finder, Terminal, or other system apps.
- After running `tauri build`, the icon overshadows adjacent dock icons when hovering.
- The macOS App Center (Launchpad) also shows the icon as oversized.

**Phase to address:** App icon phase (first phase of v1.3). Get this right before any other visual work — icon changes are build-level (`tauri.conf.json` `bundle.icon`) and fixing after a release cycle wastes time.

---

### Pitfall 2: Cmd+K Opens Command Palette Twice Then Immediately Closes (Double-Fire on macOS)

**What goes wrong:**
A documented issue in `shadcn/ui` (using `cmdk` under the hood) causes the `Cmd+K` trigger to fire twice when the dialog is managed with a `useState` toggle: the first event opens the palette, the second immediately closes it. On macOS, `Cmd+K` appears to do nothing — the palette flickers and disappears.

**Why it happens:**
When the `window.addEventListener('keydown', ...)` handler and `cmdk`'s internal Dialog listener both respond to the same keydown event, the toggle runs twice in the same event cycle — open then close, net result: closed. This race is documented in shadcn/ui issue #2469. It only manifests on macOS (where `metaKey` is used); Windows `Ctrl+K` behaves correctly because `ctrlKey` dispatch works differently.

**How to avoid:**
- Register the `window` keydown handler with `{ capture: true }` so it fires before cmdk's internal handler and owns the event.
- Call `e.preventDefault()` AND `e.stopPropagation()` in the open-trigger handler to prevent the event reaching cmdk's own listener.
- Better: use `react-hotkeys-hook` with the `"mod"` alias — this library maps `mod` to `metaKey` on macOS and `ctrlKey` on Windows/Linux and includes built-in protection against double-fire.
- Verify with a real macOS device in the production build (not dev server) — behavior differs between environments.

**Warning signs:**
- `Cmd+K` on macOS appears to do nothing; the palette briefly flickers.
- The bug does not appear on Windows or Linux.
- Adding a `console.log` shows the open handler firing twice per keypress on macOS.

**Phase to address:** Command palette phase. Must be verified on a physical macOS machine in the production build before marking the feature complete.

---

### Pitfall 3: Multiple Overlays Competing for the Same `Escape` and Arrow-Key Events

**What goes wrong:**
The existing `SearchOverlay` already attaches `window.addEventListener('keydown', handler)` for `Escape`. Adding a command palette (also closing on `Escape`) and a `?` keyboard shortcut help panel (also closing on `Escape`) creates three independent handlers on the same event. Without explicit priority ordering, the wrong overlay closes, or all overlays close simultaneously when only one should.

The existing `IssueDetailSheet` from shadcn/ui's Dialog also intercepts `Escape` natively. Arrow-key navigation inside the command palette could also bleed through to sprint board drag handlers if they are mounted concurrently.

**Why it happens:**
All overlay components attach independently to the global `window` keydown stream. React's `useEffect` cleanup order during unmounts is non-obvious — a stale handler from a previous render cycle can persist. There is no existing priority registry in this codebase.

**How to avoid:**
- Before adding any new keyboard handlers, audit all existing `window.addEventListener('keydown', ...)` calls — currently: `SearchOverlay.tsx` (Escape close). Document them.
- Implement a centralized `useKeyboardShortcuts` hook or use `react-hotkeys-hook` with `enabled` props so all handlers go through a single registration point with explicit scoping.
- Use `{ capture: true }` for the topmost modal (command palette) so it intercepts before inner handlers.
- Each overlay should check "am I the topmost open UI element?" before acting on `Escape`. A simple approach: an `openOverlays` stack in a lightweight Zustand slice.
- For the `?` help panel shortcut: disable it when any `<input>`, `<textarea>`, or `[contenteditable]` is focused (see Pitfall 5).

**Warning signs:**
- Pressing `Escape` in the command palette also closes the `IssueDetailSheet` visible behind it.
- Arrow-key navigation inside the command palette moves sprint board cards if the board is mounted beneath the palette.
- The `SearchOverlay` `Escape` handler stops working after command palette is added.

**Phase to address:** Keyboard shortcuts phase — before wiring `?` and `Cmd+K` triggers, audit all existing keydown listeners. This audit must happen as the first task of the shortcuts phase.

---

### Pitfall 4: Zustand `settings.store` New Fields Are `undefined` for Existing Users After Update

**What goes wrong:**
The v1.3 settings redesign adds new persisted fields (e.g., `pinnedIssueKeys: string[]`, `recentItems: RecentItem[]`). Existing users already have a serialized `settings-store` in `settings.json` on disk with none of these keys. On rehydration, Zustand's shallow merge leaves the new fields as `undefined` — NOT the declared default — causing runtime crashes wherever the code does `.map()` or `.length` on an assumed array.

**Why it happens:**
Zustand's `persist` middleware shallow-merges the stored object over the initial state. If the stored object has no key for a new field, that key is absent from the merged result. This is not a fallback-to-default behavior — the field is genuinely missing. The v1.2 codebase already fixed this for `readIds` (coerced to `[]` on notifications store rehydration), confirming the pattern recurs.

**How to avoid:**
Add a `version` bump to the `persist` config and a `migrate` function for any phase that introduces new top-level keys to a persisted store:
```ts
persist(stateCreator, {
  name: 'settings-store',
  storage: tauriStorage,
  version: 2,
  migrate: (persisted: unknown, version: number) => {
    if (version < 2) {
      const prev = persisted as Partial<SettingsState>;
      return {
        ...initialDefaults,
        ...prev,
        pinnedIssueKeys: prev.pinnedIssueKeys ?? [],
        recentItems: prev.recentItems ?? [],
      };
    }
    return persisted as SettingsState;
  },
})
```
Alternatively, add defensive `?? []` at every point of use — acceptable only if there are very few consumers of the new field.

**Warning signs:**
- Unit tests pass (they use fresh store state), but manual testing with an existing `settings.json` fixture crashes with `Cannot read properties of undefined (reading 'map')`.
- The crash only appears on first app launch after an update, not on a fresh install.
- Vitest does not cover this because tests do not load persisted state from disk.

**Phase to address:** Any phase that adds new fields to a persisted Zustand store. Must be the first task of that phase, before any component reads the new field.

---

### Pitfall 5: The `?` Keyboard Shortcut Help Panel Opens While Typing

**What goes wrong:**
Binding the `?` key to open the keyboard shortcuts help panel fires the handler when a user types `?` inside `QuickCreateInput`, `CommentComposer`, `DescriptionEditor`, the search input, or any settings form field. This is a well-known pitfall shared by GitHub, Linear, and other apps that offer `?` shortcuts.

**Why it happens:**
A `window.addEventListener('keydown', ...)` handler for `?` does not distinguish between "user typed a character" and "user pressed a hotkey." Without checking whether a text-input element is currently focused, the handler fires unconditionally.

**How to avoid:**
Guard the `?` handler — only activate when no interactive text element is focused:
```ts
const handler = (e: KeyboardEvent) => {
  if (e.key !== '?') return;
  const target = e.target as HTMLElement;
  const isTyping = ['INPUT', 'TEXTAREA'].includes(target.tagName)
    || target.isContentEditable;
  if (isTyping) return;
  e.preventDefault();
  setHelpOpen(true);
};
```
Apply the same guard to any other single-character shortcut (e.g., `n` for new issue if that is added later).

**Warning signs:**
- Typing `?` in `QuickCreateInput` triggers the help panel.
- The sprint board search filter opens the help panel instead of appending `?` to the filter string.

**Phase to address:** Keyboard shortcuts phase — this guard must be in the initial implementation. It is not acceptable to ship `?` without this check.

---

### Pitfall 6: Settings Multi-Page Navigation Destroys In-Progress Form State

**What goes wrong:**
The current `/settings` route is a single scrollable page. Converting it to multi-page sub-routes (e.g., `/settings/connections`, `/settings/appearance`) means navigating between tabs unmounts the previous page and destroys any unsaved input. A user who types a new Jira PAT on the Connections page, then clicks the Appearance tab, loses the typed PAT entirely.

**Why it happens:**
React Router unmounts the outgoing child route component on navigation, destroying all `useState`. The existing `TokenSection` uses a controlled `<input>` with local state — navigating away triggers unmount and resets the field.

**How to avoid:**
- Use hash-nested child routes under `/settings` with a `<SettingsLayout>` parent component that renders `<Outlet />`. The shell (tab navigation) stays mounted; only the content panel swaps. This is natively supported by `createHashRouter`:
  ```ts
  { path: '/settings', element: <SettingsLayout />, children: [
    { index: true, element: <Navigate to="connections" replace /> },
    { path: 'connections', element: <ConnectionsPage /> },
    { path: 'appearance', element: <AppearancePage /> },
    { path: 'notifications', element: <NotificationsPage /> },
    { path: 'workflow', element: <WorkflowPage /> },
  ]}
  ```
- For forms with in-progress edits, either: (a) lift draft state to an ephemeral (non-persisted) Zustand slice that clears on successful save, or (b) add `useBlocker` to warn before navigating away from unsaved changes.
- Keep the sidebar `/settings` NavLink pointing to `/settings` — the `<Navigate replace>` to `connections` handles the default page without breaking the existing link.

**Warning signs:**
- The existing Sidebar `<NavLink to="/settings">` becomes a blank page after sub-routes are introduced if the index redirect is missing.
- `TokenSection` test "preserves value on re-render" fails after the page is unmounted on tab switch.

**Phase to address:** Multi-page settings phase. Design the route tree (nested vs. flat) and draft-state strategy before writing any component code.

---

### Pitfall 7: Pinned Issue Tab Bar Stores Stale Issue Titles

**What goes wrong:**
The pinned tab bar displays an issue title alongside its key (e.g., `SHOP-123 — Fix checkout flow`). The natural first implementation stores `{ key, title }` in `pinnedIssueKeys` at pin time. If the Jira issue is later renamed, the tab forever shows the old title. The `IssueDetailSheet` shows the correct current title when opened, creating a visible contradiction.

**Why it happens:**
Persisting derived data (title) alongside the primary key is a standard caching anti-pattern. The issue title is not owned by the local store — it is owned by Jira. Any value written at pin-time drifts immediately.

**How to avoid:**
- Store only `issueKey: string` in `pinnedIssueKeys`. Never persist titles.
- Resolve display titles lazily from the TanStack Query cache: `queryClient.getQueryData(['jira-issue-detail', key])?.fields.summary`. This is synchronous and requires no extra network calls for issues already fetched.
- If the key is not in cache (cold launch), display only the key as the tab label (`SHOP-123`). The full title becomes visible once the user opens the tab and the detail query resolves.

**Warning signs:**
- After renaming a Jira issue, the pinned tab still shows the old name after an app restart.
- A pinned tab for a resolved/closed issue shows stale status information in its label.

**Phase to address:** Header redesign / pinned tabs phase. Enforce the key-only data model at design time — it cannot be retrofitted cheaply once store migration is needed.

---

### Pitfall 8: Tab Bar Overflow Breaks the Fixed `h-12` Header Layout

**What goes wrong:**
The current `TopBar` is a fixed-height `h-12` flex row. Adding a pinned-issue tab bar naively appended inside this header will either: (a) overflow and clip silently (tabs are invisible beyond the viewport), or (b) push the header to two rows, misaligning the entire `flex flex-col` layout in `AppLayout` and breaking the `flex-1 overflow-auto` main content area.

**Why it happens:**
The `AppLayout` relies on `h-screen overflow-hidden` at the root with the header as a fixed-height `flex-shrink-0` element. Any growth of the header height breaks this contract. Overflow is not visible in development when only 2-3 tabs are pinned.

**How to avoid:**
- Cap pinned tabs at a maximum (5-8) and show a `+N` overflow dropdown for extras.
- Or scroll the tab bar internally with `overflow-x: auto` and hide the scrollbar with `scrollbar-width: none` / `-webkit-scrollbar: { display: none }`, enabling scroll via trackpad swipe.
- Define the maximum at design time. Keep the header at a fixed height — either extend `h-12` to `h-[88px]` (top bar + tab bar) or use a separate second `<div>` below `TopBar` within the same `flex-col` container, with its own explicit height.
- Test with 8+ pinned issues before shipping. Tab overflow is a demo-only issue — it only appears at realistic usage.

**Warning signs:**
- With 6+ pinned tabs, the header wraps to two rows in the browser inspector.
- The `main` content area loses its scroll region because the header has grown.
- Tabs are silently clipped beyond the viewport with no way to access them.

**Phase to address:** Header redesign / pinned tabs phase. Overflow handling must be implemented together with the tab bar — not deferred.

---

### Pitfall 9: `Cmd+K` in Tauri Webview Has Platform-Specific Keyboard Event Quirks

**What goes wrong:**
Two separate Tauri webview keyboard issues can affect the command palette:

1. **macOS: webview does not receive keyboard events until the user first interacts with the window.** On cold launch, `Cmd+K` does nothing if the user has not yet clicked inside the webview. This is a documented Tauri/WKWebView issue (#5464 in tauri-apps/tao).

2. **macOS: `Cmd+F` in a webview does NOT trigger the native browser find-in-page overlay** (unlike Windows where `Ctrl+F` does). This means the existing search behavior is safe, but it confirms that macOS webview keyboard event routing differs from Windows WebView2.

**Why it happens:**
On macOS, launching a Tauri app does not automatically focus the WKWebView — the OS window is focused but the webview DOM is not, so keydown events are dropped until the user clicks. The Tauri `getCurrentWindow().setFocus()` call in `AppLayout` addresses window focus but does not programmatically focus the webview DOM element itself.

**How to avoid:**
- After `getCurrentWindow().setFocus()` on mount, also call `document.body.focus()` or `document.documentElement.focus()` to ensure the webview DOM is ready to receive keydown events.
- Alternatively, ensure the first interactive element in the app (e.g., a sidebar NavLink) receives `autoFocus` on mount.
- Test `Cmd+K` on a fresh app launch (no prior click) on macOS specifically.

**Warning signs:**
- `Cmd+K` works after clicking once in the app but not on the very first launch.
- The bug disappears after the user interacts with any element.

**Phase to address:** Command palette phase — add the DOM focus call alongside the open-trigger handler.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store issue titles alongside keys in `pinnedIssueKeys` | No async resolution at render | Stale labels after Jira renames; requires store migration to fix | Never — use key-only + cache lookup |
| Multiple independent `window.addEventListener('keydown')` per feature | Quick to implement | Handlers compete; no priority control; hard to audit | Never for more than one overlay — use a centralized registry |
| Flat single-page settings with anchor scroll instead of sub-routes | No routing changes | Hard to deep-link; does not scale past 5-6 sections | Acceptable only if fewer than 4 settings sections and no tab navigation |
| Full-bleed icon source for all platforms | Single asset to manage | macOS dock icon looks oversized | Never — pad the macOS source from the start |
| Skip `persist` version bump when adding store fields | Zero migration code | `undefined` crashes in production for existing users | Never — always bump version when adding top-level persisted keys |
| Inline `useMemo` on the full issues array for palette fuzzy search | Fast to write | Re-indexes entire dataset on every render if memoization key is too broad | Acceptable only if key is tight (e.g., `[issues.map(i => i.key).join(',')]`) |
| Calling `useQuery` for every pinned tab on mount | Simple data access | N simultaneous detail queries on every cold launch | Never — use `queryClient.getQueryData()` synchronously; fetch only on tab open |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Tauri `tauri-plugin-global-shortcut` | Registering `Cmd+K` as a global shortcut (fires even when app is not focused) | Use in-webview `window.addEventListener` — the command palette is app-internal; global shortcuts are for system-tray apps |
| Tauri webview on macOS — initial focus | Assuming keyboard events work on cold launch | Call `document.body.focus()` after `getCurrentWindow().setFocus()` on mount |
| `createHashRouter` and nested settings sub-routes | Adding `/settings/connections` as a top-level flat route | Use `children` array under the `/settings` route with `<SettingsLayout>` as the parent element rendering `<Outlet />` |
| shadcn/ui `Command` component (`cmdk`) | Registering `Cmd+K` both on `window` and inside `CommandDialog` props | Use only one registration point — `window` keydown with `{ capture: true }` controls `open` state passed as prop to `CommandDialog` |
| TanStack Query cache — pinned tab labels | Calling `useQuery(['jira-issue-detail', key])` for every tab on mount | Call `queryClient.getQueryData(...)` synchronously; trigger a fetch only when the tab is first opened |
| Zustand `persist` + Tauri Store adapter | Adding new fields without bumping `version` and writing a `migrate` function | Always version-bump + migrate when introducing new top-level keys to any persisted store |
| macOS `.icns` generation | Using full-bleed 1024×1024 source directly for all platforms | Pad the macOS source to ~860×860 on a 1024×1024 canvas before generating `.icns` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Command palette re-indexes full issue + MR list on every keystroke | Input lag > 100ms; palette feels sluggish | `useMemo(() => buildFuseIndex(items), [items])` — rebuild only when items change, not on query change; cap results with `{ limit: 20 }` | ~150+ combined issues + MRs in the index |
| Mounting all pinned tab detail queries simultaneously on app load | 5-8 simultaneous issue detail API calls on every cold launch | Render tab labels with key only; trigger detail fetch only when tab is clicked/activated | 5+ pinned tabs |
| Re-running fuzzy search on the entire dataset for every character typed without debounce | Visible jank between keystrokes in the command palette | Debounce the search query (150-200ms) before passing to Fuse.js; already a pattern in `SearchOverlay` (400ms) | Immediately at fast typing speed |
| Settings sub-routes trigger full TanStack Query refetch on every tab switch if settings layout re-mounts | All settings-related queries fire repeatedly | Use nested routes so only the content panel unmounts; keep `<SettingsLayout>` mounted as the persistent parent | Every settings tab click if route structure is wrong |
| Rendering all command palette items in the DOM simultaneously | DOM node count spike; scroll stutter | Use `cmdk`'s built-in virtual-scroll or cap the rendered list at 50 items with a "show more" action | 200+ palette items |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Adding `Cmd+K` with no visible affordance in the UI | Power users find it; most users never discover it | Show `Cmd+K` hint in the TopBar search button tooltip; include it in the `?` help panel shortcut list |
| Tab close button always visible and small | Users accidentally close pinned tabs instead of switching | Use hover-to-reveal close (`×`) with minimum 24×24px hit target; standard browser tab pattern |
| Illustrated empty states without a primary action | User sees a pleasant illustration but does not know what to do | Every empty state must have at least one primary CTA button; illustration is decorative only |
| Settings redesign moves existing controls without a navigation map | Existing users cannot find Stale MR threshold or Notification polling interval | Before writing any component code, map every existing settings section to a named page in the new structure; document in the plan |
| `?` shortcut fires inside text inputs | Help panel opens while user types a question in a comment or issue name | Guard `?` shortcut: check `document.activeElement` is not an INPUT, TEXTAREA, or contenteditable before opening |
| Pinned tabs with no close affordance | User cannot unpin an issue they no longer need | Always provide close (`×`) on each tab and a "clear all pins" option in the overflow menu |
| Header redesign removes the existing TopBar search button placement | Users who learned the search icon position are confused | Keep the search icon (and bell) in their existing right-aligned position; add the tab bar as a separate row or extend the header, do not replace the existing row |

---

## "Looks Done But Isn't" Checklist

- [ ] **App icon — macOS dock:** Verify the dock icon on a real macOS device (not a screenshot). It must appear the same visual weight as Finder, Terminal, and other system apps. Confirm all five `bundle.icon` paths in `tauri.conf.json` point to the new files.
- [ ] **App icon — Windows taskbar:** Verify the `.ico` file displays correctly in the taskbar and Start menu on Windows. A common mistake is generating an `.ico` with only a 32px layer — it looks blurry in the Start menu (needs 16, 24, 32, 48, 64, 256 px layers).
- [ ] **Command palette — macOS double-fire:** Test `Cmd+K` on a physical macOS device in the production build (not dev server), pressing it 10 times rapidly. The palette must reliably open and close on alternating presses.
- [ ] **Command palette — cold launch:** Launch the app, do NOT click anywhere, then press `Cmd+K`. The palette must open. (Tests the DOM focus issue.)
- [ ] **Keyboard `?` shortcut — text input guard:** Type `?` in `QuickCreateInput`, `CommentComposer`, and the settings search. The help panel must NOT open.
- [ ] **Pinned tabs — persistence:** Pin 3 issues, close the app, reopen. All 3 must still be pinned and their keys visible.
- [ ] **Pinned tabs — overflow:** Pin 8+ issues. Verify the header height does not grow and all tabs are accessible (overflow menu or scroll).
- [ ] **Settings sub-routes — existing link:** Click the Settings gear icon in the sidebar. Must land on the Connections page (or whatever the default is), not a blank page.
- [ ] **Settings sub-routes — deep link:** Navigate to `/settings/notifications` directly (via hash). Must render the Notifications page without a blank screen.
- [ ] **Settings — store migration:** Test the new settings code against a `settings.json` file saved by v1.2 (no `pinnedIssueKeys`, no `recentItems`). Must not crash on launch.
- [ ] **Regression — SearchOverlay Escape:** Open the search overlay, then press `Escape`. Must close the overlay. Must still work after command palette and help panel are added.
- [ ] **Regression — IssueDetailSheet:** Confirm the sheet opens from sprint board, my tasks, notifications, and search after the header is redesigned with the pinned tab bar.
- [ ] **Regression — existing TopBar layout:** After header redesign, confirm the Bell icon and unread badge remain functional and accessible.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| macOS icon oversized after shipping | LOW | Replace `icon.icns` with padded version; rebuild and redistribute binary; no data migration needed |
| `Cmd+K` double-fire breaks palette on macOS | LOW | Switch to `react-hotkeys-hook` with `"mod+k"`; one file change in the palette trigger handler |
| Keyboard shortcut conflicts (`Escape` overlap) | MEDIUM | Introduce centralized shortcut registry hook; refactor each overlay to use `enabled` guard; 2-3 files affected |
| Settings store `undefined` crash for existing users | HIGH | Emergency release with `migrate` function and version bump; users who already hit the crash may have a corrupted store — add a `try/catch` in the storage adapter that resets to defaults on parse failure |
| Settings navigation loses PAT input | LOW | Lift draft form state to ephemeral Zustand slice; isolated to `TokenSection` and `ConnectionsPage` |
| Tab overflow breaks header layout | MEDIUM | Add max-tab cap with overflow menu; affects `TopBar` layout and pinned tabs store logic; 2-4 hours |
| `?` shortcut fires in text inputs in production | LOW | Add `document.activeElement` guard to the handler; one line change |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| macOS icon oversized (no canvas padding) | Phase: App Icon | Manual dock check on macOS physical device; compare visual weight against system apps |
| `Cmd+K` double-fire on macOS | Phase: Command Palette | Manual: open/close 10× on macOS production build; confirm reliable toggle |
| `Escape` / arrow-key handler conflicts | Phase: Keyboard Shortcuts — audit before building | Grep for all `window.addEventListener('keydown'` before adding new handlers; document all existing ones |
| Zustand store `undefined` on migration | Any phase adding persisted fields | Test with a v1.2 `settings.json` fixture; add a `describe('migration')` Vitest block |
| `?` shortcut fires in text inputs | Phase: Keyboard Shortcuts | Type `?` in `QuickCreateInput`, `CommentComposer`, `DescriptionEditor`; help panel must not open |
| Settings navigation loses form state | Phase: Multi-Page Settings | Type new PAT, click Appearance tab, click back — value must persist |
| Pinned tab stale data | Phase: Header / Pinned Tabs | Pin an issue; mutate its title in Jira mock; verify tab shows key only (never cached title) |
| Tab bar overflow breaks header | Phase: Header / Pinned Tabs | Pin 8 issues; verify header height stays fixed; all tabs reachable |
| Webview keyboard events on macOS cold launch | Phase: Command Palette | Press `Cmd+K` on first app launch before any click; must open palette |
| Settings URL `/settings` returns blank after sub-routes added | Phase: Multi-Page Settings | Click sidebar Settings link → must land on default settings page |
| `Cmd+K` global shortcut vs. in-webview shortcut | Phase: Command Palette | Confirm `tauri-plugin-global-shortcut` is NOT used for `Cmd+K`; shortcut only active when app is focused |

---

## Sources

- Tauri 2 App Icons official documentation: https://v2.tauri.app/develop/icons/
- macOS icon canvas padding community discussion: https://github.com/tauri-apps/tauri/discussions/10999
- Tauri issue: webview does not receive keyboard events until user interaction: https://github.com/tauri-apps/tauri/issues/5464
- Tauri/tao issue: macOS WebView does not respond to keyboard events until clicked: https://github.com/tauri-apps/tao/issues/208
- Tauri issue: Tauri 2 main window focus breaks keyboard events: https://github.com/tauri-apps/tauri/issues/14770
- Tauri issue: native `CommandOrControl+F` in webview works on Windows not macOS: https://github.com/tauri-apps/tauri/issues/9385
- shadcn/ui issue: Command dialog triggered twice with Cmd+K: https://github.com/shadcn-ui/ui/issues/2469
- shadcn/ui discussion: keyboard shortcut best practices: https://github.com/shadcn-ui/ui/discussions/7743
- Zustand persist middleware — official migration docs: https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data
- Zustand rehydration merge issue: https://dev.to/atsyot/solving-zustand-persisted-store-re-hydtration-merging-state-issue-1abk
- React Router nested routes: https://reactrouter.com/start/data/routing
- Tauri Global Shortcut plugin: https://v2.tauri.app/plugin/global-shortcut/
- react-hotkeys-hook library (cross-platform `mod` key alias): https://github.com/JohannesKlauss/react-hotkeys-hook

---
*Pitfalls research for: Taskflow v1.3 — UX & Branding (Tauri 2 + React 18 desktop app)*
*Researched: 2026-03-15*
