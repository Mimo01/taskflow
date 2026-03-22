# Phase 32: Time Tracking, Attachments & Mentions - Research

**Researched:** 2026-03-22
**Domain:** Jira REST API v2 (worklogs, attachments, user search) + React UI components
**Confidence:** HIGH

## Summary

Phase 32 adds three feature clusters to the existing issue detail page: time tracking (worklog CRUD + summary display), file attachments (view/upload/download), and @mention autocomplete in comments. The codebase is already well-prepared: `timetracking` and `attachment` fields are already fetched by `fetchIssueDetail`, `JiraAttachment` type exists, `AuthImage` handles authenticated image fetching, `ImageLightbox` exists (needs prev/next extension), `WikiRenderer` already renders `[~username]` mentions via `preprocessJiraMarkup`, and the `ActivityTimeline` + `TimelineFilterChips` pattern supports adding a new entry type.

The main engineering challenges are: (1) extending `fetchAllWorklogPages` to return full worklog objects (currently only returns `{ author?: { displayName? } }`), (2) multipart file upload through Tauri's `@tauri-apps/plugin-http` fetch with the required `X-Atlassian-Token: no-check` header, (3) cursor-anchored mention popover in a textarea (requires measuring text position), and (4) natural language duration parsing.

**Primary recommendation:** Structure as 4 plans: (P01) Jira service layer for worklogs/attachments/users, (P02) time tracking UI (summary + log work + worklog timeline entries), (P03) attachments UI (section + upload + lightbox), (P04) @mention autocomplete. Each plan is independently testable.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Combined input -- natural language text field ("2h 30m", "1d", "45m") as primary, with a small clock icon that opens a duration picker (hours + minutes) as fallback
- D-02: Log work form includes: time spent input, date picker (defaults to today), optional comment field
- D-06: Attachments displayed in a collapsible "Attachments (N)" section below the description, above the activity timeline
- D-07: Image attachments render as thumbnail grid; non-image files as a compact list with filename, size, and download link
- D-08: Clicking an image thumbnail opens a lightbox overlay with full-size view and close/next/prev navigation. AuthImage component handles authenticated fetching.
- D-09: Upload via "Attach file" button in section header + drag-and-drop onto the attachments section area
- D-10: Single file upload at a time (Jira API limitation). Progress indicator per file.
- D-11: Typing "@" in CommentComposer opens a floating popover anchored to cursor position in the textarea
- D-12: Popover shows filtered list of project assignable users fetched from `/rest/api/2/user/assignable/search?project={key}` and cached with TanStack Query
- D-13: Arrow keys to navigate, Enter to select. Selection inserts `[~username]` wiki markup into the textarea
- D-14: Mentions render in WikiRenderer as highlighted styled spans -- non-clickable
- D-15: Worklogs render as medium two-line entries in the Activity Timeline
- D-16: New [Worklogs] filter chip added to TimelineFilterChips
- D-17: Edit/delete own worklogs via inline 3-dot menu -- same pattern as comment edit/delete

### Claude's Discretion
- Time tracking summary exact layout and progress visualization
- Log work trigger placement and form appearance
- Lightbox component implementation approach
- Attachment section collapse/expand default state
- Worklog entry hover/focus states
- Duration parser implementation details
- Mention popover debounce and minimum character threshold

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TIME-01 | User can log time spent on an issue with natural language input ("2h 30m") | Duration parser + worklog POST API + LogWorkPopover component |
| TIME-02 | User can view worklogs on issue detail (author, time spent, date, comment) | Extended worklog fetch returning full objects + WorklogEntry component in ActivityTimeline |
| TIME-03 | User can edit own worklog entries | Worklog PUT API + inline edit pattern matching comment edit |
| TIME-04 | User can delete own worklog entries | Worklog DELETE API + confirmation popover matching comment delete |
| TIME-05 | User sees time tracking summary on issue detail (estimated, spent, remaining) | `timetracking` field already on JiraIssueDetail + TimeTrackingSummary sidebar component |
| DETAIL-06 | User can view issue attachments inline (image thumbnails, file list) | `attachment` field already fetched + AttachmentsSection with AuthImage thumbnails |
| DETAIL-07 | User can download issue attachments | Direct download via authenticated fetch to `attachment.content` URL |
| DETAIL-08 | User can upload file attachments to issues | Multipart POST to `/rest/api/2/issue/{key}/attachments` with `X-Atlassian-Token: no-check` |
| DETAIL-09 | User can @mention team members in comments with autocomplete popover | MentionPopover + CommentComposer enhancement + WikiRenderer already handles rendering |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | existing | All data fetching, mutations, cache invalidation | Project standard for all API calls |
| @tauri-apps/plugin-http | existing | Authenticated HTTP fetch bypassing CORS | Project standard; used by all API calls via `apiFetch` |
| shadcn/ui (Popover, Dialog, Button, Input, Badge, Label, Skeleton) | existing | UI primitives | All already installed per UI-SPEC |
| lucide-react | existing | Icons (Clock, Paperclip, Download, FileText, File, Upload, X, ChevronLeft, ChevronRight) | Project standard icon library |
| react-markdown + rehype-raw + remark-gfm | existing | Wiki markup rendering (mention spans) | Already used by WikiRenderer |

