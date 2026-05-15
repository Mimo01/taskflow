---
phase: quick-260515-fti
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/stores/aio-cycles-selection.store.ts
  - taskflow/src/stores/aio-cycles-selection.store.test.ts
  - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
  - taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx
autonomous: true
requirements:
  - QT-260515-fti

must_haves:
  truths:
    - "After picking a folder in the AIO cycles page, reloading the app reopens that same folder for the same project."
    - "On first visit to a project (no persisted selection), behavior is unchanged: first non-empty folder auto-selects."
    - "Persisted selection is scoped per Jira project key — switching projects does not cross-contaminate selections."
    - "If the persisted folder ID no longer exists in the folder tree (deleted/renamed), fall back to the existing first-non-empty-folder logic without crashing."
  artifacts:
    - path: taskflow/src/stores/aio-cycles-selection.store.ts
      provides: "Persisted Zustand store mapping projectKey -> last selected folderID (incl. -1 for Ungrouped)"
      exports: ["useAioCyclesSelectionStore"]
    - path: taskflow/src/stores/aio-cycles-selection.store.test.ts
      provides: "Unit tests for setSelectedFolder/getSelectedFolder semantics + persistence shape"
    - path: taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
      provides: "Reads persisted selection on mount; writes on selectFolder; falls back to firstNonEmpty when stale/missing"
      contains: "useAioCyclesSelectionStore"
  key_links:
    - from: "AioProjectOverviewPage.tsx"
      to: "aio-cycles-selection.store"
      via: "useAioCyclesSelectionStore().getSelectedFolder(projectKey) on initial auto-select effect; setSelectedFolder(projectKey, id) in selectFolder()"
      pattern: "useAioCyclesSelectionStore"
    - from: "aio-cycles-selection.store.ts"
      to: "tauri-storage adapter"
      via: "createTauriStorage('aio-cycles-selection.json')"
      pattern: "createTauriStorage"
---

<objective>
Persist the user's last-selected folder in the AIO cycles page so reloading the app reopens that folder for the same project, instead of always defaulting to the first non-empty folder.

Purpose: The folder tree on the AIO cycles page (AioProjectOverviewPage) is the user's primary navigation into test cycles. Re-selecting the same folder on every reload is friction — the user wants the app to remember where they were.

Output: A new persisted Zustand store keyed by Jira projectKey, wired into AioProjectOverviewPage's auto-select effect and folder-select handler, with tests covering persistence semantics and stale-ID fallback.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/.planning/STATE.md
@taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
@taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx
@taskflow/src/stores/recent-items.store.ts
@taskflow/src/lib/tauri-storage.ts

<interfaces>
<!-- Existing persistence pattern in this codebase. Use these directly. -->
<!-- The app is Tauri-based; we persist via createTauriStorage (NOT browser localStorage). -->
<!-- This is the load-bearing decision in the quick-task constraint: "localStorage" in the request -->
<!-- means "client-side persistence that survives reload" — and createTauriStorage is the codebase's -->
<!-- standard for that. recent-items.store.ts is the canonical small-shape reference. -->

From src/lib/tauri-storage.ts:
- export function createTauriStorage(filename: string): StateStorage
  Wraps Tauri LazyStore as a zustand persist `storage` adapter.

From src/stores/recent-items.store.ts (reference pattern):
- create<State>()(persist((set) => ({...}), {
    name: 'recent-items-store',
    storage: createTauriStorage('recent-items.json'),
    version: 0,
    migrate: (persisted, _version) => persisted as State,
  }))

From src/routes/dashboard/AioProjectOverviewPage.tsx (current behavior to preserve when no stored value):
- State: const [selectedFolderID, setSelectedFolderID] = useState<number | null>(null)
- Auto-select effect (lines ~338-353) gated by autoExpandedRef.current; calls
  findFirstNonEmptyFolder(foldersQuery.data, countMapQuery.data) and setSelectedFolderID(firstWithCycles)
