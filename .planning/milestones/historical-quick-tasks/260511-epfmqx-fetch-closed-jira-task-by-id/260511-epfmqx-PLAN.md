---
phase: quick-260511-epfmqx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira/issues.ts
  - taskflow/src/services/jira/issues.test.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/components/app/CommandPalette.tsx
  - taskflow/src/components/app/CommandPalette.test.tsx
autonomous: true
requirements: [QUICK-260511-EPFMQX]

must_haves:
  truths:
    - "Typing 'PROJ-123' in CommandPalette auto-fetches that issue without any button click"
    - "The fetched issue appears in a 'Direct Match' group above other result groups"
    - "If the key does not exist or the API returns an error, nothing is shown (no error state)"
    - "Open and closed issues are both returned (no status filter)"
    - "Typing a non-key query (e.g. 'fix login') does not trigger the key fetch"
  artifacts:
    - path: "taskflow/src/services/jira/issues.ts"
      provides: "fetchJiraIssueByKey function"
      contains: "fetchJiraIssueByKey"
    - path: "taskflow/src/services/jira.ts"
      provides: "barrel re-export of fetchJiraIssueByKey"
      contains: "fetchJiraIssueByKey"
    - path: "taskflow/src/components/app/CommandPalette.tsx"
      provides: "isJiraKeyQuery derived boolean + useQuery for key lookup + Direct Match group"
      contains: "isJiraKeyQuery"
  key_links:
    - from: "CommandPalette.tsx"
      to: "fetchJiraIssueByKey"
      via: "useQuery(['search', 'key', query]) queryFn"
      pattern: "fetchJiraIssueByKey"
    - from: "jira.ts barrel"
      to: "issues.ts"
      via: "re-export"
      pattern: "export.*fetchJiraIssueByKey"
---

<objective>
Add automatic Jira issue key detection to CommandPalette: when the query matches
/^[A-Za-z]+-\d+$/i, fire a direct REST fetch for that issue key and surface it in a
"Direct Match" group — no button click required, silent on failure.

Purpose: Let users jump directly to any Jira issue (open or closed) by typing its key.
Output: fetchJiraIssueByKey service function, its re-export, tests for both, and the
        CommandPalette detection + display logic.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira/issues.ts
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/services/jira.ts
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/components/app/CommandPalette.tsx

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

From taskflow/src/services/jira/issues.ts:
```typescript
// apiFetch signature (from lib/apiFetch):
apiFetch(service: string, url: string, options: RequestInit, label: string): Promise<Response>

// Silent-failure pattern used by searchJira and searchJiraClosed:
let response: Response;
try {
  response = await apiFetch('jira', url, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }, 'Search Issues');
} catch {
  return [];          // <-- return null / empty on network error
}
if (!response.ok) {
  return [];          // <-- return null / empty on non-2xx
}
return response.json();

// Existing JiraIssue type (exported from jira.ts barrel and jira/types.ts):
interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: { name: string } };
    assignee: { displayName: string } | null;
    customfield_10016: number | null;
    issuetype: { name: string };
    // ... other optional fields
  };
}
```

From taskflow/src/components/app/CommandPalette.tsx:
```typescript
// Existing query pattern (live search):
const { data: liveResults, isLoading: liveSearchLoading } = useQuery({
  queryKey: ['search', 'live', query],
  queryFn: async () => {
    const token = await readSecret('jira-pat');
    return searchJira(jiraBaseUrl!, token, activeJiraProject!, query);
  },
  enabled: query.length >= 2 && liveSearchTriggered && !!jiraBaseUrl && !!activeJiraProject,
  staleTime: 30_000,
  placeholderData: keepPreviousData,
});

// Imports to extend:
import { searchJira, searchJiraClosed } from '@/services/jira';
// Add: fetchJiraIssueByKey

// Derived boolean (no new state):
const isJiraKeyQuery = /^[A-Za-z]+-\d+$/i.test(query.trim());
```

