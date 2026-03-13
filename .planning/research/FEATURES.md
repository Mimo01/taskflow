# Feature Research — v1.2 Jira Parity

**Domain:** Developer/PM tool — Jira issue management parity (Tauri 2 desktop, on-premise Jira DC v10.3.15)
**Researched:** 2026-03-13
**Confidence:** MEDIUM-HIGH (Jira API behavior HIGH from codebase knowledge; UX patterns MEDIUM via WebSearch and official Atlassian docs)

> This file supersedes the v1.1 FEATURES.md for v1.2 planning.
> v1.0 and v1.1 features are shipped and stable. This file focuses exclusively on the five v1.2 feature areas.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that users assume exist in any Jira-like issue management surface. Missing these = product feels like a broken subset of Jira, not a replacement.

#### 1. Issue Detail View

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Summary (title) | Every issue has one; first thing users look at | LOW | Already fetched in existing `JiraIssue.fields.summary` |
| Status with transition control | Users expect to change status in-place | LOW | Already built: `StatusPopover` + `postTransition` — reuse directly |
| Assignee display + change | Core action: re-assign without opening Jira | MEDIUM | Need `PUT /rest/api/2/issue/{key}` with `{ fields: { assignee: { name } } }`; user list from `/rest/api/2/user/assignable/search` |
| Story points display + edit | Teams live by points; expected to edit inline | MEDIUM | `discoverStoryPointsField()` already resolves field ID; PUT to update |
| Issue type badge | Distinguishes stories from subtasks from bugs | LOW | Already in `JiraIssue.fields.issuetype` |
| Description (rich text rendered) | Core information field | MEDIUM | Jira DC returns wiki markup strings (not ADF); `expand=renderedFields` returns HTML; render safely with sanitized innerHTML or convert to markdown |
| Comments list (read) | Teams track decisions in comments | LOW | `fetchComments` already built; just needs display component |
| Add comment | Users expect to reply to discussion | LOW | `postComment` already built; needs text input + submit |
| Subtasks list with status | Seeing child work at a glance | LOW | `JiraIssue.fields.subtasks` already fetched; display only |
| Priority display | Expected field on every issue | LOW | Not currently fetched; add `priority` to fields param |
| Reporter display | Accountability/audit trail | LOW | Not currently fetched; add `reporter` to fields param |
| Epic link display | Where does this story belong | MEDIUM | Epic is a custom field (`customfield_10014` commonly); need to discover via `/rest/api/2/field` |
| Linked issues (read) | Cross-reference between tickets | MEDIUM | `issuelinks` field available from Jira API; not currently fetched; display only for table stakes |
| Labels display | Tags/categorization | LOW | `labels` field in Jira API; not currently fetched |
| Fix version display | Release targeting | LOW | Already have `JiraFixVersion`; add `fixVersions` to fields |
| Open-in-Jira link | Escape hatch to full Jira | LOW | Construct `{baseUrl}/browse/{key}` — always include |

#### 2. Backlog View

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| List of unstarted stories/subtasks | Core purpose of a backlog view | MEDIUM | JQL: `project = X AND sprint not in openSprints() AND resolution = Unresolved AND issuetype not in subtaskIssueTypes()` |
| Issue type, summary, assignee, story points visible in row | Expected scan-ability | LOW | Same fields as sprint board rows |
| Move issue to current sprint | Core grooming action | MEDIUM | `PUT /rest/api/2/issue/{key}` with sprint custom field, or `POST /rest/agile/1.0/sprint/{sprintId}/issue` — need to verify which endpoint DC supports |
| Filter by epic | Common grooming pattern — focus one epic at a time | MEDIUM | Client-side filter on epic link field value |
| Filter by label | Secondary grouping | LOW | Client-side filter |
| Filter by assignee | Who owns unassigned work | LOW | Client-side filter |
| Create new story in backlog | Grooming includes adding new items | HIGH | Requires create issue form (see section 4) |
| Story count / point total | At-a-glance backlog size | LOW | Derived from data already fetched |

#### 3. Epic Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Epic list with name, color, and story count | Teams navigate work by epic | MEDIUM | JQL: `project = X AND issuetype = Epic`; epic color in `customfield_10010` or `color` field — varies by DC version |
| Filter sprint board by epic | Most common epic use case | MEDIUM | Client-side filter using epic link on each issue |
| Filter backlog by epic | Same — common grooming pattern | LOW | Client-side, same mechanism |
| Epic detail page: stories list | See all work belonging to an epic | MEDIUM | JQL: `"Epic Link" = {epicKey}` or `issueFunction in subtasksOf("key = {epicKey}")` depending on DC version |
| Create epic | Full parity requires being able to add epics | HIGH | Requires create form with Epic issue type; depends on create/edit form |

