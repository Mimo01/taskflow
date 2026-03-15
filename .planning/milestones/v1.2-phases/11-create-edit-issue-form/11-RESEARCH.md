# Phase 11: Create/Edit Issue Form - Research

**Researched:** 2026-03-14
**Domain:** Jira DC REST API (createmeta, createIssue, updateIssue, issueLinkType, issueLink), React modal dialog, dynamic form rendering, TanStack Query mutations
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Form surface:** Modal dialog (not Sheet, not full-page route) — centered overlay, board/backlog stays mounted underneath
- **Same modal for create and edit** — pre-filled for edit
- **Modal entry points:** (1) Sidebar nav "Create Issue" as a button styled like a nav link (second position, after Dashboard, before role-specific links), (2) IssueDetailContent "+ Add subtask" — pre-fills type=Subtask + parent=current key
- **Sprint board quick-create stays as-is** — summary-only, sidebar Create Issue is the full-featured path
- **Edit mode:** IssueDetailContent gets an "Edit" button alongside "Open in Jira" — opens same modal pre-filled. Existing inline field editors (assignee, priority, story points) coexist; edit modal is "edit everything at once"
- **Edit modal does NOT include issue type switching** (cannot change issue type on existing Jira issue)
- **Description editing:** Formatting toolbar above plain textarea — bold `*text*`, italic `_text_`, inline code `{code}`, bullet list `*` — inserts wiki markup at cursor. Edit/Preview tab toggle. Preview renders through WikiRenderer (jira2md + react-markdown). DC always receives wiki markup strings — no ADF.
- **Issue type switcher is first field** in create form — Story / Subtask / Bug dropdown. Switching re-renders fields dynamically. Subtask: shows Parent (required), hides Epic link. Story/Bug: shows Epic link, hides Parent. Values preserved across type switches where field names match.
- **Custom required fields (Account, etc.):** Loaded from createmeta per issue type. Form opens with core fields immediately; custom required fields show skeleton placeholder while createmeta resolves. Submit blocked until all required fields have values.
- **Submit only sends fields confirmed present on screen** (prevents "field not on screen" 400s from Jira)
- **Issue links (CREATE-04):** "Add link" row in the form — link type dropdown (from GET /rest/api/2/issueLinkType) + issue search input. Type-to-search inline same approach as Global Search. Multiple link rows before submitting. Link type names discovered dynamically — never hardcoded.
- **Form validation:** Summary required; others optional unless createmeta marks required. Client-side validation before submit. API errors shown inline below form (not toast).

### Claude's Discretion
- Exact dialog width and height (reasonable desktop size, scrollable if needed)
- Animation for dialog open/close
- Exact skeleton placeholder implementation for custom fields
- Toolbar button icon choices (lucide-react icons)
- How multiple issue links are displayed in the list (compact rows)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CREATE-01 | User can create a new Jira issue (story, subtask, bug) with: summary, description, assignee, story points, issue type, epic link, priority, and parent (for subtasks) | Extended createIssue() in jira.ts; dynamic field set from issue type switch |
| CREATE-02 | User can set all required custom fields when creating/editing — fields discovered dynamically from createmeta endpoint, not hardcoded | createmeta dual-endpoint strategy (8.4+ paginated endpoints + legacy fallback); Account field discovered from createmeta required:true fields |
| CREATE-03 | User can edit an existing issue's summary, description, assignee, story points, priority, and epic link | New bulkUpdateIssue() in jira.ts sending all edited fields in one PUT; epic link uses epicLinkFieldKey from settings store |
| CREATE-04 | User can add issue links to any issue (relates to, blocks, is blocked by) with link type selection from discovered list | GET /rest/api/2/issueLinkType for link type names; POST /rest/api/2/issueLink per link (one call per link, called after issue create) |
</phase_requirements>

## Summary

Phase 11 builds a modal Create/Edit form that uses the Jira DC REST API to discover what fields to render (via createmeta), fetch assignable users inline (existing pattern from IssueDetailSidebar), discover available link types, and post issue creates/updates. The modal is built entirely from UI primitives already present in the project — `@base-ui/react/dialog` (the same Dialog primitive underlying `sheet.tsx`), `Tabs`, `Select`, `Input`, `Textarea`, and `Button`.

