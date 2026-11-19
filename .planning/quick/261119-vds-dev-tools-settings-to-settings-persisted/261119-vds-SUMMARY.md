---
status: complete
---
# Quick Task 261119-vds: Dev tools settings to Settings, persisted pane width, drop list bars

User feedback after 261119-tvz:
1. Reloading lost the Dev Tools inspector (side pane) width.
2. "I don't understand the progress bars in logs."
3. "I don't like the settings in the dev tools, move it to settings, all settings live there."

## Changes (807822f3)
- **Pane width persists:** `devToolsInspectorWidth` moved from the transient view store into the persisted settings store. Settings v42 migration defaults it to 440.
- **List waterfall bars removed:** the 120px per-row bar showed start and duration within an invisible load group, so it was unreadable without context. Load order lives in the Timeline view. `waterfallSegment` was deleted with its tests.
- **All Developer Tools settings live in Settings → Advanced:** request logging, response body capture and retention sit under the master toggle and are disabled while it is off. The page's gear popover (DevToolsSettingsPopover) was deleted, and the Logs empty state now points at Settings → Advanced.

## Verification
- Tests written first and confirmed failing (6), then green.
- tsc clean; biome clean on touched files; full `npm test` in the pre-commit hook passed: 490 files and 7182 tests.
