---
status: awaiting_human_verify
trigger: "sticky-headers-sprint: In sprint view, the sticky task headers are broken. They float on the page when scrolling and don't properly stick to the top of the sprint board container."
created: 2026-03-26T00:00:00Z
updated: 2026-03-26T15:15:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — CSS sticky inside virtualizer absolute-positioned rows causes floating headers; fix is JS-driven sticky overlay with push-out animation
test: Added pushOffset calculation to scroll handler + translateY push-out + overflow-hidden clip
expecting: Smooth push-out transition when scrolling between swimlanes, matching native sticky behavior
next_action: awaiting human visual verification of animation smoothness

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Task headers should stick to the top of the sprint board container when scrolling down
actual: Headers float/overlap content - they detach and float over other elements on the page
errors: None reported
reproduction: Open sprint view and scroll down
started: Broke recently - it worked before but stopped

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Recent changes to main.tsx (SoftMinimumBanner, AboutDialog) broke the layout
  evidence: main.tsx layout (flex-1 overflow-auto on <main>) was identical at a3fda18 (sticky-fix commit) and now; none of those commits changed the main layout structure
  timestamp: 2026-03-26T14:35:00Z

- hypothesis: The scrollContainerRef setup is wrong (virtualizer pointing at wrong scroll element)
  evidence: scrollElement is correctly set to scrollContainerRef.current; this matches the inner overflow-auto div; the virtualizer scroll tracking is working
  timestamp: 2026-03-26T14:36:00Z

- hypothesis: Simply removing sticky from virtual mode rows fixes the problem
  evidence: User reported headers no longer stick at all -- they just scroll away. Removing sticky eliminates the float but also eliminates the desired sticky behavior entirely.
  timestamp: 2026-03-26T14:50:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-26T14:30:00Z
  checked: SprintBoardTab.tsx renderSwimlane function and VirtualizedSwimlanes component
  found: Code comment documents that sticky doesn't work in virtual mode: "in virtual mode absolute positioning on the parent prevents sticky."
  implication: CSS sticky is fundamentally incompatible with virtualizer's position:absolute + transform layout

- timestamp: 2026-03-26T14:32:00Z
  checked: CSS sticky behavior with position:absolute containing blocks
  found: position:absolute on virtualizer rows establishes a containing block that confines sticky within the translated swimlane box.
  implication: Root cause confirmed. Cannot fix with CSS alone in virtual mode.

- timestamp: 2026-03-26T14:50:00Z
  checked: First fix attempt (remove sticky in virtual mode)
  found: User confirmed headers no longer float but also no longer stick.
  implication: Need JS-driven sticky header mechanism

- timestamp: 2026-03-26T14:53:00Z
  checked: JS-driven sticky header overlay (attempt 2)
  found: Overlay between column headers and scroll area works functionally. User reported "weirdly snaps" when transitioning between swimlanes.
  implication: Need push-out animation for smooth transitions

- timestamp: 2026-03-26T15:15:00Z
  checked: Added push-out animation (attempt 3)
  found: Added pushOffset to StickyHeaderData type. Scroll handler calculates overlap between pinned header bottom and current swimlane's end position. When next swimlane approaches, pushOffset increases, applying negative translateY to the overlay content. Outer div has overflow-hidden to clip. All 20 tests pass.
  implication: Should produce smooth native-like push-out effect

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CSS `position: sticky` inside virtualizer rows is broken because `@tanstack/react-virtual` applies `position: absolute` + `transform: translateY(X)` to each row. This establishes a containing block that confines sticky within the translated row, causing headers to float at their row's Y offset rather than sticking to the scroll viewport top.

fix: JS-driven sticky header with push-out animation. (1) VirtualizedSwimlanes monitors scroll position and reports current swimlane + pushOffset via onStickyHeaderChange callback. (2) pushOffset is calculated as the overlap between the pinned header's bottom edge and the current swimlane's end position -- when the next swimlane approaches, this value increases continuously. (3) SprintBoardTab renders the overlay between column headers and scroll area with overflow-hidden on the outer container and translateY(-pushOffset) on the inner content, creating the classic "pushed out by the next header" effect. (4) Non-virtual fallback retains native CSS sticky.

verification: All 20 SprintBoardTab unit tests pass. Awaiting visual confirmation of smooth animation.

files_changed:
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