The central complexity is the createmeta endpoint strategy. Jira DC 8.4+ replaced the old flat `GET /rest/api/2/issue/createmeta` with paginated per-type endpoints; both must be supported with a capability probe. The Account custom field (and any other instance-required fields) must be discovered from this response and rendered with a skeleton until the async call resolves. The submit payload must be filtered to only fields confirmed present on screen to avoid Jira's "field not on screen" 400 error.

Issue links are created as separate POST calls after the issue create succeeds (the Jira API does not accept issuelinks in the create body). Each link row calls `POST /rest/api/2/issueLink` independently. All mutations follow the existing `useMutation` + `queryClient.invalidateQueries` pattern established in Phase 9.

**Primary recommendation:** Use the `@base-ui/react/dialog` Dialog primitive directly (same package already installed, same pattern as Sheet) rather than repurposing SheetContent — the modal should be centered overlay, not side-slide.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@base-ui/react` | `^1.2.0` (installed) | Dialog primitive for centered modal | Already installed; same as Sheet; Dialog.Root/Popup/Backdrop/Close API |
| `@tanstack/react-query` | `^5.90.21` (installed) | createmeta, assignable users, link types via useQuery; create/update via useMutation | Established project pattern |
| `lucide-react` | `^0.577.0` (installed) | Toolbar button icons, dialog close, Plus icon for link rows | Established project pattern |
| `jira2md` + `react-markdown` + `remark-gfm` | installed | Preview tab renders wiki markup through WikiRenderer | Already used; reuse without change |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@base-ui/react/tabs` (Tabs component) | installed | Edit/Preview tab toggle in description | Existing `tabs.tsx` wrapper already present |
| `zustand` | `^5.0.11` (installed) | Read field keys from settings store (epicLinkFieldKey, storyPointsFieldKey, accountFieldKey) | Read-only consumption of existing store |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@base-ui/react/dialog` directly | Repurpose `SheetContent` centered | Sheet is styled as slide-over; centering it requires overriding fixed positioning — just use Dialog directly |
| Manual textarea cursor insert | `react-textarea-caret-position` | Simple insertions at cursor work fine with `selectionStart/selectionEnd` on the native element — no library needed |
| Single bulk issueLinks in create body | Separate POST per link | Jira DC REST API does not accept issuelinks in the create body — separate calls are required by the API |

**Installation:** No new packages required. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/routes/dashboard/
├── CreateEditIssueModal.tsx       # Modal root (Dialog.Root wrapper, mode=create|edit)
├── CreateEditIssueModal.test.tsx  # Unit tests
├── DescriptionEditor.tsx          # Edit/Preview tab + toolbar
└── IssueLinkRow.tsx               # Single link row (type dropdown + search input)
```

Note: locate files in `src/routes/dashboard/` consistent with existing issue-detail components (IssueDetailSheet, IssueDetailContent, etc.).

### Pattern 1: @base-ui/react Dialog (Centered Modal)
**What:** The Dialog primitive from @base-ui/react is the same underlying primitive that Sheet wraps for slide-over. For a centered modal, use it directly with different positioning styles.
**When to use:** Anywhere the UX calls for a centered overlay rather than a side-slide.
**Example:**
```typescript
// Source: @base-ui/react package — same import pattern as sheet.tsx
import { Dialog } from '@base-ui/react/dialog'

function CreateEditIssueModal({ open, onClose }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2
                                  w-[680px] max-h-[85vh] overflow-y-auto bg-background
                                  border rounded-lg shadow-xl flex flex-col">
          {/* form content */}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

### Pattern 2: createmeta Dual-Endpoint Strategy (HIGH confidence)
**What:** Jira 8.4+ replaced the flat createmeta endpoint with paginated per-type endpoints. Both must be supported. Use /rest/capabilities to probe which strategy the instance supports.
**When to use:** Whenever discovering required fields before rendering the create form.
**Example:**
```typescript
// Source: Atlassian developer docs (verified)
// Strategy A (Jira 8.4+):
// Step 1: GET /rest/api/2/issue/createmeta/{projectKey}/issuetypes
// Step 2: GET /rest/api/2/issue/createmeta/{projectKey}/issuetypes/{issueTypeId}?maxResults=50
// Strategy B (pre-8.4 fallback):
// GET /rest/api/2/issue/createmeta?projectKeys={key}&issuetypeNames={type}&expand=projects.issuetypes.fields