#### 4. Create/Edit Issue Form

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Summary field | Required; every issue needs a title | LOW | Text input, required validation |
| Issue type selector | Story vs subtask vs bug etc | MEDIUM | Fetch issue types from `/rest/api/2/issuetype` filtered to project |
| Assignee selector | Who does the work | MEDIUM | Typeahead from `/rest/api/2/user/assignable/search?project=X` |
| Story points | Teams estimate in points | MEDIUM | Same discovered field key as display; number input |
| Description (plain text or simple markdown) | Details behind the summary | MEDIUM | Jira DC wiki markup for write; plain textarea acceptable — users can format in Jira if needed |
| Epic link | Which epic does this belong to | MEDIUM | Fetch epics list; select from dropdown |
| Priority | Urgency signal | LOW | Static list: Highest/High/Medium/Low/Lowest |
| Fix version | Release target | LOW | Reuse `fetchFixVersions`; select from existing versions |
| Labels | Tagging | LOW | Comma-separated free-text or typeahead |
| Parent (for subtasks) | Subtask requires parent | MEDIUM | Only shown when issuetype.subtask = true; story key picker |
| Account (custom field) | Mentioned in PROJECT.md as required for this team | MEDIUM | Custom field — discover via createmeta endpoint; text or select depending on field type |
| Issue links (add) | Link this to blocks/is-blocked-by/relates-to | HIGH | `POST /rest/api/2/issue/{key}/remotelink` or issuelinks body; need link types from `/rest/api/2/issueLinkType` |

#### 5. Sprint Board (Subtask-as-Card Redesign)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Subtask cards as first-class board items | v1.2 target: replace subtask collapse with card expansion | HIGH | Each subtask is a kanban card; parent story shown as a non-movable header/lane separator above its subtasks |
| All team members visible (not just "my tasks") | PM and team leads need full board | LOW | Already built in SprintBoardTab with `assignedToMe = false`; this is a board view preference |
| Drag-to-move status transitions | Core kanban interaction | HIGH | dnd-kit (@dnd-kit/core + @dnd-kit/sortable) is recommended for React; triggers `postTransition` on drop |
| Inline issue detail (click card → side panel) | Expected: click for detail without leaving board | MEDIUM | Slide-in panel or modal showing IssueDetail component; already have global search detail panel as pattern |
| Story header shows aggregate status | Parent visibility: how many subtasks are done | LOW | Derived: count done/total from subtask array |
| Assignee filter | Focus on one developer | LOW | Client-side filter on assignee |

---

### Differentiators (Competitive Advantage)