- selectFolder = (id: number) => setSelectedFolderID(id)  (line ~380; also fires from FolderNode + "Ungrouped" with id = -1)
- searchSubtree(tree, id) helper already exists for "does this folder still exist in the tree" checks
- "Ungrouped" pseudo-folder is represented by id = -1 and is valid only when countMap['-1'] > 0
- projectKey: const { projectKey } = useParams<{ projectKey: string }>() — non-null gate is `credGate`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create persisted aio-cycles-selection store</name>
  <files>taskflow/src/stores/aio-cycles-selection.store.ts, taskflow/src/stores/aio-cycles-selection.store.test.ts</files>
  <behavior>
    - getSelectedFolder(projectKey) returns null when no entry has been stored for that key.
    - setSelectedFolder(projectKey, id) followed by getSelectedFolder(projectKey) returns the same id (number, including -1 for "Ungrouped").
    - setSelectedFolder is per-project: setting projectKey "A" does not change the value for projectKey "B".
    - clearSelectedFolder(projectKey) removes only that project's entry.
    - The persisted shape is { byProjectKey: Record<string, number> } so it round-trips through JSON without Map/Set issues.
    - Test the store directly (no React); call vi.resetModules() between cases and create a fresh store import to avoid in-memory state bleed. Use vi.mock for '@/lib/tauri-storage' returning an in-memory adapter (same approach as other store tests in this repo — see settings.store.test.ts / pinned-tabs.store.test.ts for shape).
  </behavior>
  <action>
    Create a new Zustand store in taskflow/src/stores/aio-cycles-selection.store.ts that mirrors the recent-items.store.ts persistence pattern. Use create()(persist(...)) with createTauriStorage('aio-cycles-selection.json'), name 'aio-cycles-selection-store', version 0, and an identity migrate function.

    Shape:
      interface AioCyclesSelectionState {
        byProjectKey: Record<string, number>;
        getSelectedFolder: (projectKey: string) => number | null;
        setSelectedFolder: (projectKey: string, folderID: number) => void;
        clearSelectedFolder: (projectKey: string) => void;
      }

    Implementation notes:
      - getSelectedFolder reads from get().byProjectKey[projectKey] and returns null if undefined.
      - setSelectedFolder uses set((s) => ({ byProjectKey: { ...s.byProjectKey, [projectKey]: folderID } })).
      - clearSelectedFolder removes the key via object-rest destructure or new object excluding the key.
      - Export const useAioCyclesSelectionStore for consumers.
      - Store ALL valid folder ids verbatim, including -1 (Ungrouped pseudo-folder).

    Write the matching .test.ts colocated. Cover: empty initial state returns null; set then get round-trips; per-project isolation (set "A"=5, set "B"=7, get "A"==5); clear removes only the targeted key; -1 is a valid stored value (regression guard for Ungrouped). Use the existing vitest + vi.mock conventions already in this repo (see taskflow/src/stores/recent-items.store.test.ts or settings.store.test.ts for harness patterns — mock '@/lib/tauri-storage' to an in-memory adapter so persistence is deterministic).

    Do not add migration logic beyond the identity migrate; no prior persisted version exists.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/stores/aio-cycles-selection.store.test.ts</automated>
  </verify>
  <done>
    The store file exports useAioCyclesSelectionStore; all tests in aio-cycles-selection.store.test.ts pass; no other test files are touched.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire persisted selection into AioProjectOverviewPage</name>
  <files>taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx, taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx</files>
  <behavior>
    - First visit (no persisted value for projectKey): page still auto-selects the first non-empty folder (existing behavior preserved).
    - Second visit (persisted folderID exists AND still resolves in the current folder tree, OR equals -1 with ungroupedCount > 0): the persisted folder is auto-selected instead of the first non-empty.
    - Stale persisted value (folderID is a positive number not found in foldersQuery.data via searchSubtree, OR equals -1 but ungroupedCount === 0): fall back to findFirstNonEmptyFolder; do not crash; clear the stale entry so a later valid pick is what gets stored.
    - selectFolder(id) writes through to the store via setSelectedFolder(projectKey, id) (covers normal folder clicks and the Ungrouped button click — which already calls selectFolder(-1)).
    - Per-project isolation: navigating from /aio-project/A to /aio-project/B reads B's stored value (or first-non-empty when none), never A's.
  </behavior>
  <action>
    Modify AioProjectOverviewPage to read and write the persisted selection.

    1. Import useAioCyclesSelectionStore from '@/stores/aio-cycles-selection.store'.

    2. In the component body, after const { projectKey } = useParams(...), pull the store helpers (use selectors so the component does not re-render on unrelated project keys):
         const getSelectedFolder = useAioCyclesSelectionStore((s) => s.getSelectedFolder);
         const setSelectedFolder = useAioCyclesSelectionStore((s) => s.setSelectedFolder);
         const clearSelectedFolder = useAioCyclesSelectionStore((s) => s.clearSelectedFolder);

    3. Update the existing auto-select useEffect (currently at ~lines 339-353, guarded by autoExpandedRef). Keep the autoExpandedRef one-shot guard. Inside the effect, when foldersQuery.data and countMapQuery.data are ready:
         a. Read const stored = projectKey ? getSelectedFolder(projectKey) : null;
         b. Compute isStoredValid:
              - If stored === -1: valid iff (countMapQuery.data['-1'] ?? 0) > 0
              - If stored is a positive number: valid iff searchSubtree(foldersQuery.data, stored)
              - If stored === null: not valid
         c. If isStoredValid: setSelectedFolderID(stored). Also expand the path to it if it is a non-root folder — minimum acceptable behavior is to expand the first root (existing behavior) AND to expand the stored folder itself if it has children, so the user sees their selection highlighted. Do NOT block on full ancestor-path expansion (out of scope for this quick task; record as a follow-up if user requests).
         d. Otherwise: run existing fallback — findFirstNonEmptyFolder(foldersQuery.data, countMapQuery.data) and setSelectedFolderID(firstWithCycles). If stored was non-null but invalid, also call clearSelectedFolder(projectKey) to drop the stale entry.
         e. Keep the existing setExpandedIDs(new Set([foldersQuery.data[0].ID])) line for the first root expansion.

    4. Update selectFolder (currently `const selectFolder = (id: number) => setSelectedFolderID(id);`) to also persist:
         const selectFolder = (id: number) => {
           setSelectedFolderID(id);
           if (projectKey) setSelectedFolder(projectKey, id);
         };
       This handles both regular folder clicks (FolderNode onSelect) and the Ungrouped button (which already calls selectFolder(-1)).

    5. Ensure projectKey changes reset the autoExpandedRef so navigating to a new project re-runs the auto-select logic against that project's stored value. Add: useEffect(() => { autoExpandedRef.current = false; }, [projectKey]); placed near the existing ref declaration. Verify by test (see below).

    6. Extend AioProjectOverviewPage.test.tsx with three new it() blocks under a new describe('AioProjectOverviewPage — persisted folder selection'):
         a. "auto-selects persisted folder on second load" — set the store value before render (folder 102 added alongside 101), assert folder-node-102 has the bg-primary class via toHaveAttribute on data-testid + className includes 'bg-primary' (mirror how isSelected styling is tested in this file's existing tests if available, or assert via the rendered class string of the queried button).
         b. "falls back to first non-empty when persisted ID is stale" — set store to folder 999 (not in tree); render; assert folder-node-101 ends up selected; assert store.getSelectedFolder('PROJ') returns null afterwards (stale entry was cleared).
         c. "persists selection on click" — render with default mocks; programmatically click folder-node-101 via fireEvent.click; await waitFor that store.getSelectedFolder('PROJ') === 101.
       Mock '@/stores/aio-cycles-selection.store' OR use the real store with vi.mock('@/lib/tauri-storage', ...) returning an in-memory adapter — match whichever pattern Task 1's tests established, for consistency.

    Do not change unrelated logic (cycle list rendering, owner cell, progress bars, etc.).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/AioProjectOverviewPage.test.tsx src/stores/aio-cycles-selection.store.test.ts</automated>
  </verify>
  <done>
    AioProjectOverviewPage reads the persisted folder on mount and falls back to first-non-empty when stale; selectFolder persists; navigating to a different projectKey re-runs the auto-select effect; all existing + new tests in AioProjectOverviewPage.test.tsx pass; no behavior regressions on the "renders folder node" and "renders cycle row" cases.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Manual smoke test in running app</name>
  <what-built>
    Persisted folder selection on the AIO cycles page. After picking a folder, reloading the app should reopen that folder instead of always landing on the first non-empty one. Stored per projectKey via Tauri storage (aio-cycles-selection.json), with graceful fallback when the stored folder no longer exists.
  </what-built>
  <how-to-verify>
    1. `cd taskflow && pnpm tauri dev` (or your usual dev command).
    2. Open an AIO project page (e.g. /aio-project/PROJ). Confirm the first non-empty folder is selected by default.
    3. Click a DIFFERENT folder that has cycles. Confirm the cycle list updates.
    4. Reload the app (Cmd-R / Ctrl-R, or quit and relaunch). Confirm the folder you picked in step 3 is re-selected — NOT the first non-empty one.
    5. Navigate to a different AIO project. Confirm that project shows its own default (first non-empty) — not the folder ID you picked in step 3.
    6. Return to the original project. Confirm your step-3 folder is still selected.
    7. (Optional) If your project has an "Ungrouped" entry, click it, reload, and confirm Ungrouped is re-selected on reload.
  </how-to-verify>
  <resume-signal>Type "approved" if behavior matches, or describe any deviations.</resume-signal>
</task>

</tasks>

<verification>
- Unit tests: `npx vitest run src/stores/aio-cycles-selection.store.test.ts src/routes/dashboard/AioProjectOverviewPage.test.tsx` passes from the `taskflow/` directory.
- Typecheck: `pnpm typecheck` (or repo's equivalent) clean for the two modified source files.
- Manual smoke (Task 3) confirms reload behavior, per-project isolation, stale-ID fallback, and Ungrouped support.
</verification>

<success_criteria>
- After selecting any folder (including Ungrouped) and reloading the app, the AIO cycles page reopens to that folder for the same Jira projectKey.
- First visit to a project (no stored entry) preserves current behavior: first non-empty folder auto-selects.
- Stale stored folder IDs (deleted/renamed folders, or Ungrouped with zero count) gracefully fall back to first-non-empty and clear themselves from storage.
- Each project's selection is isolated; switching projects never cross-contaminates.
- No regressions in existing AioProjectOverviewPage tests.
</success_criteria>

<output>
Create `.planning/quick/260515-fti-in-aio-cycles-page-there-is-a-folder-lik/260515-fti-SUMMARY.md` when done, capturing: files touched, persistence shape, the stale-ID fallback contract, and any deviations from this plan (e.g. ancestor-path expansion if you implemented it).
</output>
