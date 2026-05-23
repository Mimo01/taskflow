# Phase 64: Redo Worklogs Page with Hierarchy — Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 5 (2 modified, 3 new)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/routes/worklogs/WorklogsPage.tsx` | component (page) | CRUD + request-response | `taskflow/src/routes/worklogs/WorklogsPage.tsx` (self — large modification) | self |
| `taskflow/src/routes/worklogs/WorklogsPage.test.tsx` | test | — | `taskflow/src/routes/worklogs/WorklogsPage.test.tsx` (self — update) | self |
| `taskflow/src/routes/worklogs/WorklogCellPopover.tsx` | component | CRUD + request-response | `taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx` | exact-role |
| `taskflow/src/routes/worklogs/WorklogEntryRow.tsx` | component | request-response | `taskflow/src/routes/dashboard/IssueDetailPage.tsx` (worklog row section, lines 299–340) | role-match |
| `taskflow/src/routes/worklogs/EditWorklogForm.tsx` | component | CRUD | `taskflow/src/routes/dashboard/IssueDetailPage.tsx` (worklog edit form, lines 251–297) | exact-role |

---

## Pattern Assignments

### `taskflow/src/routes/worklogs/WorklogsPage.tsx` (modified — add hierarchy + outlet context + enrichment query)

**Primary analog:** self (large modification); secondary analogs: `BacklogPage.tsx` (outlet context), `jira.ts` (batch JQL)

---

#### Pattern 1: useOutletContext wiring (NEW — currently missing from WorklogsPage)

**Analog:** `taskflow/src/routes/dashboard/BacklogPage.tsx` lines 191–194

```typescript
// Add to WorklogsPage imports
import { useOutletContext } from 'react-router-dom';

// Inside component, before other hooks
const { onIssueClick } = useOutletContext<{
  onIssueClick: (key: string, resetTrail?: boolean) => void;
}>();
```

**Outlet context provider:** `taskflow/src/main.tsx` lines 544–552 — `Outlet context` already passes `onIssueClick: handleIssueClick`. WorklogsPage only needs to consume it; no change to `main.tsx` required (unlike what D-08 originally suggested — confirmed by RESEARCH.md Pattern 4).

---

#### Pattern 2: Dependent Jira enrichment query

**Analog:** `taskflow/src/services/jira.ts` lines 2242–2254 (batch `issuekey in (...)` JQL)

**Stable uniqueKeys useMemo** (must precede the enrichment useQuery):
```typescript
// Place BEFORE the enrichment useQuery — must be a stable useMemo to avoid re-firing
const uniqueKeys = useMemo(
  () => [...new Set((data ?? []).map((w) => w.issue.key))].sort(),
  [data],
);
const uniqueKeysStr = uniqueKeys.join(','); // stable string for queryKey
```

**Enrichment useQuery** (fires only when worklogs data is ready):
```typescript
// T-62-06: jiraToken MUST NOT appear in queryKey (same rule as existing worklogs query)
const { data: enrichData, isError: isEnrichError } = useQuery({
  queryKey: ['jira', 'worklog-enrich', jiraBaseUrl, uniqueKeysStr],
  queryFn: async () => {
    if (!uniqueKeys.length) return [];
    const base = jiraBaseUrl!.replace(/\/$/, '');
    const jql = encodeURIComponent(`issuekey in (${uniqueKeys.join(',')})`);
    const url = `${base}/rest/api/2/search?jql=${jql}&fields=summary,issuetype,parent&maxResults=${uniqueKeys.length}`;
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) throw new Error('No token');
    const response = await apiFetch(
      'jira',
      url,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
      'Enrich Worklog Issues',
    );
    if (!response.ok) throw new Error(`Enrichment failed: ${response.status}`);
    const d = await response.json();
    return d.issues as Array<{
      key: string;
      fields: {
        summary: string;
        issuetype: { name: string; subtask: boolean };
        parent?: { key: string; fields: { summary: string } };
      };
    }>;
  },
  enabled: !!jiraBaseUrl && !!jiraToken && !!data && uniqueKeys.length > 0,
  staleTime: 5 * 60 * 1000,
});
```

**apiFetch import** (already used in jira.ts — add to WorklogsPage if not present):
```typescript
import { apiFetch } from '@/lib/apiFetch';
```