Features that go beyond what Jira offers out of the box for this team's context, or that Taskflow can do better/faster.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Inline status transitions on issue detail | Change status without a dedicated status page, with optimistic update | LOW | Reuse existing `StatusPopover`; already battle-tested |
| MR health badge on issue detail | See linked MR status directly on the issue — no GitLab context switch | MEDIUM | MR linking via `linkEngine.ts` already works; surface MR health inside detail view |
| Instant keyboard shortcut to open issue detail | `Ctrl+K` → type ticket key → open detail. Faster than Jira search | LOW | Hook into existing global search store |
| Sprint board "focus mode": single developer swimlane | One-click to filter board to current user's subtasks only | LOW | Client-side filter; high value for standups |
| Backlog → Sprint move with instant optimistic feedback | No page reload; card visually moves to sprint list | MEDIUM | Optimistic update pattern already established in codebase |
| Comments show linked MR when comment contains MR URL | Contextually link comment thread to the MR | HIGH | Parse comment text for GitLab MR URLs; complexity probably not worth it in v1.2 |
| Create issue pre-populated from sprint context | Opening create form from sprint board defaults assignee and sprint | LOW | Pass context props to create form |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that look like good scope for v1.2 but add complexity disproportionate to value, or create maintenance debt.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full Atlassian Document Format (ADF) rich text editor for description write | Jira uses ADF; match exactly | ADF is a complex JSON node format; building or embedding a full ADF editor (like Atlaskit Editor) would be 50k+ lines of editor framework in the bundle. Jira Server returns wiki markup strings, not ADF, further muddying the waters. | Plain textarea for write; use `expand=renderedFields` for read display; link to Jira for complex formatting. Covers 90% of real use. |
| Drag-and-drop backlog reordering (priority rank) | Grooming = reordering | Jira's rank field (`customfield_10019`) is controlled by Jira's internal ranking service (`/rest/agile/1.0/issue/rank`); the API exists but rank changes can silently fail on DC configurations without the ranking plugin enabled. Also adds significant UI complexity for low actual use. | Move-to-sprint button is the high-value grooming action. Skip rank-drag for v1.2. |
| Attachment upload on create/edit | Looks like full parity | Tauri portable build file access requires `tauri-plugin-fs` and multipart form POST; testing on all three platforms adds QA surface. LOW actual use — most Jira attachments are screenshots, added via Jira directly. | Deep-link to Jira issue for attachment needs; out of scope per PROJECT.md |
| Real-time board updates (websocket/polling under 30s) | "Live" board feels modern | Jira DC has no webhook push for issue updates; polling under 30s hammers on-prem server; sprint boards for a small team change rarely. The existing 60s poll cadence is sufficient. | Keep existing 60s poll; show last-refreshed timestamp; manual refresh button |
| Subtask drag between parent stories (re-parent) | Seems natural on a board | Re-parenting a subtask in Jira DC requires changing the `parent` field via issue update AND moving it off the current parent's subtask list — complex transactional update that can leave data inconsistent on failure; Jira's own UI warns on this action. | Status transition drag (column to column) only; re-parenting done in Jira directly |
| Epic Gantt/roadmap timeline view | Roadmaps look professional | Requires date fields (start date) that Jira DC does not reliably populate for stories; rendering a timeline correctly requires significant layout work for marginal value to this team. PROJECT.md explicitly excludes analytics/historical views. | Epic list view (stories under epic) is sufficient; provides the "what's in each epic" visibility without timeline complexity |
| Bulk issue edit | Power feature; "while I'm here" | High API complexity (batch update + rollback on partial failure), high UI complexity (multi-select, field merge conflicts), rarely needed by small teams | Move-to-sprint is the only bulk action worth the cost; others deferred |
| Issue history/activity log | Full Jira parity | Requires `/rest/api/2/issue/{key}/changelog` which is a separate paginated endpoint; renders as a long wall of audit events that developers rarely read; adds significant rendering complexity | Comments tab covers the human decision trail; changelog available via Jira deep-link |
| Configurable board columns (workflow editor) | "Make it fit our workflow" | Workflow configuration in Jira DC is admin-level; Taskflow reads transitions from the API already and renders them dynamically — that IS the workflow. Adding an editor duplicates Jira admin. | Transitions already fetched dynamically from Jira; board columns = unique statuses in sprint — no config needed |
| @mention autocomplete in comment editor | Full Jira comment parity | Requires user search on every keystroke (`/rest/api/2/user/search?query=`), complex DOM positioning for the mention dropdown, and Jira's mention rendering is Jira-side anyway. | Plain text comment with @username works; Jira renders it correctly when posted |

---

## Feature Dependencies

```
Issue Detail View (read)
    └──reuses──> StatusPopover (status transitions) [ALREADY BUILT]
    └──reuses──> postComment / fetchComments [ALREADY BUILT]
    └──reuses──> discoverStoryPointsField [ALREADY BUILT]
    └──requires──> priority, reporter, epic link, labels added to JiraIssue fields

Sprint Board Redesign (subtask-as-card)
    └──requires──> Issue Detail View (inline panel on card click)
    └──requires──> dnd-kit library added to project
    └──reuses──> StatusPopover via drag-drop → postTransition [ALREADY BUILT]
    └──reuses──> fetchSprintIssues two-query strategy [ALREADY BUILT]

Backlog View
    └──requires──> Issue Detail View (click row → detail panel)
    └──requires──> Create/Edit Form (create story in backlog)
    └──requires──> fetchActiveSprint (to know which sprint to move issues into) [ALREADY BUILT]
    └──requires──> new API call: move issue to sprint

Epic Management
    └──requires──> Issue Detail View (epic detail page shows stories as rows)
    └──requires──> Create/Edit Form (create epic action)
    └──requires──> epic link field discovery (custom field ID varies by DC instance)

Create/Edit Issue Form
    └──requires──> fetchFixVersions [ALREADY BUILT]
    └──requires──> discoverStoryPointsField [ALREADY BUILT]
    └──requires──> new API: list assignable users (GET /rest/api/2/user/assignable/search)
    └──requires──> new API: list issue types (GET /rest/api/2/issuetype)
    └──requires──> new API: list epics (JQL query filtered to Epic issuetype)
    └──requires──> new API: PUT /rest/api/2/issue/{key} (edit existing)
    └──requires──> new API: POST /rest/api/2/issue (create new)
    └──requires──> new API: GET /rest/api/2/createmeta (discover required fields + account custom field)
```

