# Phase 9: Custom Field Discovery + Issue Detail Foundation - Research

**Researched:** 2026-03-13
**Domain:** Jira REST API v2 issue detail, shadcn Sheet, jira2md + react-markdown rendering, TanStack Query v5 optimistic updates
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Detail panel opens as a shadcn Sheet slide-over (not route navigation) — keeps board DndContext mounted for Phase 10
- Wide sheet layout: ~60% left column (title, description, subtasks, comments), ~40% right sidebar (metadata fields)
- Sidebar contains: priority, assignee, reporter, status, story points, epic, sprint, labels, fix versions, dates, linked issues
- Skeleton placeholders while issue loads — sheet opens instantly with visible structure
- Rich wiki markup rendering: jira2md converts Jira wiki markup → markdown, react-markdown renders it
- Same pipeline for comments (consistent look)
- Scrollable description section within the sheet (no collapse/expand)
- Jira DC always returns wiki markup strings (never ADF) — no ADF handling needed
- Editable fields: assignee, priority, story points, labels
- Optimistic update + rollback on failure (inline error message, same as StatusPopover)
- On success: update field locally + invalidate issue cache in background so sprint board also refreshes
- Description editing is NOT in scope for this phase
- Status transitions NOT added to the detail panel in this phase
- Subtasks appear in the main content column, below description and above comments
- Each subtask row: issue key + summary + status badge; clicking opens its own issue detail sheet
- Comments: read and post; thread ordered newest-first
- Compose box with basic formatting toolbar: bold/italic, code block, bullet list
- Formatting converts to Jira wiki markup before sending to API
- Each comment shows: author avatar + name + relative timestamp ("John D. • 2h ago")
- Linked issues shown in the right sidebar; all link types with type label; each shows key + summary
- discoverCustomFields() replaces discoverStoryPointsField() — single call resolves story points, epic link, epic name, and Account field IDs
- Field IDs are instance-specific and must never be hardcoded
- Discovery result cached for the session (run once, not per-issue)

### Claude's Discretion
- Exact edit mode interaction pattern (click-to-edit inline, pencil-on-hover, or popover) — align with existing StatusPopover for consistency
- Sheet width (e.g., 70vw on desktop, full-width on mobile)
- Exact skeleton layout and animation
- Label editing UX (multi-select popover or comma-separated input)

### Deferred Ideas (OUT OF SCOPE)
- Description editing (rich text editor) — Phase 11 create/edit form
- Status transitions from the detail panel — already on sprint board; defer to Phase 10 board redesign
- Comment reactions or threading/replies — not in scope for v1.2
- Attachment viewing — out of scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ISSUE-01 | User can open a full detail panel for any Jira issue (story, subtask, bug, epic) from any view in the app | Sheet component (controlled open state), issue key passed from TaskCard/TaskRow/SearchResultPanel/notification rows |
| ISSUE-02 | User can read the full issue description rendered from Jira wiki markup as formatted text | jira2md to_markdown() + react-markdown pipeline; GET /rest/api/2/issue with fields=description |
| ISSUE-03 | User can view all issue metadata: priority, assignee, reporter, story points, status, epic link, sprint, labels, fix versions, dates | GET /rest/api/2/issue full fields payload; discoverCustomFields() for instance-specific field IDs |
| ISSUE-04 | User can edit issue fields inline: assignee, priority, story points (optimistic update + rollback) | PUT /rest/api/2/issue/{key} with fields body; TanStack Query v5 onMutate/onError/onSettled pattern |
| ISSUE-05 | User can view all child subtasks with their status from the issue detail panel | fields.subtasks[] from GET issue response; click-to-open nested sheet |
| ISSUE-06 | User can view linked issues (relates to, blocks, is blocked by) from the issue detail panel | fields.issuelinks[] from GET issue response; inwardIssue/outwardIssue + type.inward/type.outward labels |
| ISSUE-07 | User can read the full comment thread for any issue from the detail panel | GET /rest/api/2/issue/{key}/comment (already implemented as fetchComments); render with jira2md + react-markdown |
| ISSUE-08 | User can post a comment on any issue from the detail panel | postComment() already implemented; compose box with Jira wiki markup toolbar |
| ISSUE-09 | User can open any issue directly in Jira via a deep link from the detail panel | openUrl() from @tauri-apps/plugin-opener; URL pattern ${jiraBaseUrl}/browse/${issueKey} |
</phase_requirements>