### No New Dependencies Needed

All phase 32 features are implementable with existing dependencies. The duration parser is simple enough to hand-write (see Code Examples). The mention popover uses existing Popover primitives. File upload uses the existing `fetch` from `@tauri-apps/plugin-http` with FormData.

## Architecture Patterns

### Recommended Project Structure
```
taskflow/src/
  services/jira/
    worklogs.ts          # EXPAND: full worklog CRUD (currently returns author names only)
    attachments.ts       # NEW: attachment upload/delete
    users.ts             # NEW: assignable user search for mentions
    types.ts             # EXPAND: JiraWorklog type, JiraAttachment already exists
    index.ts             # EXPAND: re-export new modules
  services/
    jira-changelog.ts    # EXPAND: TimelineEntry union with 'worklog' type, TimelineFilter with 'worklog'
  routes/dashboard/
    issue-detail/
      TimeTrackingSummary.tsx    # NEW: sidebar progress bar + labels
      LogWorkPopover.tsx         # NEW: popover form for logging work
      DurationInput.tsx          # NEW: natural language duration input + picker fallback
      AttachmentsSection.tsx     # NEW: collapsible section with thumbnails + file list
      AttachmentThumbnail.tsx    # NEW: 80x80 AuthImage thumbnail
      AttachmentFileRow.tsx      # NEW: non-image file row
      AttachmentLightbox.tsx     # NEW: extends ImageLightbox with prev/next
      AttachmentUpload.tsx       # NEW: upload button + drag-drop + progress
      WorklogEntry.tsx           # NEW: two-line timeline entry
      ActivityTimeline.tsx       # MODIFY: add worklog entry type
      TimelineFilterChips.tsx    # MODIFY: add Worklogs chip
      FieldsSection.tsx          # MODIFY: add TimeTrackingSummary row
    IssueDetailContent.tsx       # MODIFY: add AttachmentsSection
    IssueDetailPage.tsx          # MODIFY: worklog fetch, worklog CRUD mutations
    CommentComposer.tsx          # MODIFY: add @mention trigger + popover
    MentionPopover.tsx           # NEW: cursor-anchored user autocomplete
    WikiRenderer.tsx             # ALREADY DONE: [~username] rendering exists
```

### Pattern 1: Service Module Pattern (established)
**What:** Each Jira domain gets a focused service file with typed functions using `apiFetch`.
**When to use:** Every new API endpoint interaction.
**Example:**
```typescript
// services/jira/attachments.ts — follows comments.ts pattern exactly
import { apiFetch } from '../../lib/apiFetch';

export async function uploadAttachment(
  baseUrl: string,
  token: string,
  issueKey: string,
  file: File,
): Promise<JiraAttachment[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/attachments`;
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiFetch('jira', url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Atlassian-Token': 'no-check',
      // Do NOT set Content-Type — browser/Tauri sets multipart boundary automatically
    },
    body: formData,
  }, 'Upload Attachment');
  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  return response.json();
}
```

### Pattern 2: Timeline Entry Extension (established)
**What:** The `mergeTimeline` / `filterTimeline` / `countByType` system in `jira-changelog.ts` uses a discriminated union `TimelineEntry`. Adding worklogs means extending this union.
**When to use:** When adding worklog entries to the activity timeline.
**Example:**
```typescript
// Extend TimelineEntry union
export type TimelineEntry =
  | { type: 'comment'; timestamp: string; data: JiraComment }
  | { type: 'change'; timestamp: string; data: ChangelogHistory }
  | { type: 'worklog'; timestamp: string; data: JiraWorklog };