---

#### Pattern 3: Hierarchy useMemo (replaces pivot useMemo)

**Analog:** self (lines 262–300 of current WorklogsPage) — same shape, different structure

The existing `pivot` useMemo (lines 262–300) is the direct model for structure. Replace the `pivotMap` loop with a nested epic → story → subtask map.

**Type definitions** (place before component or in a sibling types file):
```typescript
type DayMap = Map<string, number>; // YYYY-MM-DD -> seconds
type SubtaskNode = { summary: string; dayMap: DayMap; entries: TempoWorklog[] };
type StoryNode  = { summary: string; dayMap: DayMap; entries: TempoWorklog[]; subtasks: Map<string, SubtaskNode> };
type EpicNode   = { summary: string; dayMap: DayMap; entries: TempoWorklog[]; stories: Map<string, StoryNode> };
type HierarchyMap = Map<string, EpicNode>; // epicKey | '__NO_EPIC__'
```

**Key classification rule** (from RESEARCH.md Pattern 2 + jira.ts line 153 comment):
```typescript
// NEVER use issuetype.name === 'Epic' — admin can rename.
// Subtask: enriched.fields.issuetype.subtask === true
// Story:   issuetype.subtask === false AND fields.parent present
// Epic:    issuetype.subtask === false AND fields.parent absent
const NO_EPIC = '__NO_EPIC__';
const enrichMap = new Map((enrichData ?? []).map((i) => [i.key, i]));
```

---

#### Pattern 4: Existing keepable patterns in WorklogsPage

All of these are KEPT unchanged (copy them forward exactly):

**Auth token effect** (lines 186–192):
```typescript
useEffect(() => {
  if (jiraBaseUrl) {
    readSecret('jira-pat')
      .then((t) => setJiraToken(t))
      .catch(() => setJiraToken(null));
  }
}, [jiraBaseUrl]);
```

**Existing worklogs TanStack Query** (lines 224–241) — queryKey, enabled guard, T-62-06 comment:
```typescript
// T-62-06: jiraToken MUST NOT appear in queryKey
const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ['tempo', 'worklogs', jiraBaseUrl, from, to, selectedUsername ?? ''],
  queryFn: () =>
    fetchWorklogs(jiraBaseUrl!, jiraToken!, selectedUsername ? [selectedUsername] : [], from, to),
  enabled:
    !!jiraBaseUrl && !!jiraToken && tempoEnabled && !!from && !!to &&
    (preset !== 'custom' || (!!customFrom && !!customTo && customTo >= customFrom)),
});
```

**Day column background helper** (line 139–143): `dayColClass(type)` function — keep as-is.

**formatSeconds** (lines 41–48): keep as-is.

**Table wrapper div** (line 564): `<div className="flex-1 overflow-auto px-6 py-4">` — keep unchanged; this IS the scroll container for sticky to work (Pitfall 6 in RESEARCH.md).

---

### `taskflow/src/routes/worklogs/WorklogCellPopover.tsx` (new — cell drill-down)

**Analog:** `taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx` (whole file — 140 lines)

---

#### Imports pattern (from LogWorkPopover.tsx lines 1–18):
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { deleteWorklog, updateWorklog } from '@/services/jira/worklogs';
import { readSecret } from '@/services/stronghold';
import type { TempoWorklog } from '@/services/tempo/types';
```

---

#### Popover open/state pattern (from LogWorkPopover.tsx lines 32–38):
```typescript
const [open, setOpen] = useState(false);
// Note: WorklogCellPopover receives issueKey + date + entries as props;
// it does NOT manage its own open state for the trigger — the cell <td> is the trigger.
```

---

#### Core popover structure (from LogWorkPopover.tsx lines 83–138; adapted):
```typescript
// Non-zero cell: wrap in Popover
<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
  <PopoverTrigger asChild>
    <button
      type="button"
      className="w-full text-right cursor-pointer hover:bg-accent/60"
      aria-label={`View worklogs for ${issueKey} on ${date}`}
    >
      {formatSeconds(secs)}
    </button>
  </PopoverTrigger>
  <PopoverContent className="w-72 p-4">
    {/* Header */}
    <p className="text-xs font-semibold mb-2">{issueKey} · {formatDayHeader(date)}</p>
    {/* Entry list */}
    <div className="max-h-48 overflow-y-auto space-y-1">
      {entries.map((entry) => (
        <WorklogEntryRow
          key={entry.jiraWorklogId ?? entry.tempoWorklogId}
          entry={entry}
          issueKey={issueKey}
          jiraBaseUrl={jiraBaseUrl}
          onMutationSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['tempo', 'worklogs'] });
          }}
        />
      ))}
    </div>
    {/* Separator + Add entry */}
    <div className="border-t border-border mt-2 pt-2">
      <LogWorkPopover
        issueKey={issueKey}
        jiraBaseUrl={jiraBaseUrl}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['tempo', 'worklogs'] });
        }}
      />
    </div>
  </PopoverContent>