---

## Summary

Phase 9 builds the full issue detail panel that is accessible from every view in the app. The implementation centers on three concerns: (1) the shadcn Sheet component for the slide-over presentation layer, (2) a jira2md + react-markdown rendering pipeline for wiki markup, and (3) expanded Jira REST API usage for fetching full issue detail and performing optimistic field edits.

The existing codebase has solid foundations to build on: `fetchComments` and `postComment` in `jira.ts` already work; `StatusPopover.tsx` demonstrates the optimistic-update-with-rollback pattern; `TaskCard.tsx` is reusable for subtask and linked-issue rows; and `discoverStoryPointsField()` is the starting point for `discoverCustomFields()`. The Sheet component is the only new shadcn primitive required.

**Primary recommendation:** Install the shadcn Sheet and @tailwindcss/typography; add jira2md and react-markdown packages; extend discoverStoryPointsField() into discoverCustomFields(); build IssueDetailSheet as a controlled component that accepts an issue key and fetches full detail independently using queryKey `['jira-issue-detail', key, jiraBaseUrl]`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn Sheet | (via shadcn CLI) | Slide-over panel built on Radix UI Dialog | Keeps DndContext mounted; focus management; ARIA semantics; matches existing shadcn component usage |
| jira2md | 3.0.1 | Jira wiki markup → Markdown conversion | Only npm package that handles the full Jira wiki syntax set bidirectionally; 9,400+ weekly downloads |
| react-markdown | 10.x | Render markdown string as React elements | Safe (no dangerouslySetInnerHTML); TypeScript-native; plugin ecosystem for GFM tables/strikethrough |
| remark-gfm | 4.x | GitHub Flavored Markdown plugin for react-markdown | Adds tables, task lists, strikethrough — all present in Jira descriptions |
| @tailwindcss/typography | 0.5.x (v4 compatible) | prose classes for markdown styling | Instantly gives proper heading/list/code styling without hand-rolling |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/plugin-opener | 2.x (already installed) | openUrl() for deep links to Jira | ISSUE-09: "Open in Jira" button |
| lucide-react | 0.577.x (already installed) | Pencil, ChevronDown, MessageCircle icons | Edit triggers, expand/collapse, comment button |
| date-fns or native Intl.RelativeTimeFormat | — | "2h ago" relative timestamps on comments | Comment header display; Intl.RelativeTimeFormat preferred (zero dependency) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jira2md | Custom regex converter | Custom converter misses edge cases (nested lists, panels, color macros); jira2md handles these |
| jira2md | jira2markdown (Python-origin JS port) | jira2markdown is more actively maintained but is a heavier dependency; jira2md is simpler and sufficient |
| react-markdown | markdown-to-jsx | react-markdown has better plugin ecosystem and is the community default |
| @tailwindcss/typography | Hand-rolled prose CSS | Hand-rolling risks inconsistent styling; typography plugin handles dark mode inversion automatically |

**Installation:**
```bash
cd taskflow
npx shadcn@latest add sheet
npm install jira2md react-markdown remark-gfm @tailwindcss/typography
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── routes/dashboard/
│   ├── IssueDetailSheet.tsx        # New: main sheet component (controlled open/close)
│   ├── IssueDetailSidebar.tsx      # New: right column metadata fields + inline editors
│   ├── IssueDetailContent.tsx      # New: left column description + subtasks + comments
│   ├── CommentComposer.tsx         # New: wiki-markup-aware compose box
│   ├── WikiRenderer.tsx            # New: jira2md + react-markdown wrapper
│   ├── TaskCard.tsx                # Existing: reuse for subtask rows
│   ├── StatusPopover.tsx           # Existing: reference for edit interaction pattern
│   └── InlineComment.tsx           # Existing: reference for comment pattern
├── services/jira.ts                # Extend: add fetchIssueDetail(), discoverCustomFields(), updateIssueField()
└── stores/settings.store.ts        # Extend: add epicLinkFieldKey, epicNameFieldKey, accountFieldKey
```

