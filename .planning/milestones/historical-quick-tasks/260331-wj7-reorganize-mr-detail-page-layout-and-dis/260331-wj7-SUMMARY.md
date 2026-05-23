# Quick Task 260331-wj7: Reorganize MR Detail Page Layout

## What Changed

### MergeRequestDetailPage.tsx
- **Header**: MR state badge (Open/Merged/Closed/Draft) inline next to `!iid`, "Open in GitLab" button in header row
- **Sidebar**: Narrowed from `w-[42%]` to `w-72` (288px fixed)
- **Section panels**: Description, Commits wrapped in `rounded-lg border bg-card` card-like panels
- **Section order**: Discussions promoted above Commits (no longer at bottom)
- **Collapsible commits**: First 5 shown, "Show N more" toggle
- **Linked Jira Issues**: Moved from left column to sidebar
- **Bottom action section**: Removed (button moved to header)
- **MR changes API**: Added `fetchMRChanges` query to provide diff context for discussion notes

### DiscussionThreads.tsx
- **System notes**: Now rendered through `react-markdown` with proper prose styling instead of plain italic text
- **Diff code preview**: DiffNote comments now show actual code context with file header, line numbers, and color-coded additions/removals (green/red) instead of just a file+line badge
- **Diff parsing**: Added `parseDiffLines` and `extractCodeContext` helpers to extract relevant code around the commented line

### gitlab.ts
- **New type**: `MRDiffFile` (old_path, new_path, diff)
- **New function**: `fetchMRChanges()` — fetches MR changes from `/api/v4/projects/:id/merge_requests/:iid/changes`

## Commits
- `ec0358e`: Restructure MR detail page header, sections, and sidebar width
- (inline fix): System note markdown rendering, diff code preview, linked Jira to sidebar
