# Quick Task: Full GitLab Discussion Threads on MR Detail Page - Research

**Researched:** 2026-03-31
**Domain:** GitLab Discussions API + MR detail UI enhancement
**Confidence:** HIGH

## Summary

The MergeRequestDetailPage currently shows MR metadata, description, commits, linked Jira issues, and approvals -- but has **zero discussion/comment rendering**. The `fetchMRDiscussions` function already exists in `gitlab.ts` and is called from `MrAttentionTab` for health checks, but the `DiscussionNote` type is minimal (id, resolvable, resolved, body only). The GitLab API returns much richer data per note: author with avatar, created_at/updated_at timestamps, system flag, type (DiffNote/DiscussionNote/null), position for diff notes, resolved_by user, and suggestion data.

GitLab write actions (approve, comment, request changes) are **deferred to v2.0** per PROJECT.md, so this is read-only display.

**Primary recommendation:** Expand the `DiscussionNote` and `Discussion` types in `gitlab.ts` to capture full note metadata, then add a Discussions section to MergeRequestDetailPage that renders threaded conversations matching GitLab's real UI patterns (general comments, diff comments with file/line context, system notes, resolved thread collapsing).

## Current State

### Existing Code

| File | What It Does | Gap |
|------|-------------|-----|
| `src/services/gitlab.ts` | Has `fetchMRDiscussions()`, `Discussion`, `DiscussionNote` types | Types are minimal -- missing author, timestamps, system, type, position, resolved_by |
| `src/routes/dashboard/MergeRequestDetailPage.tsx` | Two-column layout: description+commits (left), metadata sidebar (right) | No discussion section at all |
| `src/routes/dashboard/MrAttentionTab.tsx` | Calls `fetchMRDiscussions` for health derivation | Only checks resolved/unresolved counts, discards content |
| `src/routes/dashboard/WikiRenderer.tsx` | Renders Jira wiki markup via jira2md + react-markdown | GitLab uses Markdown natively -- can use react-markdown directly (skip jira2md) |

### Existing Discussion Types (too sparse)

```typescript
export interface DiscussionNote {
  id: string;
  resolvable: boolean;
  resolved: boolean;
  body: string;
}

export interface Discussion {
  id: string;
  notes: DiscussionNote[];
}
```

## GitLab Discussions API - Full Note Fields

**Endpoint:** `GET /api/v4/projects/:id/merge_requests/:iid/discussions`

Each note in a discussion contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique note ID |
| `type` | string/null | `"DiffNote"`, `"DiscussionNote"`, or `null` (system/standalone) |
| `body` | string | Markdown content |
| `author` | object | `{ id, name, username, state, avatar_url, web_url }` |
| `created_at` | string | ISO 8601 timestamp |
| `updated_at` | string | ISO 8601 timestamp |
| `system` | boolean | True for automatic system notes (status changes, assignments, etc.) |
| `resolvable` | boolean | Whether thread can be resolved |
| `resolved` | boolean | Current resolution status |
| `resolved_by` | object/null | User who resolved: `{ id, name, username, avatar_url }` |
| `resolved_at` | string/null | ISO 8601 resolution timestamp |
| `noteable_id` | number | Parent MR ID |
| `noteable_type` | string | Always `"MergeRequest"` |
| `position` | object/null | For DiffNotes: `{ old_path, new_path, old_line, new_line, position_type }` |
| `confidential` | boolean | Internal note flag |
| `internal` | boolean | Internal note flag |

Each `Discussion` object: `{ id, individual_note (boolean), notes: Note[] }`

### Note Types in GitLab MR UI

1. **General comments** -- `type: "DiscussionNote"` or `null`, `system: false` -- regular user comments, can form threads
2. **Diff/code comments** -- `type: "DiffNote"` -- attached to a specific file+line in the diff, has `position` object
3. **System notes** -- `system: true` -- automatic entries (assigned to X, changed milestone, added label, etc.)
4. **Resolvable threads** -- discussions where `notes[0].resolvable === true` -- can be resolved/unresolved

### How GitLab MR UI Structures Discussions

The real GitLab MR page shows discussions in chronological order with these visual patterns:

- **Thread grouping:** Each discussion is a collapsible thread. First note is the "root", replies are indented below.
- **Resolved threads:** Collapsed by default with a "Resolved by {user}" summary line. Click to expand.
- **Diff note context:** Shows file path + line number badge above the comment (e.g., `src/main.ts:42`). May show a small code snippet.
- **System notes:** Compact single-line entries with an icon (e.g., "added label ~bug", "assigned to @user"), visually distinct from user comments.
- **Author display:** Avatar + name + timestamp for each note.
- **Thread reply count:** Shows number of replies in collapsed state.
- **Outdated diff notes:** Marked with "outdated" badge when the code has changed since the comment.

## Architecture Pattern for Implementation