async function fetchCreatemeta(
  baseUrl: string, token: string, projectKey: string, issueTypeId: string
): Promise<CreatemetaField[]> {
  const base = baseUrl.replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${token}` }

  // Try new paginated endpoint first
  const newEndpoint = `${base}/rest/api/2/issue/createmeta/${projectKey}/issuetypes/${issueTypeId}?maxResults=50`
  const resp = await apiFetch('jira', newEndpoint, { headers })
  if (resp.ok) {
    const data = await resp.json()
    // new endpoint returns { values: [...fields], total, startAt, maxResults }
    return (data.values ?? []) as CreatemetaField[]
  }

  // Fallback: legacy flat endpoint (pre-8.4 or 9.0+ with feature flag re-enabled)
  const legacyUrl = `${base}/rest/api/2/issue/createmeta?projectKeys=${projectKey}&issuetypeNames=...&expand=projects.issuetypes.fields`
  const legacyResp = await apiFetch('jira', legacyUrl, { headers })
  if (!legacyResp.ok) return []
  const legacyData = await legacyResp.json()
  return legacyData.projects?.[0]?.issuetypes?.[0]?.fields
    ? Object.values(legacyData.projects[0].issuetypes[0].fields) as CreatemetaField[]
    : []
}
```

### Pattern 3: Extended createIssue() — Full Field Set
**What:** The existing `createIssue()` in jira.ts only sends summary + Story type. Phase 11 needs it extended to accept all create fields.
**When to use:** Replace the existing call site in QuickCreateInput.tsx with the extended version using the same function name but new optional parameters.
**Example:**
```typescript
// Extended signature — backward compatible (all new params optional)
export async function createIssue(
  baseUrl: string,
  token: string,
  projectKey: string,
  summary: string,
  options?: {
    issuetype?: string        // 'Story' | 'Subtask' | 'Bug'
    description?: string      // wiki markup string
    assignee?: { name: string } // DC format
    priority?: { name: string }
    parent?: { key: string }  // for Subtasks
    [fieldKey: string]: unknown // dynamic custom fields (storyPoints, epicLink, account, etc.)
  }
): Promise<{ id: string; key: string }>
// Body: filter options to only defined keys before sending
// CRITICAL: never send undefined fields — causes "field not on screen" 400
```

### Pattern 4: bulkUpdateIssue() — Edit Mode
**What:** updateIssueField() updates one field per call. Edit mode needs a single PUT with all changed fields.
**When to use:** When the edit modal submits (all changed fields in one request).
**Example:**
```typescript
// New function in jira.ts — mirrors updateIssueField but accepts a fields object
export async function bulkUpdateIssue(
  baseUrl: string,
  token: string,
  issueKey: string,
  fields: Record<string, unknown>,  // only include fields that are present on screen
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}`
  const response = await apiFetch('jira', url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => ({}))
    throw new Error(
      (body as { errorMessages?: string[] }).errorMessages?.[0]
      ?? `Failed to update ${issueKey}: ${response.status}`
    )
  }
}
```

### Pattern 5: POST /rest/api/2/issueLink
**What:** Issue links are created in separate API calls AFTER the issue create succeeds. The Jira DC REST API does not accept `issuelinks` in the create body.
**When to use:** After successful createIssue(), iterate through link rows and POST each one.
**Example:**
```typescript
// Source: Atlassian DC REST API docs (verified)
export async function createIssueLink(
  baseUrl: string,
  token: string,
  linkTypeId: string,   // id from GET /rest/api/2/issueLinkType
  inwardKey: string,    // the issue being created/edited
  outwardKey: string,   // the linked issue
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issueLink`
  const response = await apiFetch('jira', url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: { id: linkTypeId },
      inwardIssue: { key: inwardKey },
      outwardIssue: { key: outwardKey },
    }),
  })
  if (!response.ok && response.status !== 201) {
    throw new Error(`Failed to create issue link: ${response.status}`)
  }
}
```

### Pattern 6: GET /rest/api/2/issueLinkType
**What:** Fetch all available link type names dynamically. Never hardcode "Blocks", "Relates To", etc.
**Example:**
```typescript
// Returns: { issueLinkTypes: Array<{ id, name, inward, outward }> }
export async function fetchIssueLinkTypes(
  baseUrl: string, token: string
): Promise<IssueLinkType[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issueLinkType`
  const resp = await apiFetch('jira', url, { headers: { Authorization: `Bearer ${token}` } })
  if (!resp.ok) return []
  const data = await resp.json()
  return data.issueLinkTypes ?? []
}
```

### Pattern 7: Sidebar "Create Issue" Button (not NavLink)
**What:** The Create Issue entry in the sidebar opens a dialog (not a route). It must be a `<button>` styled to match `navLinkClass`, not a `<NavLink>`.
**When to use:** Adding Create Issue item between Dashboard and role-specific links.
**Example:**
```typescript
// Sidebar.tsx — add between Dashboard NavLink and the role-specific section
const [createModalOpen, setCreateModalOpen] = useState(false)