### Pattern 1: Controlled Sheet (no SheetTrigger)

**What:** The IssueDetailSheet receives `open` and `issueKey` as props; the parent owns the state. This avoids coupling the trigger location to the sheet's existence in the DOM.
**When to use:** When the trigger (TaskCard, TaskRow, SearchResultPanel, notification row) is in a different component subtree from the sheet.

```typescript
// Controlled pattern — no SheetTrigger needed
// Source: shadcn/ui docs + confirmed via github.com/shadcn-ui/ui discussions
import { Sheet, SheetContent } from '@/components/ui/sheet'

interface IssueDetailSheetProps {
  issueKey: string | null   // null = closed
  onClose: () => void
}

export function IssueDetailSheet({ issueKey, onClose }: IssueDetailSheetProps) {
  return (
    <Sheet open={issueKey !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-[70vw] max-w-none sm:max-w-none p-0">
        {issueKey && <IssueDetailBody issueKey={issueKey} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}
```

### Pattern 2: Independent Issue Detail Query

**What:** Issue detail always fetched with its own query key; never shares cache with sprint board queries.
**When to use:** Every time an issue is opened — the query key scopes to key + baseUrl.

```typescript
// Source: locked decision in CONTEXT.md + TanStack Query docs
const { data: issue, isLoading } = useQuery({
  queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl],
  queryFn: () => fetchIssueDetail(jiraBaseUrl!, token!, issueKey),
  staleTime: 30_000,
  enabled: !!issueKey && !!jiraBaseUrl && !!token,
})
```

### Pattern 3: discoverCustomFields() — Extended Field Discovery

**What:** Single function that calls GET /rest/api/2/field, matches by `schema.custom` identifiers, and returns all instance-specific custom field IDs.
**When to use:** Once at app startup (same pattern as discoverStoryPointsField). Store results in settings store.

```typescript
// Source: locked decision in CONTEXT.md + STATE.md v1.2 RESEARCH notes
// schema.custom values are stable Atlassian plugin identifiers — safe to match against
interface CustomFieldIds {
  storyPointsFieldKey: string    // schema.custom === 'com.atlassian.jira.plugin.system.customfieldtypes:float'
                                 //   or name === 'Story Points' or id === 'customfield_10028'
  epicLinkFieldKey: string       // schema.custom === 'com.pyxis.greenhopper.jira:gh-epic-link'
  epicNameFieldKey: string       // schema.custom === 'com.pyxis.greenhopper.jira:gh-epic-label'
  sprintFieldKey: string         // schema.custom === 'com.pyxis.greenhopper.jira:gh-sprint'
  accountFieldKey: string | null // instance-specific Account field — may not exist
}
```

### Pattern 4: Optimistic Field Updates with Rollback

**What:** Uses TanStack Query v5 `useMutation` with `onMutate`/`onError`/`onSettled` to update the issue detail cache immediately, rollback on failure, and invalidate sprint board cache on success.
**When to use:** For all inline field edits (assignee, priority, story points, labels).

```typescript
// Source: tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
const updateFieldMutation = useMutation({
  mutationFn: ({ fieldName, value }: { fieldName: string; value: unknown }) =>
    updateIssueField(jiraBaseUrl!, token!, issueKey, fieldName, value),
  onMutate: async ({ fieldName, value }) => {
    await queryClient.cancelQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] })
    const previous = queryClient.getQueryData<JiraIssueDetail>(['jira-issue-detail', issueKey, jiraBaseUrl])
    queryClient.setQueryData<JiraIssueDetail>(['jira-issue-detail', issueKey, jiraBaseUrl], (old) => {
      if (!old) return old
      return { ...old, fields: { ...old.fields, [fieldName]: value } }
    })
    return { previous }
  },
  onError: (_err, _vars, context) => {
    if (context?.previous) {
      queryClient.setQueryData(['jira-issue-detail', issueKey, jiraBaseUrl], context.previous)
    }
  },
  onSettled: () => {
    // Refresh detail + sprint board in background
    queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] })
    queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] })
    queryClient.invalidateQueries({ queryKey: ['jira-issues', 'my-tasks'] })
  },
})
```