### Dependency Notes

- **Sprint Board Redesign requires Issue Detail View:** Cards should open a detail panel inline; building the board without detail view means dead-end clicks.
- **Backlog View requires Create/Edit Form:** The "create story in backlog" action is a primary grooming operation; the backlog is low value without it.
- **Epic Management requires Create/Edit Form:** Epic creation reuses the same form with `issuetype = Epic`; building epic management before the form means read-only epics only.
- **Create/Edit Form is the deepest dependency:** Build this early (or in parallel with Issue Detail); everything else benefits from it.
- **Account custom field:** PROJECT.md lists it as a required field for this team. Discover via `/rest/api/2/createmeta?projectKeys=X&issuetypeNames=Story&expand=projects.issuetypes.fields` before assuming field ID.
- **Epic link field:** On Jira DC, epic link is typically `customfield_10014` but is not guaranteed. Discover via field metadata same as story points.

---

## MVP Definition (for v1.2 Phases)

### Phase 1 — Foundation: Issue Detail View (Read + Edit Core Fields)

Highest return: every other v1.2 feature links to issue detail. Delivers immediate value (no more opening Jira just to read a description).

- [ ] Fetch full issue fields: description (`expand=renderedFields`), priority, reporter, labels, fix versions, epic link, linked issues
- [ ] Render description as sanitized HTML (from `renderedFields.description`)
- [ ] Display comments list (reuse `fetchComments`)
- [ ] Add comment (reuse `postComment`)
- [ ] Display subtasks list with status badges
- [ ] Edit assignee inline (PUT field update)
- [ ] Edit story points inline
- [ ] Status transition (reuse `StatusPopover`)
- [ ] Open-in-Jira deep-link button

### Phase 2 — Sprint Board Redesign (Subtask-as-Card + Drag-to-Move)

High developer value. Transforms the board from a dashboard into an actual working surface.

- [ ] Add dnd-kit to project
- [ ] Render subtasks as individual draggable cards grouped under story-header rows
- [ ] Drag card to new column → `postTransition` (optimistic update + rollback)
- [ ] Click card → Issue Detail View in slide-in panel
- [ ] Assignee filter (client-side)

### Phase 3 — Create/Edit Issue Form

Foundation for backlog grooming and epic management. Build before those phases.

- [ ] Fetch issue types, assignable users, epics, fix versions, createmeta
- [ ] Form: summary (required), issue type, assignee, story points, description, priority, epic link, fix version, labels, parent (for subtasks), account custom field
- [ ] POST /rest/api/2/issue for create
- [ ] PUT /rest/api/2/issue/{key} for edit (reuse form, pre-populate fields)
- [ ] Accessible from: board card (edit), issue detail (edit button), backlog (create)

### Phase 4 — Backlog View

- [ ] List unstarted stories with row fields (type, key, summary, assignee, points, epic)
- [ ] Move to sprint (call sprint issue endpoint)
- [ ] Filters: epic, label, assignee (client-side)
- [ ] Create story in backlog (opens Create form, adds to backlog by not assigning sprint)
- [ ] Point total / issue count summary

### Phase 5 — Epic Management

- [ ] Epic list: name, color, story count, point total
- [ ] Filter sprint board by epic
- [ ] Filter backlog by epic
- [ ] Epic detail: stories list (read; links to Issue Detail)
- [ ] Create epic (reuse Create form with Epic issuetype)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Issue detail view (read) | HIGH | MEDIUM | P1 |
| Inline field edit (assignee, points, status) | HIGH | LOW (reuses existing) | P1 |
| Comment add/view | HIGH | LOW (reuses existing) | P1 |
| Sprint board subtask-as-card layout | HIGH | HIGH (dnd-kit, redesign) | P1 |
| Drag-to-move status transition | HIGH | MEDIUM | P1 |
| Create/edit issue form | HIGH | HIGH (many fields, APIs) | P1 |
| Backlog view (list + move to sprint) | HIGH | MEDIUM | P1 |
| Epic list + filter | MEDIUM | MEDIUM | P2 |
| Epic detail page | MEDIUM | LOW (reuses issue list) | P2 |
| Create epic | MEDIUM | LOW (reuses create form) | P2 |
| Inline issue detail panel on board | MEDIUM | LOW (reuses detail view) | P2 |
| Open-in-Jira deep-link | HIGH | LOW | P1 |
| MR health badge on issue detail | MEDIUM | MEDIUM | P2 |
| ADF rich text editor for write | LOW | VERY HIGH | P3 — anti-feature, defer/skip |
| Epic timeline/Gantt | LOW | HIGH | P3 — anti-feature, defer/skip |
| Bulk edit | LOW | HIGH | P3 — anti-feature, defer/skip |
| Issue history/changelog | LOW | MEDIUM | P3 — defer/skip |