// In JSX, after Dashboard NavLink:
<button
  type="button"
  onClick={() => setCreateModalOpen(true)}
  className={`${NAV_LINK_CLASS} hover:bg-accent`}  // same class as inactive navLinkClass
>
  <PlusSquare className="h-4 w-4 shrink-0" />
  <span className="hidden md:block">Create Issue</span>
</button>
// ...
<CreateEditIssueModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
```

**NOTE:** Sidebar currently is a stateless component. Adding modal open state to Sidebar means either: (a) lifting the modal state to AppLayout (preferred — consistent with IssueDetailSheet pattern), or (b) making Sidebar stateful. The AppLayout pattern is preferred since it already owns the IssueDetailSheet.

### Pattern 8: Description Toolbar — Insert at Cursor
**What:** Toolbar buttons insert wiki markup syntax at cursor position in the textarea using `selectionStart`/`selectionEnd`. No library needed.
**Example:**
```typescript
function insertAtCursor(
  textareaRef: React.RefObject<HTMLTextAreaElement>,
  before: string,
  after: string,
  setValue: (v: string) => void,
) {
  const el = textareaRef.current
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const text = el.value
  const newText = text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end)
  setValue(newText)
  // Restore cursor position after React re-render
  requestAnimationFrame(() => {
    el.selectionStart = start + before.length
    el.selectionEnd = end + before.length
    el.focus()
  })
}
// Usage: bold button → insertAtCursor(ref, '*', '*', setDescription)
// Usage: bullet → insertAtCursor(ref, '* ', '', setDescription) on new line
```

### Anti-Patterns to Avoid
- **Hardcoding issue link type names:** Never `type: { name: 'Blocks' }` — admins rename them. Always use `id` from the discovered list.
- **Sending issuelinks in create body:** Jira DC ignores or errors on `issuelinks` in `POST /rest/api/2/issue`. Create links separately after issue creation.
- **Sending all form fields to Jira regardless of presence:** The "field not on screen" 400 error occurs when you PUT fields that Jira's screen configuration does not include. Filter the submit payload to only defined, non-undefined fields.
- **Using `accountId` for assignee:** Jira DC uses `{ name: username }` format, not `{ accountId }` (Cloud-only). The existing IssueDetailSidebar already uses the correct DC format.
- **Sending ADF for description:** Jira DC v2 accepts only wiki markup strings. ADF is Cloud-only. The CONTEXT.md and STATE.md both have this locked.
- **Re-discovering custom fields:** `discoverCustomFields()` already ran on app startup. Read `epicLinkFieldKey`, `storyPointsFieldKey`, `accountFieldKey` from the settings store — never re-call during form render.
- **Using `<NavLink>` for Create Issue in sidebar:** NavLink requires a route path; it marks the link active based on current URL. Create Issue opens a dialog, not a route — use `<button>`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Centered modal overlay | Custom fixed-position div | `@base-ui/react/dialog` Dialog.Root/Popup/Backdrop | Already installed; accessible (focus trap, Escape key, ARIA); consistent with Sheet |
| Edit/Preview tab toggle | Custom tab state | `@/components/ui/tabs.tsx` (Tabs, TabsList, TabsTrigger, TabsContent) | Already present; wraps @base-ui/react/tabs |
| Assignee live search | Custom debounced fetch state | Pattern from IssueDetailSidebar.tsx (line 127) | Already written and working — copy the `doSearch` + `useDebounce` pattern |
| Issue search for link picker | Custom search | Pattern from SearchOverlay.tsx + `searchJira()` | Already written — same debounced useQuery pattern |
| Wiki markup preview | Custom renderer | `WikiRenderer` component (routes/dashboard/WikiRenderer.tsx) | Already built in Phase 9 |

## Common Pitfalls

### Pitfall 1: "Field not on screen" 400 from Jira
**What goes wrong:** POST /rest/api/2/issue returns 400 with `errorMessages: ["Field 'X' cannot be set. It is not on the appropriate screen"]`
**Why it happens:** The submitted fields object includes keys for fields that are not configured on the Create Issue screen in Jira's admin settings.
**How to avoid:** Only include fields in the submit body that (a) createmeta confirmed are present for this issue type, AND (b) have non-undefined values on the form. Build the body object conditionally.
**Warning signs:** 400 response with "screen" in the error message.

### Pitfall 2: createmeta New Endpoint 404 on Older Instances
**What goes wrong:** `GET /rest/api/2/issue/createmeta/{projectKey}/issuetypes/{id}` returns 404 on Jira instances older than 8.4.
**Why it happens:** The per-type paginated endpoint was introduced in Jira 8.4. Pre-8.4 instances only have the flat endpoint.
**How to avoid:** Try the new endpoint first; on 404, fall back to the legacy flat endpoint with `expand=projects.issuetypes.fields`. Both paths should return the same `{ id, name, required, schema }` field shape.
**Warning signs:** 404 from the new endpoint.

### Pitfall 3: Issue Links Cannot Be Sent in Create Body
**What goes wrong:** Including `issuelinks: [...]` in `POST /rest/api/2/issue` body results in 400 or the field being silently ignored.
**Why it happens:** The Jira DC API requires issue links to be created via the dedicated `POST /rest/api/2/issueLink` endpoint. The create body schema does not include issuelinks.
**How to avoid:** After `createIssue()` resolves successfully and returns the new issue key, iterate through the link rows and call `createIssueLink()` for each. Errors on individual links should not fail the whole create — report them inline.

### Pitfall 4: Modal State Placement in Sidebar vs AppLayout
**What goes wrong:** Adding `useState` for modal open to Sidebar.tsx makes the component stateful and requires prop-drilling or event bubbling to open the modal from IssueDetailContent.
**Why it happens:** Create Issue in the sidebar and "+ Add subtask" in IssueDetailContent both open the same modal. If the state lives in Sidebar, it's unreachable from IssueDetailContent.
**How to avoid:** Lift `createModalOpen` state to AppLayout in `main.tsx` — the same component that already owns `selectedIssueKey` for IssueDetailSheet. Pass `onOpenCreate` as a prop to Sidebar and `onAddSubtask` to IssueDetailSheet/IssueDetailContent.

### Pitfall 5: Epic Link Field on Subtasks
**What goes wrong:** Submitting an epicLinkFieldKey value when creating a Subtask returns 400 from Jira.
**Why it happens:** Subtasks belong to their parent story, not directly to an epic. Jira DC rejects epic link on subtask create.
**How to avoid:** When issue type is Subtask, exclude epicLinkFieldKey from the submit body entirely. The CONTEXT.md decision already specifies this: "Subtask: shows Parent field (required), hides Epic link."

### Pitfall 6: @base-ui/react Dialog vs Sheet Difference
**What goes wrong:** Using SheetContent but trying to center it leads to fighting Tailwind positioning overrides.
**Why it happens:** SheetContent applies `data-[side=right]:inset-y-0 data-[side=right]:right-0` fixed positioning. Overriding this for a centered dialog is verbose and fragile.
**How to avoid:** Import `Dialog` directly from `@base-ui/react/dialog` and apply `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2` to the Popup. This is the correct primitive for centered modals.

### Pitfall 7: createmeta issueTypeId vs issueTypeName
**What goes wrong:** The new paginated createmeta endpoint requires the issue type's numeric `id`, not the display name string.
**Why it happens:** The new endpoints are: `/issue/createmeta/{project}/issuetypes` (returns list with ids) then `/issue/createmeta/{project}/issuetypes/{issueTypeId}` (returns fields). You must fetch the list first to resolve id from name.
**How to avoid:** Fetch `/issue/createmeta/{project}/issuetypes` first, find the issue type by name to get its id, then fetch fields.

## Code Examples

Verified patterns from official sources and existing codebase:

### Createmeta New Endpoint (Jira 8.4+)
```typescript
// Source: Atlassian DC developer docs — verified
// Step 1: list issue types for project
// GET /rest/api/2/issue/createmeta/{projectKey}/issuetypes
// Returns: { values: [{ id, name, subtask, iconUrl }], total, startAt, maxResults }