### Pattern 5: Wiki Markup Rendering Pipeline

**What:** jira2md converts the Jira wiki string to Markdown; react-markdown renders it to React elements.
**When to use:** For both description and comment bodies.

```typescript
// Source: npm jira2md 3.0.1 docs; github.com/remarkjs/react-markdown
import j2m from 'jira2md'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// In WikiRenderer component:
function WikiRenderer({ wikiText }: { wikiText: string }) {
  const markdown = j2m.to_markdown(wikiText)
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
    </article>
  )
}
```

### Anti-Patterns to Avoid

- **Reusing sprint board query cache for issue detail:** Issue detail needs `['jira-issue-detail', key, jiraBaseUrl]` — never `['jira-issues', 'sprint-board', ...]`. The sprint board query only has partial fields.
- **Hardcoding custom field IDs:** epicLinkFieldKey and sprintFieldKey are instance-specific. Always use discoverCustomFields() result.
- **Using ADF handling for DC descriptions:** Jira DC v2 always returns wiki markup strings. `adfToPlainText()` in SearchResultPanel.tsx is not a substitute for jira2md.
- **Sending `accountId` to update assignee on DC:** Data Center uses `{ "name": "username" }` not `{ "accountId": "..." }`. Use the `name` field from the assignee object returned by the GET.
- **Using SheetTrigger:** The trigger is always in a different component (TaskCard, TaskRow, etc.). Use controlled `open` prop on Sheet directly.
- **Re-discovering custom fields on every sheet open:** discoverCustomFields() must run once at startup and cache in settings store. Never call per-issue.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Jira wiki markup → readable HTML | Custom regex converter | jira2md + react-markdown | Jira has 30+ markup constructs; panels, color, noformat, tables — regex solutions miss edge cases |
| Markdown rendering | dangerouslySetInnerHTML | react-markdown | XSS risk; dangerouslySetInnerHTML with HTML strings is a security hole |
| Prose typography | Custom Tailwind classes for h1/h2/p/code/table | @tailwindcss/typography prose class | Covers dark mode, nesting, spacing — hundreds of lines saved |
| Relative timestamps | Custom date math | Intl.RelativeTimeFormat (browser native) | Standard, locale-aware, zero-bundle |
| Sheet/drawer component | Custom z-index + transition + focus trap | shadcn Sheet | Focus trap, scroll lock, a11y labels, Escape key — all implemented correctly in Radix |

**Key insight:** The wiki markup domain is deceptively complex. Real Jira descriptions use nested lists, `{code:java}` blocks, `{noformat}`, `{panel}`, color macros, and table syntax. Any hand-rolled converter will produce broken output on production content.

---

## Common Pitfalls

### Pitfall 1: Fetching Full Issue Detail with Insufficient Fields

**What goes wrong:** The issue detail endpoint `GET /rest/api/2/issue/{key}` returns only a default set of fields unless `fields=` is specified. Missing fields like `issuelinks`, `comment`, `reporter`, `fixVersions`, `labels`, and custom fields for epic/sprint silently return as undefined.
**Why it happens:** Jira paginates and trims fields by default.
**How to avoid:** Always specify an explicit `fields=` parameter. Recommended field list:
```
summary,status,assignee,reporter,priority,issuetype,description,
comment,issuelinks,subtasks,labels,fixVersions,parent,
{epicLinkFieldKey},{epicNameFieldKey},{sprintFieldKey},{storyPointsFieldKey},
timetracking,created,updated,duedate
```
**Warning signs:** `issue.fields.reporter` is undefined; `issue.fields.issuelinks` is missing from response.

### Pitfall 2: Assignee Update Uses Wrong Field Format for Data Center