</Popover>
```

**Nested Radix Popover warning** (RESEARCH.md Pitfall 4): `LogWorkPopover` wraps itself in a `<Popover>`. Nesting a Radix Popover inside WorklogCellPopover's `PopoverContent` works if `LogWorkPopover` is NOT triggered by focus/dismiss events that conflict. If click-away on `LogWorkPopover`'s `PopoverContent` closes `WorklogCellPopover`, extract `LogWorkPopover`'s form fields inline instead (using `DurationInput`, `Input`, `Textarea` directly — see `LogWorkPopover.tsx` lines 96–134 for the form body).

---

#### Cache invalidation pattern (from IssueDetailPage.tsx lines 287–296):
```typescript
// Broad prefix invalidation catches all username/date suffix variations
queryClient.invalidateQueries({ queryKey: ['tempo', 'worklogs'] });
```

---

### `taskflow/src/routes/worklogs/WorklogEntryRow.tsx` (new — one row per Tempo worklog entry)

**Analog:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx` worklog row section (lines 299–340 for handlers; inline JSX pattern from worklog section)

---

#### Props interface:
```typescript
interface WorklogEntryRowProps {
  entry: TempoWorklog;
  issueKey: string;
  jiraBaseUrl: string;
  onMutationSuccess: () => void;
}
```

---

#### Delete mutation pattern (from IssueDetailPage.tsx lines 287–296):
```typescript
const queryClient = useQueryClient();

const deleteMutation = useMutation({
  mutationFn: async () => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) throw new Error('No token');
    const worklogId = entry.jiraWorklogId?.toString() ?? entry.tempoWorklogId?.toString();
    if (!worklogId) throw new Error('No worklog ID');
    return deleteWorklog(jiraBaseUrl, token, issueKey, worklogId);
  },
  onSuccess: () => {
    onMutationSuccess();
  },
});
```

---

#### Row JSX layout (UI-SPEC §WorklogEntryRow Layout):
```typescript
// When NOT in edit mode:
<div className="flex items-center gap-2 text-xs">
  <span className="font-semibold">{formatSeconds(entry.timeSpentSeconds)}</span>
  <span className="text-muted-foreground">{entry.author.displayName ?? entry.author.name}</span>
  {entry.comment && (
    <span className="text-muted-foreground truncate max-w-[100px]">{entry.comment}</span>
  )}
  <div className="ml-auto flex items-center gap-1">
    <button
      type="button"
      aria-label="Edit worklog entry"
      onClick={() => setEditing(true)}
      className="text-muted-foreground hover:text-foreground"
    >
      <Pencil className="size-3.5" />
    </button>
    <button
      type="button"
      aria-label="Delete worklog entry"
      onClick={() => deleteMutation.mutate()}
      disabled={deleteMutation.isPending}
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="size-3.5" />
    </button>
  </div>
</div>
// When in edit mode: render <EditWorklogForm> in place
```

---

### `taskflow/src/routes/worklogs/EditWorklogForm.tsx` (new — inline edit form)

**Analog:** `taskflow/src/routes/dashboard/IssueDetailPage.tsx` lines 251–297 (worklogEditMutation) + `taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx` lines 66–136 (form structure)

---

#### Imports pattern (from IssueDetailPage.tsx lines 12–25 + LogWorkPopover.tsx lines 7–18):
```typescript
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseDuration } from '@/services/jira/duration';
import { updateWorklog } from '@/services/jira/worklogs';
import { readSecret } from '@/services/stronghold';
import type { TempoWorklog } from '@/services/tempo/types';
import { DurationInput } from '@/routes/dashboard/issue-detail/DurationInput';
```

