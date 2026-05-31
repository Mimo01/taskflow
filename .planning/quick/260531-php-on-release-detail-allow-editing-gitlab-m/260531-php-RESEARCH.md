# Quick Task 260531-php: Release editing modal + GitLab milestone editing — Research

**Researched:** 2026-05-31
**Confidence:** HIGH (all five unknowns resolved against actual code + GitLab docs)

## Summary

All edit logic already exists in `ReleaseDetailPage.tsx` as a sidebar form; the task is to (1) relocate it into a centered modal, (2) add a new `updateMilestone()` service fn in `gitlab.ts`, and (3) drive both writes from one Save with per-source partial-failure handling. Every primitive needed (Dialog API, auth/header pattern, project-id resolution, secret key, mutation shape) is confirmed below with file:line and exact snippets to mirror.

**Primary recommendation:** Add `updateMilestone()` to `gitlab.ts` mirroring `updateFixVersion`'s structure; build the modal mirroring `CreateEditIssueModal`'s `Dialog.Root`/`Dialog.Popup` skeleton; run the two writes with `Promise.allSettled` inside the existing `useMutation`, keeping the modal open on any rejection.

---

## 1. GitLab milestone update endpoint — RESOLVED

**Endpoint:** `PUT /api/v4/projects/:id/milestones/:milestone_id`
**Path param is the milestone numeric `id`, NOT `iid`.** [CITED: https://docs.gitlab.com/api/milestones/ — "PUT /projects/:id/milestones/:milestone_id", milestone_id = the milestone's ID]

- **Pass `matchedMilestone.id`** (the `id` field of `GitLabMilestone`, gitlab.ts:173), not `iid`.
- Body attributes: `title`, `description`, `due_date`, `start_date`, `state_event`. This task sends **only `title` and/or `description`**.
- The project `:id` is the numeric project id (`activeGitlabProject`), same value already passed to `fetchProjectMilestonesInRange` (gitlab.ts:642 takes `projectId: number`).

**New service fn to add to `gitlab.ts`** — mirror `updateFixVersion` (jira.ts:1079-1118) and the existing GitLab fetch error conventions:

```typescript
export async function updateMilestone(
  baseUrl: string,
  token: string,
  projectId: number,
  milestoneId: number,            // GitLabMilestone.id, NOT iid
  fields: { title?: string; description?: string },
): Promise<GitLabMilestone> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/milestones/${milestoneId}`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        method: 'PUT',
        headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      },
      'Update Milestone',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to update milestone', response.status, 'gitlab');
    }
    throw new Error(`Failed to update milestone: status ${response.status}`);
  }

  return (await response.json()) as GitLabMilestone;
}
```

---

## 2. Auth + base URL + token (exact codebase pattern) — RESOLVED

- **Auth header:** `PRIVATE-TOKEN` (NOT `Authorization: Bearer`). Every GitLab fn uses `{ 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' }` — e.g. gitlab.ts:783, gitlab.ts:858. (Jira uses Bearer; GitLab does not.)
- **HTTP wrapper:** `apiFetch('gitlab', url, init, 'Operation Label')` from `../lib/apiFetch` (imported gitlab.ts:17). It wraps `@tauri-apps/plugin-http` fetch, applies a 15s timeout, redacts the `PRIVATE-TOKEN` header in logs, and the `'gitlab'` source flips `gitlabConnected` on network failure. **Use `apiFetch`, not raw `fetch`.**
- **Base URL forming:** `${baseUrl.replace(/\/$/, '')}/api/v4/...` (strip trailing slash). Identical across all fns.
- **Secret key:** `readSecret('gitlab-pat')` from `@/services/stronghold`. Confirmed at ReleaseDetailPage.tsx:162 (`readSecret('gitlab-pat')`). Jira uses `readSecret('jira-pat')` (ReleaseDetailPage.tsx:179).

---

## 3. How ReleaseDetailPage resolves the call-site values — RESOLVED

All already present in the component (no new plumbing needed):

- **`activeGitlabProject`** — `number` (or 0 fallback). From `useAuthStore()` (ReleaseDetailPage.tsx:135). Already passed as `activeGitlabProject ?? 0` to `fetchProjectMilestonesInRange` (line 229). Use the same for `updateMilestone`.
- **`gitlabBaseUrl`** — from `useAuthStore()` (line 135), passed as `gitlabBaseUrl ?? ''` (line 228).
- **`gitlabToken`** — already loaded into local state `gitlabToken` via the effect at lines 160-166 (`readSecret('gitlab-pat')`). Reuse `gitlabToken ?? ''` at the call site (matches lines 227-231).
- **`matchedMilestone`** — `GitLabMilestone | null` at lines 256-260. Pass `matchedMilestone.id` and seed the GitLab section inputs from `matchedMilestone.title` / `matchedMilestone.description ?? ''`.
- **Render GitLab section only when** `gitlabMatch.type !== 'none' && matchedMilestone` (same guard already used at lines 475-478, 504).

Quoted resolution lines:
```ts
// L135
const { jiraBaseUrl, activeJiraProject, gitlabBaseUrl, activeGitlabProject } = useAuthStore();
// L147 + L160-166
const [gitlabToken, setGitlabToken] = useState<string | null>(null);
useEffect(() => { if (gitlabBaseUrl) { readSecret('gitlab-pat').then(setGitlabToken)... } }, [gitlabBaseUrl]);
```

---

## 4. Dialog primitive API + modal wiring — RESOLVED

**Two valid approaches — pick the `Dialog.Root` raw-primitive approach (4b) since the closest analog `CreateEditIssueModal` uses it.**

**4a. Wrapper components** exported from `@/components/ui/dialog` (dialog.tsx:126-137): `Dialog`, `DialogTrigger`, `DialogContent` (`showCloseButton` prop, default true), `DialogHeader`, `DialogFooter` (`showCloseButton` default false), `DialogTitle`, `DialogDescription`, `DialogClose`, `DialogOverlay`, `DialogPortal`. `Dialog` forwards Base UI `Root.Props` → supports controlled `open` + `onOpenChange`. `DialogContent` is capped at `sm:max-w-sm` — too narrow for this form; override `className` or use 4b.

**4b. Raw Base UI primitive (mirror `CreateEditIssueModal.tsx`:150-528) — RECOMMENDED:**
```tsx
import { Dialog } from '@base-ui/react/dialog';

<Dialog.Root open={editing} onOpenChange={(o) => { if (!o) cancelEditing(); }}>
  <Dialog.Portal>
    <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
    <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[680px] max-h-[85vh] overflow-y-auto bg-background border rounded-lg shadow-xl flex flex-col">
      {/* header with title + Dialog.Close (X) — CreateEditIssueModal L159-170 */}
      {/* form fields — reuse existing Input/Textarea from ReleaseDetailPage */}
      {/* error block: state.apiError → CreateEditIssueModal L502-506 */}
      {/* footer Cancel/Save — CreateEditIssueModal L508-524 */}
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

**Wiring conventions to mirror:**
- **Open/close:** controlled `open` prop + `onOpenChange((o) => { if (!o) onClose(); })` (CreateEditIssueModal L151-155). Reuse the existing `editing`/`startEditing`/`cancelEditing` state (ReleaseDetailPage L168, 342-355) as the open flag.
- **Pending:** disable inputs + Save while `mutation.isPending`; Save label swaps to `Saving...` (CreateEditIssueModal L514-523; existing pattern already at ReleaseDetailPage L928-941).
- **Error display:** `state.apiError &&` red block `rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive` (L502-506). For this task, render **two** such blocks (one per source) so partial failures show which side failed.
- **Save disabled rule:** keep `!editName.trim()` (existing L928); optionally also `disabled until dirty` (discretion).
- **Inputs:** reuse `Input` and `Textarea` already imported in ReleaseDetailPage (L36, L39). Existing Jira fields markup is at L860-918 — lift verbatim into the modal.

---

## 5. Pitfalls — RESOLVED

1. **GitLab empty description clears the field.** Sending `description: ""` in the PUT body **does clear** the milestone description (GitLab treats empty string as a set-to-empty, not "leave unchanged"). This is the desired behavior for a user blanking the field. Only omit a field to leave it untouched. → **Send only changed fields** (dirty-track): build the GitLab body the same way the Jira `handleSave` does (L380-402): include `title`/`description` only if differing from `matchedMilestone.title`/`matchedMilestone.description ?? ''`.
2. **Send only changed fields per API.** Mirror existing `handleSave` field-diff logic (L388-393) for Jira; do the same independently for GitLab. If a side has no changed fields, skip that API call entirely (don't PUT an empty body).
3. **Partial-failure / no rollback.** Use `Promise.allSettled([jiraWrite?, gitlabWrite?])`. On all-fulfilled: invalidate caches + close. On any rejected: keep modal open, set the per-source error from that rejection's `.reason.message`. The succeeded side is NOT rolled back (cross-system, impossible) — per CONTEXT decision. Re-running Save should re-diff so an already-succeeded side has no changed fields and is skipped.
4. **Cache invalidation keys (exact):**
   - Jira success → `['jira-fix-versions', activeJiraProject]` and `['jira-version-counts', versionId]` (existing onSuccess, L370-371).
   - GitLab success → `['gitlab-milestones', activeGitlabProject, milestoneWindow?.from, milestoneWindow?.to]` (query key at L218-223). Also consider `['gitlab-milestone-mrs', activeGitlabProject, gitlabMatch.candidateName]` (L276) if the title changed (milestone MRs are fetched by title). Simplest correct approach: `queryClient.invalidateQueries({ queryKey: ['gitlab-milestones', activeGitlabProject] })` (prefix match invalidates all window variants).
5. **Title rename invalidates milestone-MR matching.** `fetchMilestoneMRs` queries by milestone **title** (gitlab.ts:940-952) and `matchedMilestone` is found by `m.title === gitlabMatch.candidateName` (L258). Renaming the title will re-match after the `gitlab-milestones` cache refresh — acceptable, just invalidate broadly.

**Test conventions (executor adds tests in-style):**
- Runner: **Vitest** (`npm run test` = `vitest run`). Service tests live beside source: `src/services/gitlab.test.ts` exists.
- Pattern: `vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }))`, then `vi.mocked(mockFetch).mockResolvedValue({ ok, status, json: async () => (...) } as Response)` (gitlab.test.ts:22-65). Add `updateMilestone` cases there: success returns parsed milestone; 401/403 throws `ApiError`; verify body contains only changed fields and URL uses `/projects/:id/milestones/:id`.
- Component tests use `*.test.tsx` (e.g. `ReleasesTab.test.tsx`) with `@testing-library` + `jest-dom`.

---

## Files to touch
- `taskflow/src/services/gitlab.ts` — add `updateMilestone()` (after `fetchProjectMilestonesInRange`, ~L715).
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` — move sidebar edit form (L846-952) into a modal; sidebar reverts to read-only (drop the `editing ?` branch, keep L953-1081); add GitLab title/description state + combined Save via `Promise.allSettled`; two error blocks.
- `taskflow/src/services/gitlab.test.ts` — add `updateMilestone` cases.

## Sources
- **HIGH** — codebase reads: `gitlab.ts`, `jira.ts:1079-1118`, `ReleaseDetailPage.tsx`, `dialog.tsx`, `CreateEditIssueModal.tsx`, `gitlab.test.ts`, `apiFetch.ts`.
- **HIGH** — GitLab REST milestones docs: https://docs.gitlab.com/api/milestones/ (`PUT /projects/:id/milestones/:milestone_id`, milestone_id = id not iid).