**What goes wrong:** Sending `{ "assignee": { "accountId": "..." } }` returns 204 but the issue remains unassigned on Jira Data Center.
**Why it happens:** `accountId` is a Cloud concept. DC uses username-based auth.
**How to avoid:** Use `{ "fields": { "assignee": { "name": "<username>" } } }`. The `name` property comes from `issue.fields.assignee.name` in the GET response.
**Warning signs:** PUT returns 204 but refreshed issue shows previous assignee.

### Pitfall 3: discoverCustomFields Called Per-Issue

**What goes wrong:** Every sheet open triggers a `GET /rest/api/2/field` call (~100ms, returns 50-200 fields). Under heavy use this creates unnecessary load.
**Why it happens:** Discovery function placed inside the sheet component's query setup.
**How to avoid:** Call discoverCustomFields() once during app startup (same place discoverStoryPointsField() is called today); store all discovered IDs in settings store. The sheet reads from the store, not the API.
**Warning signs:** Network tab shows repeated `/rest/api/2/field` calls every time a sheet opens.

### Pitfall 4: Nested Sheet Opens Break Scroll Lock

**What goes wrong:** Opening a subtask's sheet from inside the parent issue's sheet causes double scroll lock, and Escape closes the wrong sheet.
**Why it happens:** Radix UI Dialog (which Sheet uses) manages focus and scroll lock at the document level. Nested dialogs require correct layering.
**How to avoid:** When a subtask is clicked, close the parent sheet first and open the subtask sheet as a new root-level Sheet. OR: render both sheets at the root level and use a navigation stack (array of issue keys). The simpler approach is a stack: `[parentKey, subtaskKey]`; Escape pops the stack.
**Warning signs:** Body stops scrolling after closing nested sheet; Escape key doesn't work.

### Pitfall 5: jira2md's `to_markdown` Called with null/undefined

**What goes wrong:** `j2m.to_markdown(null)` throws a TypeError in jira2md 3.0.1.
**Why it happens:** Jira DC returns `null` for description on issues with no description. The field is nullable.
**How to avoid:** Guard with `wikiText ? j2m.to_markdown(wikiText) : ''` before rendering.
**Warning signs:** White screen / uncaught error when opening an issue with no description.

### Pitfall 6: react-markdown inside Tailwind prose breaks code block styling

**What goes wrong:** Code blocks inside the prose class get double-styled — Tailwind's typography plugin applies its code styles AND react-markdown applies its own.
**Why it happens:** The prose class targets `pre > code` specifically; custom `components` props in react-markdown can interfere.
**How to avoid:** Use `max-w-none` and the `prose-sm` scale. Do not override `code` and `pre` rendering with custom components unless necessary.
**Warning signs:** Code blocks appear with doubled borders, wrong font size, or broken background.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### GET Full Issue Detail from Jira DC
```typescript
// Source: Atlassian Jira REST API v2 docs + existing jira.ts pattern
export async function fetchIssueDetail(
  baseUrl: string,
  token: string,
  issueKey: string,
  customFields: { epicLinkFieldKey: string; sprintFieldKey: string; storyPointsFieldKey: string },
): Promise<JiraIssueDetail> {
  const base = baseUrl.replace(/\/$/, '')
  const fields = [
    'summary', 'status', 'assignee', 'reporter', 'priority', 'issuetype',
    'description', 'comment', 'issuelinks', 'subtasks', 'labels',
    'fixVersions', 'parent', 'timetracking', 'created', 'updated', 'duedate',
    customFields.epicLinkFieldKey,
    customFields.sprintFieldKey,
    customFields.storyPointsFieldKey,
  ].join(',')
  const url = `${base}/rest/api/2/issue/${issueKey}?fields=${fields}`
  const response = await apiFetch('jira', url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!response.ok) throw new Error(`Failed to fetch issue ${issueKey}: ${response.status}`)
  return response.json() as Promise<JiraIssueDetail>
}
```