---

#### Edit mutation pattern (from IssueDetailPage.tsx lines 256–285):
```typescript
const editMutation = useMutation({
  mutationFn: async ({
    timeSpentSeconds,
    started,
    comment,
  }: { timeSpentSeconds: number; started: string; comment?: string }) => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) throw new Error('No token');
    const worklogId = entry.jiraWorklogId?.toString() ?? entry.tempoWorklogId?.toString();
    if (!worklogId) throw new Error('No worklog ID');
    return updateWorklog(jiraBaseUrl, token, issueKey, worklogId, { timeSpentSeconds, started, comment });
  },
  onSuccess: () => {
    onSuccess();
  },
  onError: (err: Error) => setError(err.message),
});
```

---

#### Started date formatting (from LogWorkPopover.tsx line 75 — critical):
```typescript
// Jira worklog API requires "+0000" not "Z" suffix
const started = new Date(`${date}T12:00:00`).toISOString().replace('Z', '+0000');
```

---

#### Form JSX pattern (from LogWorkPopover.tsx lines 96–136):
```typescript
<div className="space-y-2 text-xs">
  <div>
    <Label className="text-xs mb-1">Time Spent</Label>
    <DurationInput value={duration} onChange={setDuration} error={durationError} />
  </div>
  <div>
    <Label className="text-xs mb-1">Date</Label>
    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-xs" />
  </div>
  <div>
    <Label className="text-xs mb-1">Comment</Label>
    <Textarea
      value={comment}
      onChange={(e) => setComment(e.target.value)}
      className="min-h-[48px] text-xs resize-none"
    />
  </div>
  <div className="flex gap-2">
    <Button
      size="sm"
      onClick={handleSubmit}
      disabled={editMutation.isPending}
    >
      {editMutation.isPending ? 'Saving…' : 'Save Changes'}
    </Button>
    <Button size="sm" variant="ghost" onClick={onDiscard}>
      Discard Changes
    </Button>
  </div>
  {error && <p className="text-xs text-destructive">{error}</p>}
</div>
```

---

### `taskflow/src/routes/worklogs/WorklogsPage.test.tsx` (modified — update for hierarchy)

**Analog:** self (current test file, all 670 lines)

---

#### New mock additions needed (RESEARCH.md §Wave 0 Gaps):
```typescript
// 1. Mock useOutletContext (NEW — WorklogsPage now uses it)
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useOutletContext: vi.fn(() => ({
      onIssueClick: mockOnIssueClick,
    })),
  };
});
let mockOnIssueClick = vi.fn();

// 2. Mock apiFetch for enrichment query
vi.mock('@/lib/apiFetch', () => ({
  apiFetch: vi.fn().mockImplementation((_source, url: string) => {
    if (url.includes('/rest/api/2/search')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ issues: mockEnrichResult }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }),
}));
let mockEnrichResult: unknown[] = [];

// 3. Mock jira/worklogs mutations
vi.mock('@/services/jira/worklogs', () => ({
  deleteWorklog: vi.fn().mockResolvedValue(undefined),
  updateWorklog: vi.fn().mockResolvedValue(undefined),
  createWorklog: vi.fn().mockResolvedValue(undefined),
}));
```

#### Updated makeWorklog factory (needs real issueKey variety):
```typescript
// Phase 64: extend to support distinct issue keys for hierarchy tests
function makeWorklog(
  authorName: string,
  displayName: string,
  date: string,
  hours: number,
  issueKey = 'X-1',
): TempoWorklog {
  return {
    issue: { key: issueKey },
    author: { name: authorName, displayName },
    timeSpentSeconds: hours * 3600,
    dateStarted: date,
    jiraWorklogId: Math.floor(Math.random() * 10000),
  };
}
```