// Extend TimelineFilter
export type TimelineFilter = 'all' | 'comment' | 'change' | 'worklog';

// Extend countByType
export function countByType(entries: TimelineEntry[]): {
  all: number; comment: number; change: number; worklog: number;
} {
  let comment = 0, change = 0, worklog = 0;
  for (const e of entries) {
    if (e.type === 'comment') comment++;
    else if (e.type === 'change') change++;
    else worklog++;
  }
  return { all: entries.length, comment, change, worklog };
}
```

### Pattern 3: Mutation with Query Invalidation (established)
**What:** TanStack Query mutations that invalidate `['jira-issue-detail', issueKey, jiraBaseUrl]` on success.
**When to use:** All worklog CRUD and attachment upload/delete operations.
**Example:** Follow exact pattern from `useFieldMutation.ts` and comment edit/delete mutations in `IssueDetailPage.tsx`.

### Pattern 4: Worklog Fetch Expansion
**What:** `fetchAllWorklogPages` in `client.ts` currently returns `Array<{ author?: { displayName?: string } }>`. Must widen the return type to include full worklog fields.
**When to use:** When fetching worklogs for timeline display.
**Critical detail:** The return type must be broadened to `JiraWorklog[]` while maintaining backward compatibility with the existing `fetchIssueWorklogs` function in `worklogs.ts`.

### Anti-Patterns to Avoid
- **Do NOT set Content-Type header for multipart uploads:** The browser/Tauri must set the multipart boundary automatically. Manually setting `Content-Type: multipart/form-data` will omit the boundary and break the upload.
- **Do NOT use `jira.ts` for new service functions:** New service code goes in `services/jira/` domain modules (the newer barrel pattern), not in the legacy `services/jira.ts` monolith.
- **Do NOT duplicate WikiRenderer mention rendering:** `preprocessJiraMarkup` already handles `[~username]` and `[~accountId:xxx]` patterns. The mention rendering (D-14) is already complete. Phase 32 only needs the popover for insertion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duration parsing | Complex regex with all Jira formats | Simple parser for h/m/d units (see Code Examples) | Only need "2h 30m", "1d", "45m" -- not full Jira Tempo syntax |
| Image lightbox with prev/next | Full gallery component | Extend existing ImageLightbox.tsx with index + list state | Existing component handles auth, escape, overlay -- just add navigation |
| Textarea cursor position for mention | Complex contentEditable solution | `textarea.selectionStart` + hidden measurement div | Standard pattern for textarea autocomplete; no contentEditable complexity |
| Multipart upload | Custom binary encoding | Native FormData + fetch | FormData handles boundary generation correctly |

**Key insight:** The mention popover's cursor anchoring is the only genuinely tricky UI problem. Use a hidden `<div>` that mirrors the textarea content up to the cursor to calculate the pixel position of the "@" character. This is the standard approach used by most mention libraries.

## Common Pitfalls

### Pitfall 1: Multipart Content-Type Header
**What goes wrong:** Setting `Content-Type: multipart/form-data` manually strips the boundary parameter, causing Jira to reject the upload with 415 or 500.
**Why it happens:** Developers copy headers from other API calls which all set Content-Type explicitly.
**How to avoid:** Omit Content-Type entirely when using FormData. The fetch implementation adds it with the correct boundary.
**Warning signs:** Upload returns 415 Unsupported Media Type or 500 Internal Server Error.

### Pitfall 2: X-Atlassian-Token Header Missing
**What goes wrong:** Jira rejects attachment uploads with 403 XSRF check failed.
**Why it happens:** This header is unique to attachment uploads -- no other Jira endpoint requires it.
**How to avoid:** Always include `X-Atlassian-Token: no-check` in attachment upload requests.
**Warning signs:** 403 response specifically mentioning XSRF.

### Pitfall 3: Worklog Return Type Widening Breaks Existing Code
**What goes wrong:** Changing `fetchAllWorklogPages` return type from `Array<{ author?: { displayName? } }>` to `JiraWorklog[]` could break existing callers.
**Why it happens:** `fetchIssueWorklogs` in `worklogs.ts` uses the narrow type.
**How to avoid:** Widen the return type to `JiraWorklog[]` (which is a superset) -- existing code accessing `.author?.displayName` still compiles. Or create a separate function.
**Warning signs:** TypeScript compilation errors in existing worklog code.

### Pitfall 4: Textarea Mention Cursor Position Off After Insert
**What goes wrong:** After inserting `[~username]` markup, the cursor position is wrong or the textarea loses focus.
**Why it happens:** React re-renders reset cursor position. Direct DOM manipulation is needed.
**How to avoid:** Use `requestAnimationFrame` after `setText()` to restore cursor position (same pattern used by `applyMarkup` in CommentComposer).
**Warning signs:** Cursor jumps to end of textarea after mention insertion.

### Pitfall 5: TimelineEntry Type Exhaustiveness
**What goes wrong:** Adding `'worklog'` to the TimelineEntry union without updating all switch/if statements causes unhandled cases.
**Why it happens:** `ActivityTimeline.tsx` uses `if (entry.type === 'change')` / else (assumes comment). Adding worklog breaks the else branch.
**How to avoid:** Update to explicit three-way check: `if (entry.type === 'change') ... else if (entry.type === 'comment') ... else if (entry.type === 'worklog') ...`.
**Warning signs:** Worklogs rendering as comments in the timeline.

### Pitfall 6: Default Timeline Filter Change
**What goes wrong:** The current default filter is `'comment'` (set in `ActivityTimeline.tsx` line 79). With worklogs added, the default might hide them.
**Why it happens:** Phase 31 defaulted to 'comment' since there were only comments and changes.
**How to avoid:** Consider changing the default filter to `'all'` now that there are three entry types, or keep it as 'comment' if that's the most common use case. This is a discretion item.
**Warning signs:** Users can't see worklogs without manually switching filters.

## Code Examples

### Duration Parser
```typescript
// Source: Hand-written utility following Jira duration format conventions
interface ParsedDuration {
  seconds: number;
  display: string;
}