### PUT Issue Field Update (Data Center format)
```typescript
// Source: developer.atlassian.com/server/jira/platform/updating-an-issue-via-the-jira-rest-apis-6848604
// DC uses "fields" implicit update; DO NOT send accountId for assignee
export async function updateIssueField(
  baseUrl: string,
  token: string,
  issueKey: string,
  fieldName: string,
  value: unknown,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}`
  const response = await apiFetch('jira', url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { [fieldName]: value } }),
  })
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to update ${fieldName} on ${issueKey}: ${response.status}`)
  }
}
// Assignee: value = { name: issue.fields.assignee.name }
// Priority: value = { name: 'High' }  (or 'Highest', 'Medium', 'Low', 'Lowest')
// Story points: value = 5  (bare number, the field is a float type)
// Labels: value = ['label1', 'label2']  (full array, SET semantics)
```

### discoverCustomFields() — Extended from discoverStoryPointsField()
```typescript
// Source: existing discoverStoryPointsField() in jira.ts + STATE.md v1.2 RESEARCH
export async function discoverCustomFields(
  baseUrl: string,
  token: string,
): Promise<{ storyPointsFieldKey: string; epicLinkFieldKey: string; epicNameFieldKey: string; sprintFieldKey: string }> {
  const defaults = {
    storyPointsFieldKey: 'customfield_10016',
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10015',
    sprintFieldKey: 'customfield_10020',
  }
  try {
    const response = await apiFetch('jira', `${baseUrl.replace(/\/$/, '')}/rest/api/2/field`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return defaults
    const fields: Array<{ id: string; name: string; schema?: { custom?: string } }> = await response.json()
    const result = { ...defaults }
    for (const f of fields) {
      const custom = f.schema?.custom ?? ''
      if (custom === 'com.pyxis.greenhopper.jira:gh-epic-link') result.epicLinkFieldKey = f.id
      if (custom === 'com.pyxis.greenhopper.jira:gh-epic-label') result.epicNameFieldKey = f.id
      if (custom === 'com.pyxis.greenhopper.jira:gh-sprint') result.sprintFieldKey = f.id
      if (
        custom === 'com.atlassian.jira.plugin.system.customfieldtypes:float' &&
        (f.name === 'Story Points' || f.name === 'story_points')
      ) result.storyPointsFieldKey = f.id
      if (f.id === 'customfield_10028') result.storyPointsFieldKey = f.id // secondary SP field
    }
    return result
  } catch {
    return defaults
  }
}
```

### issuelinks Response Shape (for display)
```typescript
// Source: community.atlassian.com confirmed response shape
interface JiraIssueLink {
  id: string
  type: { id: string; name: string; inward: string; outward: string }
  inwardIssue?: { id: string; key: string; fields: { summary: string; status: { name: string } } }
  outwardIssue?: { id: string; key: string; fields: { summary: string; status: { name: string } } }
}
// Display: if inwardIssue exists → label = type.inward + ": " + inwardIssue.key
//          if outwardIssue exists → label = type.outward + ": " + outwardIssue.key
// Example: "is blocked by: PROJ-45" / "blocks: PROJ-12"
```

### Relative Timestamp (no dependency)
```typescript
// Source: MDN Intl.RelativeTimeFormat — browser-native, zero-bundle
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (diffSecs < 60) return rtf.format(-diffSecs, 'second')
  if (diffSecs < 3600) return rtf.format(-Math.floor(diffSecs / 60), 'minute')
  if (diffSecs < 86400) return rtf.format(-Math.floor(diffSecs / 3600), 'hour')
  return rtf.format(-Math.floor(diffSecs / 86400), 'day')
}
```