From taskflow/src/components/app/CommandPalette.test.tsx:
```typescript
// Mock pattern for jira service:
vi.mock('@/services/jira', () => ({
  searchJira: vi.fn().mockResolvedValue([]),
  searchJiraClosed: vi.fn().mockResolvedValue([]),
  // Add: fetchJiraIssueByKey: vi.fn().mockResolvedValue(null),
}));
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add fetchJiraIssueByKey to issues.ts and re-export from jira.ts</name>
  <files>
    taskflow/src/services/jira/issues.ts,
    taskflow/src/services/jira/issues.test.ts,
    taskflow/src/services/jira.ts
  </files>
  <behavior>
    - fetchJiraIssueByKey('https://jira.example.com', 'tok', 'PROJ-123') calls
      /rest/api/2/issue/PROJ-123?fields=summary,status,assignee,customfield_10016,issuetype
    - Returns the parsed JiraIssue on 200
    - Returns null on 404, 401, 403, or any non-ok status (silent failure)
    - Returns null on network error / thrown exception (silent failure)
    - Does NOT include statusCategory filter — open and closed issues both returned
    - jira.ts barrel exports fetchJiraIssueByKey (consumer can import from '@/services/jira')
  </behavior>
  <action>
    Add fetchJiraIssueByKey after the searchJiraClosed function in issues.ts:

    ```typescript
    /**
     * Fetch a single Jira issue by its key, regardless of status (open or closed).
     *
     * Silent-failure contract: returns null on any error (404, auth, network).
     * Callers should show nothing when null is returned.
     *
     * @param baseUrl  - Jira base URL
     * @param token    - Personal Access Token
     * @param issueKey - Jira issue key, e.g. "PROJ-123"
     */
    export async function fetchJiraIssueByKey(
      baseUrl: string,
      token: string,
      issueKey: string,
    ): Promise<JiraIssue | null> {
      const base = baseUrl.replace(/\/$/, '');
      const url = `${base}/rest/api/2/issue/${issueKey}?fields=summary,status,assignee,customfield_10016,issuetype`;

      let response: Response;
      try {
        response = await apiFetch(
          'jira',
          url,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
          'Fetch Issue By Key',
        );
      } catch {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      return response.json() as Promise<JiraIssue>;
    }
    ```

    In issues.test.ts: add `fetchJiraIssueByKey` to the import list and add a
    `describe('fetchJiraIssueByKey', ...)` block after the searchJiraClosed tests with
    cases matching the behavior block above. Follow the same vi.mocked(apiFetch) pattern
    used in the searchJiraClosed tests.

    In jira.ts: The file uses `export * from './jira/issues'` (verify via grep) or
    lists individual exports. Add `fetchJiraIssueByKey` to whichever pattern is in use.
    If jira.ts has individual export lines for issues functions, add:
    `export { fetchJiraIssueByKey } from './jira/issues';`
    If it already uses `export * from './jira/issues'`, no change to jira.ts is needed.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/services/jira/issues.test.ts --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>
    fetchJiraIssueByKey exists in issues.ts, is exported from jira.ts barrel,
    all new tests pass (success, null-on-404, null-on-network-error, correct URL shape).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add key-pattern auto-detection and Direct Match group to CommandPalette</name>
  <files>
    taskflow/src/components/app/CommandPalette.tsx,
    taskflow/src/components/app/CommandPalette.test.tsx
  </files>
  <behavior>
    - When query is 'PROJ-123' (matches /^[A-Za-z]+-\d+$/i): useQuery fires automatically,
      no button click needed
    - When query is 'fix login' (does not match pattern): key-fetch query stays disabled
    - When key-fetch returns an issue: a 'Direct Match' group appears above the Issues group,
      containing one item showing the issue key + summary
    - When key-fetch returns null: no Direct Match group rendered
    - Selecting the Direct Match item calls handleIssueSelect(issue.key, issue.fields.summary)
    - The key-fetch query key is ['search', 'key', query]
    - enabled condition: isJiraKeyQuery && query.length >= 2 && !!jiraBaseUrl && !!activeJiraProject
    - staleTime: 30_000, placeholderData: keepPreviousData (matching live search pattern)
  </behavior>
  <action>
    1. Add fetchJiraIssueByKey to the import line:
       `import { searchJira, searchJiraClosed, fetchJiraIssueByKey } from '@/services/jira';`

    2. Add derived boolean (pure computation, no useState) after the closedSearchTriggered
       state declaration:
       ```typescript
       const isJiraKeyQuery = /^[A-Za-z]+-\d+$/i.test(query.trim());
       ```

    3. Add the key-fetch useQuery after the closedResults query (before the handlers section):
       ```typescript
       // ─── Direct key lookup ─────────────────────────────────────────────────────

       const { data: keyMatchResult } = useQuery({
         queryKey: ['search', 'key', query],
         queryFn: async () => {
           const token = await readSecret('jira-pat');
           return fetchJiraIssueByKey(jiraBaseUrl!, token, query.trim());
         },
         enabled: isJiraKeyQuery && query.length >= 2 && !!jiraBaseUrl && !!activeJiraProject,
         staleTime: 30_000,
         placeholderData: keepPreviousData,
       });
       ```

    4. In the JSX search state branch (the `<>` block after `{isDefaultState ? ... : (`),
       add the Direct Match group immediately before the existing Issues group:
       ```tsx
       {/* Direct Match group -- shown when query matches a Jira issue key pattern */}
       {keyMatchResult && (
         <CommandGroup heading="Direct Match">
           <CommandItem
             key={`key-match-${keyMatchResult.key}`}
             value={`key-match-${keyMatchResult.key} ${keyMatchResult.fields.summary}`}
             onSelect={() => handleIssueSelect(keyMatchResult.key, keyMatchResult.fields.summary)}
           >
             <span className="text-muted-foreground font-mono">{keyMatchResult.key}</span>
             <span className="truncate">{keyMatchResult.fields.summary}</span>
           </CommandItem>
         </CommandGroup>
       )}
       ```

    In CommandPalette.test.tsx:
    - Add `fetchJiraIssueByKey: vi.fn().mockResolvedValue(null)` to the vi.mock('@/services/jira') factory
    - Import `fetchJiraIssueByKey` from '@/services/jira' at the top of the test file
    - Add a describe block 'key pattern detection' with tests:
      * "shows Direct Match group when query matches issue key and fetch returns issue"
        -- set fetchJiraIssueByKey mock to resolve with { key: 'TEST-99', fields: { summary: 'Key match issue' } }
        -- type 'TEST-99' in the input (fireEvent.change)
        -- await screen.findByText('Direct Match') to confirm group heading appears
        -- confirm 'TEST-99' and 'Key match issue' text visible
      * "does not show Direct Match group when fetch returns null"
        -- fetchJiraIssueByKey mock resolves with null
        -- type 'TEST-99', wait a tick
        -- queryByText('Direct Match') should be null
      * "does not fire key fetch for non-key query"
        -- type 'fix login'
        -- assert fetchJiraIssueByKey was not called (vi.mocked check)
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/components/app/CommandPalette.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>
    CommandPalette shows 'Direct Match' group automatically when a Jira key pattern
    is typed and the API returns an issue. All new tests pass. No regression in
    existing palette tests.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CommandPalette input → Jira REST | User-typed key is interpolated into the URL path |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-epfmqx-01 | Tampering | fetchJiraIssueByKey URL construction | mitigate | issueKey is used only in the URL path after pattern validation (`/^[A-Za-z]+-\d+$/i` ensures only safe alphanumeric + hyphen chars reach the URL — no injection surface) |
| T-epfmqx-02 | Information Disclosure | null-on-error silent failure | accept | Returning null on 404/401 is intentional; no server error detail leaks to the UI |
</threat_model>

<verification>
Run the full test suite to confirm no regressions:

```bash
cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/services/jira/issues.test.ts src/components/app/CommandPalette.test.tsx --reporter=verbose
```

All tests green. TypeScript compiles cleanly:

```bash
cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit 2>&1 | head -30
```
</verification>

<success_criteria>
- fetchJiraIssueByKey exported from issues.ts and re-exported from the jira.ts barrel
- Typing 'PROJ-123' in the palette auto-fetches the issue (no button needed)
- Successful fetch renders a 'Direct Match' group with the issue key + summary
- Null / error response renders nothing (no error state, no empty group)
- All existing CommandPalette tests continue to pass
- TypeScript reports zero new errors
</success_criteria>

<output>
After completion, create `.planning/quick/260511-epfmqx-fetch-closed-jira-task-by-id/260511-epfmqx-01-SUMMARY.md`
</output>