const UNITS: Record<string, number> = {
  w: 5 * 8 * 3600,  // 1w = 5 days
  d: 8 * 3600,       // 1d = 8 hours (Jira default)
  h: 3600,
  m: 60,
};

export function parseDuration(input: string): ParsedDuration | null {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;

  const regex = /(\d+(?:\.\d+)?)\s*(w|d|h|m)/g;
  let match: RegExpExecArray | null;
  let totalSeconds = 0;
  let found = false;

  while ((match = regex.exec(normalized)) !== null) {
    const value = parseFloat(match[1]);
    const unit = match[2];
    totalSeconds += value * UNITS[unit];
    found = true;
  }

  if (!found) return null;
  return { seconds: Math.round(totalSeconds), display: formatDuration(totalSeconds) };
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}
```

### Worklog POST Request Body
```typescript
// Source: Jira REST API v2 documentation
// POST /rest/api/2/issue/{issueKey}/worklog
const body = {
  timeSpentSeconds: 9000,  // 2h 30m
  started: '2026-03-22T10:00:00.000+0000',  // ISO 8601 with timezone
  comment: 'Optional work description',
};
```

### Worklog Type Definition
```typescript
// Add to services/jira/types.ts
export interface JiraWorklog {
  id: string;
  author: {
    displayName: string;
    name?: string;
    avatarUrls?: { '48x48'?: string };
  };
  updateAuthor?: {
    displayName: string;
    name?: string;
  };
  timeSpent: string;           // "2h 30m"
  timeSpentSeconds: number;    // 9000
  started: string;             // ISO 8601
  created: string;             // ISO 8601
  updated: string;             // ISO 8601
  comment?: string;
}
```

### Attachment Upload with Progress (Tauri)
```typescript
// Tauri's fetch from @tauri-apps/plugin-http supports FormData natively.
// However, it does NOT support upload progress events on the fetch API.
// For progress indication, use optimistic UI: show indeterminate progress
// during upload, then resolve on completion.
import { fetch } from '@tauri-apps/plugin-http';