### Comment Wiki Markup Toolbar (text insertion)
```typescript
// Pattern: insert Jira wiki markup syntax around selected text or at cursor
function applyMarkup(textarea: HTMLTextAreaElement, prefix: string, suffix: string) {
  const { selectionStart, selectionEnd, value } = textarea
  const selected = value.slice(selectionStart, selectionEnd)
  const before = value.slice(0, selectionStart)
  const after = value.slice(selectionEnd)
  const newValue = `${before}${prefix}${selected}${suffix}${after}`
  // Set value and move cursor to end of inserted text
  return { newValue, cursorPos: selectionStart + prefix.length + selected.length + suffix.length }
}
// Bold: prefix='*', suffix='*'
// Italic: prefix='_', suffix='_'
// Code block: prefix='{code}', suffix='{code}'
// Bullet list: prefix='* ', suffix=''  (at line start)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `discoverStoryPointsField()` — single field | `discoverCustomFields()` — all instance-specific fields | Phase 9 | Epic link, sprint field, Account field all discovered from one API call |
| `adfToPlainText()` — plain text extraction | `jira2md + react-markdown` — full formatted rendering | Phase 9 | Users see headers, code blocks, tables, bold/italic — not plain text |
| Inline comment in TaskRow (InlineComment.tsx) | Full comment thread in IssueDetailSheet | Phase 9 | Full scrollable thread + compose box replaces the minimal inline textarea |
| No issue detail view | IssueDetailSheet accessible from all entry points | Phase 9 | Eliminates need to open Jira for routine issue review |

**Deprecated/outdated:**
- `discoverStoryPointsField()`: Will be replaced by `discoverCustomFields()`. Callers (app startup) switch to the new function. The old function can be removed once migrated.
- `adfToPlainText()` in SearchResultPanel.tsx: Remains for the search panel's description excerpt (plain text truncation). Do NOT use for issue detail rendering.

---

## Open Questions

1. **jira2md maintenance concern (from STATE.md blockers)**
   - What we know: jira2md 3.0.1 was last published 2 years ago (Oct 2022). 9,400 weekly downloads. GitHub repo is github.com/kylefarris/J2M. The package still works correctly; unmaintained does not mean broken for stable markup conversion.
   - What's unclear: Whether any Jira DC wiki syntax variants used by the Orange instance are not covered.
   - Recommendation: Adopt jira2md. It handles all standard Jira wiki constructs. Wrap the call defensively — if `to_markdown()` throws, fall back to displaying raw wiki text. If exotic Orange-instance macros appear broken, a thin post-processor can be added in Wave 2 without changing the architecture.

2. **Sprint field response shape**
   - What we know: The sprint custom field (commonly `customfield_10020`) returns an array of sprint objects in the GET issue response, not a single sprint. The active sprint is the one with `state: 'active'`.
   - What's unclear: Exact shape of each sprint object (name, id, state fields).
   - Recommendation: Request `{sprintFieldKey}` in the fields param; display `fields[sprintFieldKey]?.find(s => s.state === 'active')?.name ?? 'No sprint'`. Handle the case where the field is a string (some older DC versions) gracefully.

3. **Assignee picker for inline edit**
   - What we know: Assigning a new user requires knowing the username string. The endpoint `GET /rest/api/2/user/assignable/search?issueKey={key}&query={text}` returns users assignable to a specific issue.
   - What's unclear: Response latency on the Orange instance (impacts whether typeahead is smooth).
   - Recommendation: Implement assignee edit as a typeahead popover (similar to StatusPopover). Fetch assignable users lazily on popover open, debounce query input at 300ms.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + @testing-library/react 16.x |
| Config file | `taskflow/vitest.config.ts` (jsdom environment, globals: true) |
| Setup file | `taskflow/src/test/setup.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=dot` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ISSUE-01 | IssueDetailSheet opens/closes when issueKey prop changes | unit | `npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx` | ❌ Wave 0 |
| ISSUE-02 | WikiRenderer converts wiki markup and renders formatted output | unit | `npx vitest run src/routes/dashboard/WikiRenderer.test.tsx` | ❌ Wave 0 |
| ISSUE-03 | fetchIssueDetail returns all expected metadata fields | unit | `npx vitest run src/services/jira.test.ts -t "fetchIssueDetail"` | ❌ Wave 0 (new test in jira.test.ts) |
| ISSUE-04 | updateIssueField calls PUT with correct body; optimistic update applied and rolled back on error | unit | `npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "optimistic"` | ❌ Wave 0 |
| ISSUE-05 | Subtask list renders from fields.subtasks; click triggers onOpenIssue callback | unit | `npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "subtask"` | ❌ Wave 0 |
| ISSUE-06 | issuelinks displayed with correct inward/outward labels | unit | `npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "linked"` | ❌ Wave 0 |
| ISSUE-07 | Comment thread renders newest-first with author + timestamp | unit | `npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "comments"` | ❌ Wave 0 |
| ISSUE-08 | postComment called on compose submit; compose box cleared | unit | `npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "post comment"` | ❌ Wave 0 |
| ISSUE-09 | "Open in Jira" button calls openUrl with correct URL | unit | `npx vitest run src/routes/dashboard/IssueDetailSheet.test.tsx -t "open in jira"` | ❌ Wave 0 |
| ISSUE-03 | discoverCustomFields resolves epic link, sprint, story points field keys | unit | `npx vitest run src/services/jira.test.ts -t "discoverCustomFields"` | ❌ Wave 0 (new test) |

### Sampling Rate

- **Per task commit:** `cd taskflow && npx vitest run --reporter=dot`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx` — covers ISSUE-01, 04, 05, 06, 07, 08, 09
- [ ] `taskflow/src/routes/dashboard/WikiRenderer.test.tsx` — covers ISSUE-02
- [ ] New tests in `taskflow/src/services/jira.test.ts` for `fetchIssueDetail` and `discoverCustomFields` — covers ISSUE-03
- [ ] Package install: `npm install jira2md react-markdown remark-gfm @tailwindcss/typography` — required before WikiRenderer can be tested
- [ ] shadcn Sheet: `cd taskflow && npx shadcn@latest add sheet` — required before IssueDetailSheet tests can render