// Step 2: get fields for specific issue type
// GET /rest/api/2/issue/createmeta/{projectKey}/issuetypes/{issueTypeId}?maxResults=50
// Returns: { values: [{ fieldId, name, required, schema: { type, system?, custom? } }], total }
```

### Existing Assignee Search Pattern (copy from IssueDetailSidebar.tsx:127)
```typescript
// Source: /taskflow/src/routes/dashboard/IssueDetailSidebar.tsx line 127
const url = `${effectiveJiraBaseUrl.replace(/\/$/, '')}/rest/api/2/user/assignable/search?issueKey=${issueKey}&query=${encodeURIComponent(query)}`
// For create mode (no issueKey yet), use project-scoped assignable search:
// GET /rest/api/2/user/assignable/search?project={projectKey}&query={q}
```

### Fetch Epics for Epic Link Dropdown
```typescript
// Source: Jira DC REST API — standard JQL search for epics
const jql = `project = ${projectKey} AND issuetype = Epic AND statusCategory != Done ORDER BY updated DESC`
const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,status&maxResults=50`
// Returns JiraIssue[] — render as key + summary in select dropdown
```

### POST issueLink (after create)
```typescript
// Source: Atlassian DC REST API — verified
// POST /rest/api/2/issueLink
// Body: { type: { id: linkTypeId }, inwardIssue: { key }, outwardIssue: { key } }
// Response: 201 Created (empty body)
```