export async function uploadAttachment(
  baseUrl: string, token: string, issueKey: string, file: File,
): Promise<JiraAttachment[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/attachments`;
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch('jira', url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Atlassian-Token': 'no-check',
      // Content-Type intentionally omitted — browser adds multipart boundary
    },
    body: formData as unknown as BodyInit,
  }, 'Upload Attachment');

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
  return response.json() as Promise<JiraAttachment[]>;
}
```

### Textarea Cursor Position for Mention Popover
```typescript
// Standard pattern: mirror textarea content in a hidden div to measure cursor position
function getCursorPosition(textarea: HTMLTextAreaElement, cursorIndex: number): { top: number; left: number } {
  const mirror = document.createElement('div');
  const style = getComputedStyle(textarea);

  // Copy relevant styles
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.width = style.width;
  mirror.style.font = style.font;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.lineHeight = style.lineHeight;

  // Insert text up to cursor, then a span marker
  const textBefore = textarea.value.substring(0, cursorIndex);
  mirror.textContent = textBefore;
  const marker = document.createElement('span');
  marker.textContent = '|';
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const rect = textarea.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();

  const position = {
    top: markerRect.top - rect.top + textarea.scrollTop,
    left: markerRect.left - rect.left,
  };
  document.body.removeChild(mirror);
  return position;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Worklog fetch returns author names only | Must return full JiraWorklog objects | Phase 32 | `fetchAllWorklogPages` return type needs widening |
| Timeline has 2 entry types (comment, change) | Timeline needs 3 entry types (+worklog) | Phase 32 | Discriminated union + filter extension |
| ImageLightbox is single-image | Needs prev/next navigation for attachment gallery | Phase 32 | Extend with image index array |

**Already complete (no work needed):**
- WikiRenderer `[~username]` mention rendering -- fully implemented in Phase 31
- `JiraAttachment` type definition -- already in `types.ts`
- `attachment` field fetched by `fetchIssueDetail` -- already in fields list
- `timetracking` field fetched by `fetchIssueDetail` -- already in fields list
- `AuthImage` authenticated image fetching -- fully working

## Open Questions

1. **Upload progress granularity**
   - What we know: Tauri's `@tauri-apps/plugin-http` fetch does not expose upload progress events. The `@tauri-apps/plugin-upload` exists but adds a separate dependency.
   - What's unclear: Whether indeterminate progress (spinner) is acceptable or if percentage-based progress is required.
   - Recommendation: Use indeterminate progress (spinner + "uploading..." text). Per D-10, single file upload is the scope -- files are typically small enough that indeterminate is fine. If percentage is needed later, the upload plugin can be added.

2. **Worklog "started" date format**
   - What we know: Jira expects ISO 8601 with timezone offset for the `started` field.
   - What's unclear: Exact format Jira DC accepts (some versions are strict about milliseconds).
   - Recommendation: Use `new Date(dateString).toISOString()` which produces `2026-03-22T10:00:00.000Z` -- Jira DC accepts this format.

3. **Attachment delete API**
   - What we know: Jira v2 has `DELETE /rest/api/2/attachment/{id}` (note: attachment ID, not issue key).
   - What's unclear: Whether delete permission is commonly granted via PAT.
   - Recommendation: Implement delete, gracefully handle 403 by hiding the delete option or showing an error.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TIME-01 | Duration parser parses "2h 30m", "1d", "45m" to seconds | unit | `cd taskflow && npx vitest run src/services/jira/duration.test.ts -x` | Wave 0 |
| TIME-01 | POST worklog to Jira API | unit | `cd taskflow && npx vitest run src/services/jira/worklogs.test.ts -x` | Exists (expand) |
| TIME-02 | Fetch full worklog objects | unit | `cd taskflow && npx vitest run src/services/jira/worklogs.test.ts -x` | Exists (expand) |
| TIME-03 | PUT worklog to Jira API | unit | `cd taskflow && npx vitest run src/services/jira/worklogs.test.ts -x` | Exists (expand) |
| TIME-04 | DELETE worklog from Jira API | unit | `cd taskflow && npx vitest run src/services/jira/worklogs.test.ts -x` | Exists (expand) |
| TIME-05 | Time tracking summary computed from timetracking field | unit | `cd taskflow && npx vitest run src/routes/dashboard/issue-detail/TimeTrackingSummary.test.ts -x` | Wave 0 |
| DETAIL-06 | Attachment section renders thumbnails and file list | unit | `cd taskflow && npx vitest run src/routes/dashboard/issue-detail/AttachmentsSection.test.ts -x` | Wave 0 |
| DETAIL-08 | Upload attachment to Jira API | unit | `cd taskflow && npx vitest run src/services/jira/attachments.test.ts -x` | Wave 0 |
| DETAIL-09 | Mention popover filters users, inserts markup | unit | `cd taskflow && npx vitest run src/routes/dashboard/MentionPopover.test.ts -x` | Wave 0 |
| TIME-02 | Timeline merges worklogs + comments + changes | unit | `cd taskflow && npx vitest run src/services/jira-changelog.test.ts -x` | Exists (expand) |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/services/jira/duration.test.ts` -- covers TIME-01 parser logic
- [ ] `src/services/jira/attachments.test.ts` -- covers DETAIL-08 upload API
- [ ] Expand `src/services/jira/worklogs.test.ts` -- covers TIME-01/02/03/04 CRUD
- [ ] Expand `src/services/jira-changelog.test.ts` -- covers worklog timeline merge/filter/count

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All canonical reference files read directly
  - `services/jira/types.ts` -- JiraAttachment, JiraIssueDetail.timetracking already defined
  - `services/jira/worklogs.ts` -- existing worklog fetch (author names only)
  - `services/jira/client.ts` -- fetchAllWorklogPages pagination helper
  - `services/jira/comments.ts` -- CRUD pattern to replicate for worklogs
  - `services/jira-changelog.ts` -- TimelineEntry union, mergeTimeline, filterTimeline, countByType
  - `routes/dashboard/WikiRenderer.tsx` -- [~username] rendering already complete
  - `routes/dashboard/AuthImage.tsx` -- authenticated image fetch with blob URLs
  - `routes/dashboard/ImageLightbox.tsx` -- existing lightbox (needs prev/next extension)
  - `routes/dashboard/CommentComposer.tsx` -- textarea with markup toolbar
  - `routes/dashboard/issue-detail/ActivityTimeline.tsx` -- timeline with filter chips
  - `routes/dashboard/issue-detail/TimelineFilterChips.tsx` -- filter chip pattern
  - `routes/dashboard/issue-detail/FieldsSection.tsx` -- sidebar MetaRow pattern
  - `routes/dashboard/IssueDetailPage.tsx` -- comment CRUD mutation pattern
  - `.planning/phases/32-time-tracking-attachments-mentions/32-UI-SPEC.md` -- full design contract

### Secondary (MEDIUM confidence)
- [Jira REST API v2 Worklogs](https://developer.atlassian.com/cloud/jira/platform/rest/v2/api-group-issue-worklogs/) -- CRUD endpoints and request format
- [Jira REST API v2 Attachments](https://developer.atlassian.com/cloud/jira/platform/rest/v2/api-group-issue-attachments/) -- multipart upload with X-Atlassian-Token
- [Jira attachment upload KB](https://support.atlassian.com/jira/kb/how-to-add-an-attachment-to-a-jira-issue-using-rest-api/) -- X-Atlassian-Token: no-check requirement
- [Tauri HTTP plugin](https://deepwiki.com/tauri-apps/tauri-plugin-http/1-overview) -- FormData support confirmation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, no new dependencies
- Architecture: HIGH -- patterns directly observable in codebase, all integration points identified
- Pitfalls: HIGH -- verified against Jira API docs and existing codebase patterns
- Duration parser: MEDIUM -- simple implementation, but Jira DC may have server-side validation edge cases

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable -- no fast-moving external dependencies)