**Priority key:**
- P1: Must have for v1.2 — these are the stated goals in PROJECT.md
- P2: Should have, adds meaningful value with reasonable cost
- P3: Nice to have, defer to v1.3+ or explicitly cut

---

## Jira API Surface Required (New for v1.2)

All APIs are Jira REST API v2 (Data Center). This section flags new API calls not currently implemented in `jira.ts`.

| API Call | Endpoint | Used For | Notes |
|----------|----------|----------|-------|
| Fetch single issue (full fields) | `GET /rest/api/2/issue/{key}?expand=renderedFields&fields=...` | Issue Detail | Need priority, reporter, labels, fixVersions, issuelinks, epic link added to fields |
| Update issue fields | `PUT /rest/api/2/issue/{key}` | Inline edit, Edit form | Body: `{ fields: { ... } }` |
| Create issue | `POST /rest/api/2/issue` | Create form | Body: `{ fields: { project, issuetype, summary, ... } }` |
| Fetch assignable users | `GET /rest/api/2/user/assignable/search?project={key}&maxResults=50` | Assignee dropdown | Returns `name` field (DC uses `name`, not `accountId`) |
| Fetch issue types | `GET /rest/api/2/issuetype` | Issue type selector | Filter client-side to relevant types for project |
| Fetch create metadata | `GET /rest/api/2/issue/createmeta?projectKeys={key}&expand=projects.issuetypes.fields` | Discover required/custom fields | Used once per session to find account field ID, epic link field ID |
| Fetch backlog issues | `GET /rest/api/2/search?jql=...` | Backlog view | JQL: `project=X AND sprint not in openSprints() AND resolution=Unresolved AND issuetype not in subtaskIssueTypes()` |
| Fetch epics | `GET /rest/api/2/search?jql=project=X AND issuetype=Epic` | Epic list, epic picker | Filter on issuetype name "Epic" |
| Move issue to sprint | `POST /rest/agile/1.0/sprint/{sprintId}/issue` | Backlog → sprint | Body: `{ issues: [key] }`; verify DC endpoint availability |
| Fetch issue link types | `GET /rest/api/2/issueLinkType` | Linked issues display/create | For "blocks", "is blocked by", "relates to" labels |

---

## Sources

- Atlassian Jira Software Data Center documentation: issue view configuration — https://confluence.atlassian.com/jirasoftwareserver/configuring-the-issue-view-938845334.html
- Atlassian Jira REST API v2 create issue examples — https://developer.atlassian.com/server/jira/platform/jira-rest-api-example-create-issue-7897248/
- Atlassian Jira REST API create metadata — https://developer.atlassian.com/server/jira/platform/jira-rest-api-example-discovering-meta-data-for-creating-issues-6291669/
- Atlassian Data Center REST API reference — https://developer.atlassian.com/server/jira/platform/rest/v10000/api-group-issue/
- ONES blog on showing subtasks on Jira Kanban board — https://ones.com/blog/show-subtasks-jira-kanban-board/
- Atlassian community: Display Sub-Tasks on Scrum Board — https://community.atlassian.com/forums/Jira-questions/Display-Sub-Tasks-on-Scrum-Board/qaq-p/2808156
- Atlassian Jira backlog grooming documentation (DC 10.3) — https://confluence.atlassian.com/jirasoftwareserver103/grooming-your-backlog-1489805148.html
- Atlassian ADF documentation — https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/
- Medium: Jira vs Linear vs GitHub Issues 2025 — https://medium.com/@samurai.stateless.coder/jira-vs-linear-vs-github-issues-best-tool-for-web-dev-teams-2025-d808740317e6
- dnd-kit documentation — https://dndkit.com/
- LogRocket: Build kanban board with dnd-kit and React — https://blog.logrocket.com/build-kanban-board-dnd-kit-react/
- Taskflow PROJECT.md (codebase) — `.planning/PROJECT.md`
- Taskflow jira.ts service (codebase inspection) — `taskflow/src/services/jira.ts`

---
*Feature research for: v1.2 Jira Parity — Taskflow desktop app*
*Researched: 2026-03-13*