---

## Sources

### Primary (HIGH confidence)
- Official shadcn/ui Sheet docs — `https://ui.shadcn.com/docs/components/radix/sheet` — installation command, props, side options, controlled open pattern
- TanStack Query v5 Optimistic Updates docs — `https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates` — onMutate/onError/onSettled pattern
- Atlassian Jira Server REST API update docs — `https://developer.atlassian.com/server/jira/platform/updating-an-issue-via-the-jira-rest-apis-6848604/` — PUT /rest/api/2/issue request body format for assignee/priority/labels
- react-markdown GitHub — `https://github.com/remarkjs/react-markdown` — v10, TypeScript support, remark-gfm plugin
- Existing codebase — `taskflow/src/services/jira.ts`, `StatusPopover.tsx`, `TaskCard.tsx`, `InlineComment.tsx`, `settings.store.ts` — confirmed patterns for auth, optimistic updates, comment posting

### Secondary (MEDIUM confidence)
- jira2md npm — `https://www.npmjs.com/package/jira2md` — v3.0.1, to_markdown() API, ES module import (verified against GitHub)
- Atlassian community — issuelinks response shape including inwardIssue/outwardIssue/type — confirmed by multiple community posts
- @tailwindcss/typography v4 compatibility — `https://github.com/tailwindlabs/tailwindcss/discussions/15904` — `@plugin "@tailwindcss/typography"` in CSS; `npm install @tailwindcss/typography`
- Jira custom field schema.custom identifiers — `com.pyxis.greenhopper.jira:gh-epic-link`, `gh-sprint`, `gh-epic-label` — confirmed by community posts and existing STATE.md RESEARCH notes

### Tertiary (LOW confidence)
- Sprint field response shape (array vs single object) — inferred from Agile REST API patterns; should be verified against Orange instance
- jira2md handling of exotic Jira macros (color, emoticons, mention) — assumed based on README; not independently verified against Orange instance content

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — shadcn Sheet and react-markdown are verified via official docs; jira2md is widely used (9k+ weekly downloads) and the API is simple
- Architecture: HIGH — patterns extend directly from existing codebase (StatusPopover, discoverStoryPointsField, TanStack Query usage)
- Pitfalls: HIGH — accountId vs name is a documented DC gotcha; field subset issue is confirmed by Jira API behavior; nested Sheet issue is confirmed by shadcn GitHub discussions

**Research date:** 2026-03-13
**Valid until:** 2026-06-13 (stable library APIs; Jira DC REST API v2 is stable)