#### Existing tests to KEEP (filter bar is unchanged):
- TEMPO-01 rows-per-author tests: **DELETE** (pivot table replaced)
- TEMPO-02 date preset tests: **KEEP** unchanged
- TEMPO-03 people filter tests: **KEEP** unchanged
- TEMPO-04 save filter tests: **KEEP** unchanged
- TEMPO-05 load/rename/delete tests: **KEEP** unchanged
- TEMPO-07 totals tests: **UPDATE** to match new hierarchy row structure
- D-08 zero-hour blank tests: **KEEP** (rule unchanged)

---

## Shared Patterns

### Auth Token (readSecret)
**Source:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` lines 186–192
**Apply to:** WorklogCellPopover.tsx, WorklogEntryRow.tsx, EditWorklogForm.tsx (all mutations need token)
```typescript
const token = await readSecret('jira-pat').catch(() => null);
if (!token) throw new Error('No token');
```

### Cache Invalidation — Broad Prefix
**Source:** RESEARCH.md Pattern 3; verified against WorklogsPage.tsx line 225 queryKey
**Apply to:** WorklogCellPopover.tsx, WorklogEntryRow.tsx, EditWorklogForm.tsx (all mutation onSuccess)
```typescript
// Prefix match catches ['tempo', 'worklogs', jiraBaseUrl, from, to, username] regardless of suffix
queryClient.invalidateQueries({ queryKey: ['tempo', 'worklogs'] });
```

### Sticky Cell CSS
**Source:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` (table structure, lines 569–662); UI-SPEC §Layout Contracts
**Apply to:** HierarchyTable within WorklogsPage.tsx
```typescript
// Corner (Issue column header): top-0, left-0, z-30
"sticky top-0 left-0 z-30 bg-background text-left px-4 py-3 border border-border min-w-48 font-semibold text-muted-foreground"
// Date header cells: top-0, z-20
"sticky top-0 z-20 bg-background text-right px-4 py-3 border border-border min-w-14 font-semibold text-muted-foreground"
// First column data cells: left-0, z-10
"sticky left-0 z-10 bg-background px-4 py-3 border border-border"
// CRITICAL: bg-background on ALL sticky cells — prevents scrolled content bleed-through
```

### Error + Empty States
**Source:** `taskflow/src/routes/worklogs/WorklogsPage.tsx` lines 565–612
**Apply to:** WorklogsPage.tsx (keep existing ErrorState/EmptyState; add inline Alert for enrichment error)
```typescript
// Jira enrichment error (non-blocking — show inline below filter bar):
// <Alert variant="default">Some issues could not be loaded. Hours are still shown.</Alert>
import { Alert, AlertDescription } from '@/components/ui/alert';
```

### Row Hierarchy Visual
**Source:** UI-SPEC §Row Hierarchy Visual Contract
**Apply to:** HierarchyTable section of WorklogsPage.tsx
```typescript
// Epic row <tr>: hover:bg-accent/50; sticky <td>: bg-muted/40 font-semibold
// Story row <tr>: hover:bg-accent/50; label inside <td>: pl-4
// Subtask row <tr>: hover:bg-accent/50; label inside <td>: pl-8 text-muted-foreground
// "No Epic" group <tr>: NO cursor-pointer; label: font-semibold text-muted-foreground italic
```

### Issue Type Icons
**Source:** UI-SPEC §Row Hierarchy Visual Contract
**Apply to:** sticky name `<td>` in HierarchyTable rows
```typescript
import { BookOpen, GitBranch, Layers } from 'lucide-react';
// Epic:    <Layers className="inline size-3 text-purple-500 mr-1" />
// Story:   <BookOpen className="inline size-3 text-blue-500 mr-1" />
// Subtask: <GitBranch className="inline size-3 text-muted-foreground mr-1" />
```

### Unresolvable Issue Key Display
**Source:** UI-SPEC §Typography; CONTEXT.md D-07
**Apply to:** HierarchyTable name cells where enrichMap has no entry for a key
```typescript
// Render key verbatim, hours still counted, visually flagged
<span className="text-xs text-muted-foreground line-through">{issueKey}</span>
```

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `taskflow/src/routes/worklogs/`, `taskflow/src/routes/dashboard/`, `taskflow/src/routes/dashboard/issue-detail/`, `taskflow/src/services/jira/`, `taskflow/src/services/tempo/`, `taskflow/src/main.tsx`
**Files read:** 12 source files + 3 planning docs
**Pattern extraction date:** 2026-05-22