### TanStack Query mutation for createIssue
```typescript
// Source: existing useMutation pattern from IssueDetailSidebar.tsx
const createMutation = useMutation({
  mutationFn: async (formData: CreateFormData) => {
    const token = await readSecret('jira-pat').catch(() => null)
    if (!token || !jiraBaseUrl) throw new Error('No credentials')
    const issue = await createIssue(jiraBaseUrl, token, projectKey, formData.summary, {
      issuetype: formData.issueType,
      // ... other fields, filtered to only present fields
    })
    // Create issue links after successful issue create
    for (const link of formData.links) {
      await createIssueLink(jiraBaseUrl, token, link.typeId, issue.key, link.issueKey)
        .catch(() => {}) // log but don't fail
    }
    return issue
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] })
    queryClient.invalidateQueries({ queryKey: ['jira-issues', 'my-tasks'] })
    onClose()
  },
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat `GET /rest/api/2/issue/createmeta?expand=...` | Paginated `/issue/createmeta/{project}/issuetypes/{id}` | Jira 8.4 (2020), removed in 9.0 | Must support both; try new first, fallback to legacy |
| ADF JSON for description | Wiki markup string | DC has always used wiki markup; ADF is Cloud-only | Never send ADF to DC REST API |

**Deprecated/outdated:**
- Flat createmeta endpoint: removed in Jira 9.0, deprecated since 8.4. Still accessible on DC instances with a re-enable flag. Must have fallback.
- `accountId` for assignee field: Cloud-only. DC uses `{ name: username }`. Already correctly handled in existing codebase.

## Open Questions

1. **Account field component type on Orange instance**
   - What we know: `accountFieldKey` is stored in settings store (added in Phase 9-02); `discoverCustomFields()` already resolves it via `/rest/api/2/field`
   - What's unclear: The field's `schema.type` on the Orange instance — could be `option` (dropdown), `user`, or a custom select. The createmeta response will reveal the type and `allowedValues`.
   - Recommendation: In the create form, fetch createmeta and render Account field based on its schema type: if `allowedValues` present render as Select; if `type === 'user'` render as user search; fallback to text Input. The skeleton covers the loading state while this resolves.

2. **Assignable users search for project-scope (no issueKey in create mode)**
   - What we know: `GET /rest/api/2/user/assignable/search?issueKey=X` works for existing issues (used in IssueDetailSidebar)
   - What's unclear: Whether `?project={projectKey}` works equally well for the Orange instance
   - Recommendation: Use `?project={activeJiraProject}` in create mode. This is the documented Jira DC endpoint parameter for project-scoped assignable search.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 + @testing-library/react ^16.3.2 |
| Config file | `/taskflow/vitest.config.ts` |
| Quick run command | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` |
| Full suite command | `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CREATE-01 | createIssue() sends correct fields for Story/Subtask/Bug | unit (jira.ts) | `npx vitest run src/services/jira.test.ts` | ✅ (extend existing) |
| CREATE-01 | CreateEditIssueModal renders type switcher, updates visible fields on switch | unit (component) | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` | ❌ Wave 0 |
| CREATE-01 | Parent field visible for Subtask, hidden for Story; Epic link visible for Story, hidden for Subtask | unit (component) | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` | ❌ Wave 0 |
| CREATE-02 | fetchCreatemeta() returns required fields from new endpoint (mock 200) | unit (jira.ts) | `npx vitest run src/services/jira.test.ts` | ❌ Wave 0 |
| CREATE-02 | fetchCreatemeta() falls back to legacy endpoint on 404 | unit (jira.ts) | `npx vitest run src/services/jira.test.ts` | ❌ Wave 0 |
| CREATE-02 | Submit blocked when required custom field is empty; unblocked when filled | unit (component) | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` | ❌ Wave 0 |
| CREATE-03 | bulkUpdateIssue() sends correct PUT body | unit (jira.ts) | `npx vitest run src/services/jira.test.ts` | ❌ Wave 0 |
| CREATE-03 | Edit modal pre-fills fields from issue data | unit (component) | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` | ❌ Wave 0 |
| CREATE-04 | fetchIssueLinkTypes() returns array from /rest/api/2/issueLinkType | unit (jira.ts) | `npx vitest run src/services/jira.test.ts` | ❌ Wave 0 |
| CREATE-04 | createIssueLink() sends correct POST body | unit (jira.ts) | `npx vitest run src/services/jira.test.ts` | ❌ Wave 0 |
| CREATE-04 | Link rows render with type dropdown + search; multiple rows can be added | unit (component) | `npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/CreateEditIssueModal.test.tsx src/services/jira.test.ts`
- **Per wave merge:** `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/routes/dashboard/CreateEditIssueModal.test.tsx` — covers CREATE-01, CREATE-02, CREATE-03, CREATE-04 component behavior
- [ ] Extend `src/services/jira.test.ts` — covers fetchCreatemeta, bulkUpdateIssue, fetchIssueLinkTypes, createIssueLink

*(No new framework install needed — Vitest + @testing-library/react already present)*

## Sources

### Primary (HIGH confidence)
- Existing codebase: `/taskflow/src/services/jira.ts` — createIssue, updateIssueField, discoverCustomFields, apiFetch patterns
- Existing codebase: `/taskflow/src/routes/dashboard/IssueDetailSidebar.tsx` — assignee search URL pattern, useFieldMutation pattern
- Existing codebase: `/taskflow/src/components/ui/sheet.tsx` — @base-ui/react/dialog Dialog primitive API
- Existing codebase: `/taskflow/src/main.tsx` — AppLayout IssueDetailSheet placement pattern
- Existing codebase: `/taskflow/src/stores/settings.store.ts` — accountFieldKey reserved; all field keys available

### Secondary (MEDIUM confidence)
- [Jira DC createmeta alternative endpoints (8.4+)](https://community.atlassian.com/forums/Jira-questions/New-createmeta-REST-endpoint-solution-of-Jira-throws-404/qaq-p/1761393) — new endpoint format `/issue/createmeta/{project}/issuetypes/{id}`
- [Createmeta removal in Jira 9.0](https://confluence.atlassian.com/jiracore/createmeta-rest-endpoint-to-be-removed-975040986.html) — deprecation timeline
- [Atlassian DC issueLinkType endpoint](https://developer.atlassian.com/server/jira/platform/rest/v10005/api-group-issuelink/) — confirmed POST /rest/api/2/issueLink body shape
- [Atlassian: How to add issue links via REST API](https://support.atlassian.com/jira/kb/how-to-use-rest-api-to-add-issue-links-in-jira-issues/) — confirmed `type: { name }` or `{ id }` both work; 201 response

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, codebase patterns fully verified
- Architecture: HIGH — Dialog primitive confirmed present (@base-ui/react), patterns from existing components verified
- Pitfalls: HIGH — "field not on screen" and createmeta deprecation are documented Jira behaviors; DC wiki markup constraint is locked project knowledge
- API shapes: MEDIUM — createmeta new endpoint verified via community docs; could not test against live Orange instance

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable Jira DC API, stable dependency versions)