### Recommended Approach

Add discussions as a new section in the left column of MergeRequestDetailPage, below commits and above the action buttons.

```
Left Column (existing):
  - Title/IID
  - Description (WikiRenderer)
  - Commits list
  - Linked Jira Issues
  + NEW: Discussion Threads section
  - Action buttons (Open in GitLab)
```

### Component Structure

```
MergeRequestDetailPage.tsx
  + useQuery for fetchMRDiscussions
  + <DiscussionThreads> section
      - Filter tabs/summary: "X threads, Y unresolved"
      - For each discussion:
        - <DiscussionThread>
          - If system note: <SystemNote> (compact)
          - If diff note: <DiffNoteHeader> (file + line badge)
          - <NoteCard> for root note (avatar, name, time, body)
          - <NoteCard> for each reply (indented)
          - If resolved: collapsed with "Resolved by {user}" header
```

### Type Expansion Needed in gitlab.ts

```typescript
export interface DiscussionNoteAuthor {
  id: number;
  name: string;
  username: string;
  avatar_url: string;
  web_url?: string;
}

export interface DiffPosition {
  old_path: string;
  new_path: string;
  old_line: number | null;
  new_line: number | null;
  position_type: string; // "text" or "image"
  base_sha: string;
  start_sha: string;
  head_sha: string;
}

export interface DiscussionNote {
  id: number;
  type: 'DiffNote' | 'DiscussionNote' | null;
  body: string;
  author: DiscussionNoteAuthor;
  created_at: string;
  updated_at: string;
  system: boolean;
  resolvable: boolean;
  resolved: boolean;
  resolved_by: DiscussionNoteAuthor | null;
  resolved_at: string | null;
  position: DiffPosition | null;
  confidential: boolean;
  internal: boolean;
}

export interface Discussion {
  id: string;
  individual_note: boolean; // true = standalone note, false = threaded
  notes: DiscussionNote[];
}
```

### Rendering GitLab Markdown

GitLab notes use standard Markdown. The project already has `react-markdown` with `remark-gfm` and `rehype-raw` (used in WikiRenderer). For GitLab notes, skip jira2md and render markdown directly:

```typescript
<Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
  {note.body}
</Markdown>
```

## Common Pitfalls

### Pitfall 1: Changing DiscussionNote type breaks MrAttentionTab
**What:** The `DiscussionNote` and `Discussion` types are used in `MrAttentionTab.tsx` and `MyTasksTab.tsx` for health derivation.
**How to avoid:** Expand the types (add fields) rather than changing existing fields. The existing `id`, `resolvable`, `resolved`, `body` fields must keep their types. Since `id` changes from `string` to `number`, verify MrAttentionTab usage -- it only checks `resolvable` and `resolved` booleans, so the id type change is safe.

### Pitfall 2: System notes cluttering the view
**What:** MRs can have dozens of system notes (label changes, assignment changes, milestone updates).
**How to avoid:** Render system notes as compact single-line entries (icon + text) or provide a toggle to show/hide them. GitLab's UI de-emphasizes these visually.

### Pitfall 3: Large discussion payloads
**What:** Active MRs can have 50-100+ notes across many threads.
**How to avoid:** The discussions API returns all at once (no pagination by default, but supports `per_page`). Use a reasonable `per_page=100` and consider lazy rendering if performance is an issue.

### Pitfall 4: Outdated diff positions
**What:** DiffNote positions reference specific SHAs. If the MR has been updated, the file/line context may no longer match current code.
**How to avoid:** Don't try to render actual diff snippets. Just show the file path + line number as a badge/label. GitLab's own UI marks these as "outdated" but we don't have the diff data to determine that -- just show the position info as-is.

## Project Constraints

- **Read-only:** GitLab write actions deferred to v2.0 -- no reply/resolve/comment posting
- **Auth pattern:** Use `readSecret('gitlab-pat')` + `PRIVATE-TOKEN` header (existing pattern)
- **Prop threading:** No React context -- pass callbacks via props (project convention)
- **API calls:** Use `apiFetch` wrapper from `@/lib/apiFetch` (existing pattern)
- **Styling:** shadcn/ui components + Tailwind v4 classes (existing pattern)
- **Avatar rendering:** Use `CachedAvatar` component (already imported in MergeRequestDetailPage)
- **Biome:** Zero lint errors, no `any` types

## Sources

### Primary (HIGH confidence)
- [GitLab Discussions API docs](https://docs.gitlab.com/api/discussions/) - Full note field schema
- [GitLab Notes API docs](https://docs.gitlab.com/api/notes/) - Note types and attributes
- Codebase: `taskflow/src/services/gitlab.ts` - Existing fetchMRDiscussions + types
- Codebase: `taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx` - Current page structure
- Codebase: `taskflow/src/routes/dashboard/MrAttentionTab.tsx` - Existing discussion usage
