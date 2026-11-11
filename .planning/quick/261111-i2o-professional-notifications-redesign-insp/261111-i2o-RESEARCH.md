# Quick 261111-i2o: Professional notifications redesign (macOS-inspired) - Research

**Researched:** 2026-11-11
**Domain:** In-app notification feed UI (React 19 + Tailwind v4 + @tanstack/react-virtual, Tauri WKWebView)
**Confidence:** MEDIUM. Codebase findings are HIGH because they were read in this session. macOS geometry is ASSUMED: Apple publishes no pixel specs, and the HIG page did not render for WebFetch.

<user_constraints>
## User Constraints (from CONTEXT.md, verbatim summary of locked items)

### Locked Decisions
- **All four complaints are confirmed.** The feed looks amateur/busy (too many colours, rings, halos and weights). It is hard to scan (who/what/where/needs-action is unclear). The popover shell is clunky (header, filters, sizing, empty states). Behaviours are missing.
- **macOS anatomy:** bold title, secondary line, time at top-right, hover ✕ and actions, soft rounded cards. Keep taskflow tokens. NO vibrancy material. NO new accent colour. Colour comes only from the existing per-event colours.
- **Stacking (overrides the old "no grouping" rule):** an issue or MR with 2+ notifications (read or unread) becomes one stack. The newest card sits on top with 1–2 peek edges and "+N". Click expands the stack in place. The existing ≤60m same-actor merge may stay or be subsumed (planner's call).
- **Behaviours:**
  - Hover round ✕ (clear/done) at the card corner, plus a compact cluster: mark read/unread and open in browser.
  - An expanded stack has a header with "Show less" and "Clear" (clears the whole stack).
  - Inline quick actions ("Reply" on comments, "Review" on MR review requests). They may only navigate or open; no new backend APIs.
  - Snooze is OUT of scope.
- **Process:** render 3 distinct directions as light + dark screenshots in a throwaway vite harness with varied placeholder data. Human checkpoint: the user picks one before the build. Dark mode must render correctly.

### Claude's Discretion
- Typography, spacing, radius, peek geometry and animation (respect reduced motion).
- Whether source filters stay tabs or become lighter.
- Keyboard triage must keep working.

### Still-binding prior UAT (unless contradicted above)
- Two-line model: line 1 = key + parent › title + time; line 2 = action + details. Restyling the hierarchy is allowed.
- Read cards are NEVER greyed or dimmed.
- Unread signal must be clear, not garish. Current approved = neutral bold border + event-colour avatar halo. It can be replaced if the user approves.
- No drop shadows or glows. Peek edges may need subtle layering; show them in previews.
- Placeholder data only. GitLab system notes render as changes, never as "commented". Reuse Card, EmptyState and PersonPicker primitives.

### Deferred (OUT OF SCOPE)
- Snooze.
</user_constraints>

## Summary

The current card stacks up to **5 colour/weight signals per unread card**: coloured verb, solid coloured badge, event-colour halo ring, bold 1.5px border, and semibold title + semibold time. Coloured icons in change lists and coloured status pills come on top of that. All of these compete with the title, so nothing clearly leads. macOS stays calm by using **weight, not colour**, for hierarchy:
- the title is always bold;
- the body is regular;
- the time is small and secondary;
- one small glyph carries the app/event identity;
- chrome (✕, Options, actions) appears only on hover.

The fix is subtraction. Pick ONE carrier for event colour (badge OR verb, not both plus a halo), ONE unread signal, and move secondary chrome behind hover.

Stacking fits cleanly as a **pure post-pass over `buildEntries()` output**. Group EventEntries by the existing private `entityKey()` into a new `stack` entry, and flatten an expanded stack into `stack-header` + member event rows. Then the merge logic, `countUnreadCards` (bell), the virtualizer (each row stays independently measured, so there is no height animation inside a virtual row) and keyboard triage all keep their current contracts.

Quick actions need no backend:
- **Jira "Reply":** `onIssueClick(key)` plus a one-shot "focus composer" flag read by `CommentComposer` (it is already rendered by default, since `timelineFilter` defaults to `'comment'`).
- **"Review":** `onMRClick("pid/iid")` opens `/mr/:projectId/:iid`.
- **GitLab "Reply":** opens `item.url` in the browser. The MR page has no note composer.

**Primary recommendation:**
1. Build `stackEntries()` in notification-view.ts on top of the unchanged `buildEntries()`.
2. Cut the card to one colour carrier and one unread signal.
3. Move Done to a hover ✕.
4. Collapse the shell to a single header row.
5. Render the three directions below in a vite harness that toggles `.dark` on `<html>` before mount.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Stack/merge grouping, unread counting | Client: pure view model (`notification-view.ts`) | — | Already the single source for list + bell (`countUnreadCards`) |
| Expand/collapse state | Client: `NotificationPopover` local `useState<Set<string>>` | — | Ephemeral UI state; must not persist or touch the store |
| Clear stack / read toggles | Client store (`removeItems`, `markItemsRead/Unread`) | — | Existing actions tombstone ids; no new store API |
| Reply / Review | Client router (`handleIssueClick`, `handleMRClick` in main.tsx) | Tiny client flag store for composer focus | No backend; navigation only |
| Open in browser | `openExternal` + `isSafeHttpUrl` | — | Existing |

## Audit: current implementation vs the four complaints

### 1. Busy (colour/weight noise). Offenders in `NotificationRow.tsx` / `NotificationAvatar.tsx`:
- **Unread card colour signals:**
  - verb `text-{event}-600` (`NotificationDetailLine`, `colour` prop);
  - solid `bg-{event}-600` badge with a white glyph (`data-event-badge`);
  - `ring-2 {style.halo}` avatar halo (`data-unread-halo`);
  - `ring-[1.5px] ring-foreground/20` card border.

  That is **4 signals**, 3 of them the same hue, all repeating "what kind of event".
- **Weight signals:** semibold title AND semibold foreground time on unread. There are two bold anchors per line 1.
- **Avatar:** the avatar `ring-1 ring-foreground/15` plus the badge `ring-2 ring-(--card-bg)` cut-out add two more rings around a 36px circle.
- **Change lists:** each row has a coloured 12px icon from `ACTION_STYLE` (`NotificationChangeList`), and status pills are coloured. A 5-row change card can show 6+ hues.
- **Key:** muted medium `tabular-nums` at title size (12px) competes with the title.
- **Body background:** the list sits in a `bg-muted/40` well, and each card has its own ring, so there are borders everywhere.

### 2. Hard to scan
- **Who is demoted:** the actor sits on line 2 at 11px, after the title. Line 1 = where (key/parent/title), line 2 = who+what. That's fine per UAT, but title (12px) vs line 2 (11px) is only a 1px size step. The hierarchy comes from colour, not size and weight.
- **No "needs action" tier:** a review request or mention looks like a priority change, apart from badge hue.
- **Parent › title:** the parent can take up to 55% of line 1 (`max-w-[55%]`), so titles truncate early on 40rem popovers with long parents.
- **Time-bucket headers** are 11px muted and look like card text.

### 3. Clunky shell (`NotificationPopover.tsx`)
- **Three header bands:** a title row (h-10, "Mark all read" ghost text button + overflow), a filter row (h-9, `border-b`, segmented Unread/All with `bg-foreground` *inverted* pressed state + underline source tabs with count chips), then the list well. Two different filter idioms sit side by side: segmented and underline tabs.
- **Pressed state:** `bg-foreground text-background` is the heaviest element in the popover.
- **Width:** 40rem is much wider than macOS NC (~22rem `[ASSUMED]`). The width is needed today only because change lists use a 5-col grid.
- **Banners:** each stacks its own `m-2` box above the list.

### 4. Missing behaviours
- **No stack, no ✕:** Done is a check icon inside the hover tray, which also contains read/unread and open-in-browser.
- **No quick actions.**
- **Tray occlusion:** the tray covers the time (`group-hover/row:opacity-0` on `<time>`). That's acceptable, but the macOS ✕ belongs at the corner.

## macOS Notification Center anatomy → taskflow specs

All macOS measurements are `[ASSUMED]`, from training/observation of Sonoma/Sequoia. Apple does not publish them. Tahoe (macOS 26) adds Liquid Glass and larger radii; we exclude the material by decision.

| macOS element | Observed behaviour | taskflow translation (tokens only) |
|---|---|---|
| Card | ~16–20pt radius, ~12–14pt padding, one material surface, no border in light | `rounded-2xl` (16px; `--radius-xl` is 14px), `p-3` (`density-compact:p-2.5`, `density-comfortable:p-3.5`), `bg-card`, `ring-1 ring-foreground/10` (needed: no vibrancy to separate cards) |
| Lead | App icon ~32–38pt, left, top-aligned | Keep `NotificationAvatar` at 32px (`size-8`); badge 16px |
| Title | 13pt **bold**, 1 line | `text-[13px] font-semibold text-foreground truncate` (regardless of read state in some directions; see below) |
| Body | 13pt regular, up to ~4 lines, secondary in some contexts | `text-xs leading-[18px] text-foreground/80`; comments may `line-clamp-2` (Direction C only; the one-line rule is not binding for feeds per memory) |
| Time | Small, secondary, top-right, same baseline as title | `text-[11px] tabular-nums text-muted-foreground` right of line 1 |
| Clear ✕ | Hover-only, ~18pt circle, **top-left corner overlapping the card edge** | `absolute -left-1.5 -top-1.5 size-5 rounded-full bg-card ring-1 ring-foreground/15 text-muted-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100`, `X` glyph size-3 |
| Actions | Hover reveals "Options"/action buttons | Existing tray (read/unread, open in browser) stays in the time slot; Done moves to ✕ |
| Stack (collapsed) | Top card full; 1–2 cards peek below, each progressively narrower and fainter (~6–8pt visible) | Wrapper `pb-3`. Edge 1: `absolute inset-x-2 bottom-1.5 h-3 rounded-b-2xl bg-card ring-1 ring-foreground/10`. Edge 2: `inset-x-4 bottom-0 h-3 … opacity-70` (behind via DOM order, no z-index wars). No shadows. "+N" = `text-[11px] font-medium text-muted-foreground` after the time or as a pill on edge 1 |
| Stack (expanded) | Header row: group name left; "Show less" + ✕ "Clear" pill buttons right | `stack-header` row h-7: entity ref + title `text-xs font-semibold` left; `Button variant="ghost" size="xs"` "Show less", and "Clear" (or a round ✕ with label "Clear") right |
| Calm | One identity glyph, weight hierarchy, chrome on hover | ONE event-colour carrier per card |

### Inbox apps (unread / hover / quick actions)
- **Linear Inbox** `[CITED: linear.app/docs/inbox]`:
  - shortcuts: `J/K`/arrows to move, `U` read/unread, `Alt+U` mark all read, `Backspace` delete, `Shift+Backspace` delete all read, `H` snooze;
  - a "Show unread first" display option;
  - right-click context menu.

  Unread visual = bold title + small dot `[ASSUMED]`. Our existing `u`/`e`/`Delete` keys already match; add `Backspace` as a Done alias.
- **GitHub Inbox** `[ASSUMED]`: unread = bold + blue dot, read = regular weight. Hover row actions: Done (✓), Unsubscribe, Save, Mark read. Reason chip ("review requested", "mention") tells you why it needs action.
- **Slack Activity** `[ASSUMED]`: tabs (All / Mentions / Threads / Reactions), unread = bold + subtle background, inline "Reply" opens the thread.

**Takeaway for taskflow:** the "why it needs action" reason (mention, review requested, assigned) is the one thing worth colour. Plain updates should stay neutral.

## Integration design

### Stacking in `notification-view.ts`
- **Keep `buildEntries()` unchanged.** Merge, dedupe and bucket headers stay as they are. `countUnreadCards` stays as is, so the bell counts post-merge cards. Changing it would silently change the badge number when stacking ships (see Open Q1).
- **Export `entityKey`.** It is private today, at line 606.
- **Add a pure post-pass:**
  ```ts
  export interface StackEntry { kind: 'stack'; id: `stack:${string}`; entity: string; cards: EventEntry[] /* newest first */; isUnread: boolean }
  export interface StackHeaderEntry { kind: 'stack-header'; id: `stack-header:${string}`; entity: string; cards: EventEntry[] }
  export function stackEntries(entries: NotificationEntry[], expanded: ReadonlySet<string>): NotificationEntry[]
  ```
- **Stacking rules:**
  - Group event entries by `entityKey(card.item)`. Entries with null key never stack.
  - A group with ≥2 cards becomes one `stack` placed where its NEWEST card was, under that card's bucket header.
  - Older cards leave their own buckets. Drop bucket headers that end up empty: re-derive headers after stacking, don't patch them.
  - When `expanded.has(entity)`, emit `stack-header` followed by each member `EventEntry` (ids unchanged, `event:<id>`), so focus/size caches stay keyed per card.
- **Stack size counts items, not cards:** the "+N" is decided over **items** (CONTEXT: "2+ notifications"). A single merged card with 2 items is already one card. Recommendation: stack when ≥2 **cards**, and show "+N" = remaining notifications. Planner decides whether to subsume merge (Open Q2).
- **`entryIds` for a stack:** `cards.flatMap(entryIds)`. This includes `duplicateIds` (Jira comment copies), which is mandatory or the copies resurrect.
- **`unreadOnly` filter:** apply it before stacking, as `buildEntries` already does. In the Unread view, stacks then contain only unread cards.
- **`estimateEntryHeight`:**
  - `stack` = top-card estimate + 12 (peek);
  - `stack-header` = 28.
- **`isFocusableEntry`:** true for `event` and `stack`, false for headers.

### NotificationList (virtualized)
- **No height animation inside a row.** Expanding inserts N new virtual rows. `measureElement` measures them and `getItemKey` already uses stable `entry.id`.
- **Animation:** `animate-in fade-in-0 slide-in-from-top-1 duration-150 motion-reduce:animate-none` (`tw-animate-css` is already imported in index.css) on rows whose id was just revealed. The stack-to-header swap is instant.
- **Keyboard:** extend `handleKeyDown`:
  - `Enter`/`Space`/`→` on a stack = expand (macOS click = expand);
  - `←`/`Esc` inside an expanded stack = collapse, then focus the stack;
  - `u`/`e`/`Delete`/`Backspace` on a collapsed stack act on ALL stack ids (same as "Clear").
- **`pendingFocus`:** keep the index-based logic. After Clear, the next focusable is found as today.
- **Prop change:** `onToggleRead`/`onDone` take `EventEntry`. Widen them to `EventEntry | StackEntry`, or pass ids.
- **Clipping:** the ✕ at `-top-1.5 -left-1.5` is clipped by the scroller's `overflow-y-auto`. The first row has only `py-1` and the sides `px-2`. Use `px-3 pt-2` on the scroller, or place the ✕ inset (`left-1 top-1`). Show this in previews.

### Store
- **Clear stack** = `removeItems(stackIds)`. It tombstones (DISMISSED_CAP 500), so no new action is needed.
- **Mark stack read** = `markItemsRead(stackIds)`.
- **Expanded set** lives in popover state, keyed by entity string. Prune keys whose stack vanished. Do NOT read store state at module level (React Compiler staleness; see Pitfalls).

### Quick actions: existing handlers to back them

| Notification | Action label | Handler (exists) | Notes |
|---|---|---|---|
| `jira-comment`, `comment-mention` with a Jira key | Reply | `onIssueClick(key)` → main.tsx `handleIssueClick` → `navigate('/issue/KEY')` | `CommentComposer` (routes/dashboard/CommentComposer.tsx, `textareaRef`) renders by default (`timelineFilter` initial `'comment'`, IssueDetailView.tsx:83). Add a tiny zustand flag `composerFocus: string | null`: set it before navigating, and have the composer consume it with `useEffect` when `issueKey` matches, then `textarea.focus()` + clear. `onIssueClick` takes only a key, so a store flag avoids changing route signatures. |
| `mr-note`/`gitlab-mention` (non-system) | Reply | `openExternal(item.url)` (with `isSafeHttpUrl`) | No GitLab note composer in app (MergeRequestDetailPage has none) |
| System note with a `review` action (parsed via `parseGitlabSystemLine` "review requested") | Review | `onMRClick(\`${mrProjectId}/${mrIid}\`)` → `/mr/:projectId/:iid` (routes.tsx:50) | No approve API in app; just open |
| `mr-approval` | Open MR | `onMRClick` | |
| `pipeline-failure` | View pipeline | `openExternal(item.url)` | |
| `issue-assignment` | (none) | card click already opens | Keep ≤1 quick action per card |

- **Mark read:** every quick action also calls `markItemsRead(entryIds)`, and the in-app ones call `onClose()`, the same as `openEvent`.
- **Placement:** render quick actions as a sibling of the overlay button (`relative z-10`), never nested (memory: overlay-button pattern).

## Three directions for the preview harness

All three share:
- the stack geometry above;
- the hover ✕ at top-left;
- the tray (read/unread, open) in the time slot;
- the single-row shell below;
- the same placeholder data.

They differ in **colour carrier, unread signal and density**.

### Direction A: "Sonoma" (faithful macOS)
- **Card:** `rounded-2xl p-3 bg-card ring-1 ring-foreground/10`. Same surface and border for read and unread.
- **Line 1:** title `text-[13px] font-semibold` ALWAYS (macOS titles are always bold). Key as a muted 11px prefix, parent dropped into the tooltip. Time `text-[11px] text-muted-foreground`.
- **Line 2:** `text-xs text-foreground/80`. Actor `font-medium text-foreground`, **verb neutral** (no colour), detail muted.
- **Colour:** only the 16px solid event badge on a 32px avatar. No halo.
- **Unread:**
  - a 6px dot in the event colour sits left of the time, `bg-{event}` via a new `style.dot` derived like `halo`;
  - read cards keep identical text weights.
  - Risk: the user previously called a dot "off". Show it at 6px with the time in `text-foreground` to judge.
- **Quick action:** a text button right-aligned on line 2, revealed on hover. `text-xs font-medium text-foreground hover:underline`.

### Direction B: "Ledger" (GitHub/Linear inbox calm)
- **Card:** `rounded-xl px-3 py-2.5`.
  - Unread = `bg-card ring-1 ring-foreground/15`.
  - Read = `bg-transparent ring-1 ring-foreground/8`, so it sits on the `bg-muted/40` well. Text is NOT dimmed: same foreground title, regular weight.
- **Title:** unread `font-semibold`, read `font-normal` (the existing weight contract).
- **Colour:** ONLY the verb/reason text, e.g. "requested your review", "mentioned you". The badge becomes neutral (`bg-muted text-muted-foreground ring-2 ring-(--card-bg)`) and there is no halo. Plain updates get a neutral verb, and only reason events (mention, review, assignment, failure) keep colour.
- **Density:** the most compact. 28px avatar, per-field change list kept (round 9) with tighter gaps (`gap-y-0.5`).
- **Quick action:** always-visible ghost pill on line 2 for actionable types only (`h-5 rounded-full px-2 text-[11px] font-medium ring-1 ring-foreground/15`).

### Direction C: "Tahoe" (roomy, glassless)
- **Card:** `rounded-[18px] p-3.5 bg-card ring-1 ring-foreground/10`. 36px avatar.
- **Line 1:** title 13px semibold.
- **Line 2:** a comment body `line-clamp-2` at 12px/18px. This is the only direction with 2-line bodies (shows more info, per "show more info where you can").
- **Colour:** the current approved event-colour halo is kept as the unread signal, but the badge turns neutral and the verb neutral. One hue per card, appearing only when unread.
- **Read:** same card and surface, no halo.
- **Quick actions:** an action row under the body like macOS banner buttons. `mt-2 flex gap-1.5`, `Button variant="outline" size="xs"` ("Reply", "Review", "Open in GitLab"). It shows on hover/focus and always shows for mention/review.
- **Peek edges:** use `bg-muted` instead of `bg-card` so layering reads without shadow.

### Shared shell proposal
- **One header row, h-11, px-3:**
  - left: "Notifications" (`text-sm font-semibold`);
  - right: a compact segmented `Unread | All` styled like the app's light segmented controls (`bg-muted p-0.5`, pressed = `bg-background text-foreground ring-1 ring-foreground/10`, not inverted);
  - then a source filter as a small ghost dropdown ("All sources ▾" with per-source unread counts inside the menu);
  - then an icon button `CheckCheck` "Mark all read" (tooltip) and the `MoreHorizontal` overflow.
- **Drop** the separate filter band and the underline tabs.
- **Width:** `w-[30rem]`, preview 28/30/34rem `[ASSUMED]`.
- **List:** no `border-b`.
- **Bucket headers:** `text-xs font-semibold text-foreground/70 px-1`, macOS group-label style.
- **Empty states:** keep `EmptyState compact`.
- **Banners:** one stacked region with `space-y-2`.

## Preview harness (light + dark that actually works)

**Why the earlier dark render broke** (the committed h9a dark PNGs are correct, so the broken render was an intermediate one). Causes, in likelihood order:
1. **`.dark` was not an ancestor of the cards.** `@variant dark (&:is(.dark *))` (index.css:7) needs `.dark` on an ANCESTOR, and the token block is `.dark { --card … }` (index.css:120). Put `.dark` on `<html>`, as `services/theme.ts:55` does.
2. **Portals escaped a `.dark` wrapper div.** Tooltips and popovers portal to `<body>` and lose the class if it is on a wrapper.
3. **Chromium auto-dark was used.** `--force-dark-mode` / `--blink-settings=forceDarkModeEnabled=true` (or Playwright `colorScheme: 'dark'` alone) does nothing for class-based tokens, and auto-dark inverts colours. The result is white cards with light text, i.e. invisible.
4. **No Tailwind scanning.** The vite root was outside `src` without `@source '../src'`, so classes like `dark:text-violet-400` were never generated (memory note).

**Recipe** (throwaway; delete after the pick):
- **Location:** `taskflow/taskflow/preview/`.
  - `index.html` with an inline script before the module: `const t=new URLSearchParams(location.search).get('theme'); if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark'}`.
  - Optional `data-density` on `<html>`.
- **`preview.css`:** `@import '../src/index.css'; @source '../src'; @source '.';` plus `body{ @apply bg-background text-foreground; }`.
- **`vite.config.ts` in preview/:** the SAME plugins as the app (`tailwindcss()`, `react()`, `babel({ presets: [reactCompilerPreset()] })`) plus the `@` alias to `../src`. The React Compiler must be on, or compiler-only staleness bugs stay hidden.
- **`main.tsx`:**
  - wraps in `QueryClientProvider` (`usePersonAvatar` uses react-query);
  - seeds `personAvatars` or leaves URLs undefined (initials fallback);
  - seeds `useNotificationsStore.setState({ items, readIds })` for the full-popover render. The Tauri `LazyStore` persist rejects in the browser, and that's harmless.
- **Data:** placeholder only, e.g. PROJ-11 "Fix login bug", people "Cara Doe", "Ben Ito". Include:
  - a 3-card stack (comment + mention + status change on one issue);
  - an MR stack with a review request + system note;
  - a pipeline failure and a due reminder;
  - a multi-field update;
  - a long parent › title;
  - read and unread mixed.
- **Layout:** render A | B | C side by side, each in a fake popover (`w-[30rem] rounded-xl bg-popover ring-1 ring-foreground/10`). Show one stack collapsed and one expanded, and one card with forced hover (add a `data-force-hover` class mapping to the hover styles).
- **Screenshot:** a node script using the npx-cached `playwright-core` 1.60.0 (`~/.npm/_npx/5e2e484947874241/node_modules/playwright-core`), which matches the cached `chromium-1223`.
  - Script steps: `page.goto(...?theme=light|dark)`, then `page.hover()` for a real hover, then `fullPage` screenshot.
  - **Assert dark actually applied:** `getComputedStyle(document.documentElement).getPropertyValue('--card')` must contain `0.205` before saving.
  - Save into the quick-task dir as `261111-i2o-directions-{light,dark}.png`.
  - Cached WebKit 2370 does NOT match playwright 1.60's expected 2287. Don't rely on it.

## Common Pitfalls

1. **Tests encode the current design.**
   - `NotificationPopover.test.tsx:126` asserts "every notification on the same issue as its own row, with no group chrome". It directly contradicts stacking; rewrite it.
   - `NotificationRow.test.tsx` has ~90 class/attribute assertions (lines 278–419: `ring-[1.5px]`, `ring-foreground/20`, `data-unread-halo`, tray gradient, badge ring).
   - `notification-colours.test.ts` enforces `halo === text→ring`. Update it if the halo or badge changes, or add a `dot` invariant.
   - The pre-commit hook runs the full suite, so update tests in the same commit (memory).
2. **React Compiler module reads.** Expanded state or a composer-focus flag read via `getState()` in render goes stale in the app but not in vitest. Use hooks (memory: react-compiler-module-read).
3. **Virtualizer + expand.** Never animate `height` inside a measured row; insert rows instead. Keys must stay `entry.id`; stack ids must not collide with event ids (`stack:` prefix).
4. **Clipped ✕.** The scroller `overflow-y-auto` plus `px-2 py-1` clips a corner badge that overhangs the card (see Integration).
5. **WKWebView 0-width collapse.** Narrow flex children (avatar, ✕, badge) need explicit px sizes (`size-5`, `flex-none`) (memory: virtualized 0-width column). Don't use `::highlight` for unread emphasis.
6. **Italic/truncate, `@container`.** The list is `@container`, and container variants don't apply to the container itself (memory). Peek edges positioned against the virtual row wrapper need `relative` on the stack wrapper.
7. **Duplicate Jira comment ids.** Clear/read on a stack must use `entryIds()` per card, including `duplicateIds`.
8. **Bell count drift.** If stacks change `countUnreadCards`, tab chips and the TopBar badge change in lockstep. Decide explicitly (Open Q1) and update `useUnreadCardCount.test.ts`.
9. **Overlay button pattern.** ✕, tray and quick-action buttons are siblings of `[data-entry-primary]` with `relative z-10`, never nested inside it. On a collapsed stack, the overlay button's action becomes expand, not open.
10. **No shadows.** Peek layering must come from ring + inset + opacity/muted surface only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | macOS NC geometry (radius ~16–20pt, ✕ top-left, 1–2 peek edges, "Show Less"/Clear header, ~22rem width) | Anatomy | Low; directions are judged visually by the user |
| A2 | GitHub/Slack inbox unread & hover behaviours | Inbox apps | Low; inspiration only |
| A3 | Popover width 30rem is enough once change lists stay | Shell | Medium; long change grids may truncate, so preview at 28/30/34 |
| A4 | Earlier dark-harness bug cause (ancestor/portal/auto-dark/@source) | Harness | Low; the recipe guards all four plus a computed-style assert |

## Open Questions
1. **Bell count with stacks:** count stacks as 1, or keep post-merge cards?
   - Recommendation: keep cards (badge unchanged, macOS badges count notifications).
   - The collapsed stack shows "+N". Confirm at the direction pick.
2. **Subsume merge into stacks?**
   - Merge combines same-actor ≤60m items into one card's list, and a stack groups cards per entity.
   - Recommendation: keep merge (tested, approved) and stack the merged cards. Revisit only if previews show redundant nesting.
3. **Unread signal:** this is the main differentiator between A (dot), B (surface) and C (event halo, current). The user decides.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| vite | harness | ✓ | ^8.0.1 (app devDep) | — |
| playwright-core | screenshots | ✓ (npx cache) | 1.60.0 | Chromium CLI `--headless=new --screenshot` (no hover) |
| Chromium | screenshots | ✓ | build 1223 (matches) | — |
| WebKit | WKWebView-like check | ✗ mismatch | cached 2370, expected 2287 | Verify in the Tauri app at UAT |
| Node | all | ✓ | v26.12.1 | — |

No new npm packages, so a Package Legitimacy Audit is not applicable.

## Validation Architecture
- **Framework:** vitest (jsdom). Quick: `cd taskflow && npx vitest run src/routes/notifications`. Full: `npm test`.
- **New unit tests in `notification-view.test.ts`** for `stackEntries`:
  - ≥2 cards per entity → 1 stack at the newest position;
  - empty bucket headers dropped;
  - expanded → header + members with unchanged ids;
  - null entityKey never stacks;
  - stack ids include `duplicateIds`;
  - `countUnreadCards` unchanged (or the new rule).
- **`NotificationList.test.tsx`:** Enter expands, Esc collapses, `e` on a stack removes all ids.
- **`NotificationPopover.test.tsx`:**
  - Clear removes the whole stack;
  - Show less collapses;
  - Reply sets the composer flag and calls `onIssueClick`;
  - Review calls `onMRClick('pid/iid')`;
  - GitLab Reply opens a safe URL.
- **`CommentComposer` test:** focuses when the flag matches `issueKey`, then clears it.
- **Manual:** direction pick (screenshots); final UAT in the Tauri app for WKWebView rendering.

## Security Domain
- **Open in browser / GitLab Reply:** must keep `isSafeHttpUrl` gating before `openExternal` (V5 input validation on stored URLs).
- **No new data paths or APIs.**
- **Placeholder data only** in fixtures and screenshots (no customer data).

## Sources
- Codebase (read this session): `taskflow/src/routes/notifications/{NotificationRow,NotificationAvatar,NotificationList,NotificationPopover}.tsx`, `notification-view.ts`, `notification-colours.ts(+test)`, `useUnreadCardCount.ts`, `stores/notifications.store.ts`, `components/app/TopBar.tsx`, `main.tsx` (handleIssueClick/handleMRClick), `routes/routes.tsx:50`, `routes/dashboard/{IssueDetailView,CommentComposer,MergeRequestDetailPage}.tsx`, `index.css`, `services/theme.ts`, `vite.config.ts`
- Prior screenshots: `.planning/quick/261111-h9a-*/261111-h9a-*-dark.png` (render correctly)
- [Linear Inbox docs](https://linear.app/docs/inbox): shortcuts, display options
- [Pullwatch HIG-based notification redesign issue](https://github.com/Vernum-Projecten/pullwatch/issues/101) and [Smashing: iOS 12 grouped notifications](https://www.smashingmagazine.com/2018/09/preparing-your-app-for-ios-12-notifications/): thread grouping and summary concepts (MEDIUM/LOW)
- Apple HIG Notifications page: fetch returned no body. macOS geometry is ASSUMED.

**Valid until:** 2026-12-11
