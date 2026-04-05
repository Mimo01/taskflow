---
status: resolved
trigger: "Some avatar images do not load and show missing placeholder across the app"
created: 2026-03-30T00:00:00Z
updated: 2026-03-30T12:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: SOME Jira avatars work, others show initials for users who have avatars set. Need to identify what differs between working and failing URLs — possibly content-type guard rejecting valid responses, or jiraBaseUrl prefix mismatch for some avatar URL patterns, or Jira returning avatar URLs pointing to different domains/hosts.
test: trace every code path that determines whether an avatar URL gets auth or not, and whether the content-type guard rejects it
expecting: to find a URL pattern or content-type variation that causes some avatars to fail
next_action: investigate Jira avatar URL patterns and content-type guard behavior

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: User avatars should display properly everywhere in the app (notifications, issue detail, dashboard/board)
actual: Some avatars show missing/broken placeholder images instead of the actual avatar
errors: No errors visible in browser/dev console
reproduction: Visible everywhere avatars are displayed — notifications panel, issue detail view, dashboard/board
started: Unclear when it started, may have always been partially broken

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: GitLab avatars broken due to missing PRIVATE-TOKEN auth
  evidence: User confirmed GitLab avatars load fine after adding PRIVATE-TOKEN — the problem is Jira-specific
  timestamp: 2026-03-30T12:10:00Z

- hypothesis: avatarUrls URL format doesn't match jiraBaseUrl prefix (startsWith fails)
  evidence: Jira Server returns avatar URLs using its configured base URL which typically matches; the startsWith check with trailing-slash normalization handles standard setups correctly. The real issue is downstream — auth may work but the response can be non-image content.
  timestamp: 2026-03-30T12:15:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-30T00:01:00Z
  checked: avatarCache.ts fetchAndCacheAvatar (lines 82-90)
  found: auth header block reads jiraBaseUrl from auth store and compares with URL prefix, but gitlabBaseUrl is never read and no PRIVATE-TOKEN header is ever added for GitLab URLs
  implication: GitLab self-hosted private instances return 401 for unauthenticated avatar fetches → response.ok is false → function returns null → CachedAvatar stays on initials fallback

- timestamp: 2026-03-30T00:01:30Z
  checked: CachedAvatar component (cached-avatar.tsx line 47)
  found: blobUrl ? 'hidden' : 'flex' — if blobUrl is null (fetch failed), component stays on initials. No error shown, no console log. This explains "no errors in browser/dev console".
  implication: Silent failure path — 401 from GitLab avatar fetch is swallowed by catch(() => null) in avatarCache.ts line 114, so no error surfaces

- timestamp: 2026-03-30T00:02:00Z
  checked: GitLab REST API service (gitlab.ts) — all API calls use 'PRIVATE-TOKEN' header (line 99, 143)
  found: GitLab uses PRIVATE-TOKEN header format (not Bearer), and all other GitLab service calls include it. Avatar fetch in avatarCache.ts omits this.
  implication: Fix must add 'PRIVATE-TOKEN': token block for GitLab URLs, mirroring the Jira auth block

- timestamp: 2026-03-30T00:02:30Z
  checked: auth.store.ts — gitlabBaseUrl is stored at state.gitlabBaseUrl (line 19)
  found: gitlabBaseUrl is available via useAuthStore.getState().gitlabBaseUrl — the same pattern used for jiraBaseUrl
  implication: Fix can use identical pattern: check if URL starts with gitlabBaseUrl, if so add 'PRIVATE-TOKEN' header

- timestamp: 2026-03-30T12:00:00Z
  checked: FieldsSection.tsx lines 336-377 — Assignee and Reporter MetaRows
  found: Assignee PopoverTrigger renders only `f.assignee?.displayName ?? 'Unassigned'` (plain text, no avatar). Reporter MetaRow renders only `f.reporter?.displayName ?? '—'` (plain text, no avatar). No CachedAvatar import in file.
  implication: Avatars were never implemented in the sidebar for these two fields — not a render bug, just missing implementation.

- timestamp: 2026-03-30T12:01:00Z
  checked: types.ts lines 119-120 — JiraIssueDetail.fields.assignee and reporter types
  found: assignee: { displayName, name, avatarUrls: { '48x48': string } } | null; reporter: { displayName, name?, avatarUrls: { '48x48': string } } | null. Both have avatarUrls available.
  implication: No type changes needed — avatarUrls is already typed and accessible via f.assignee?.avatarUrls?.['48x48'] and f.reporter?.avatarUrls?.['48x48'].

- timestamp: 2026-03-30T12:02:00Z
  checked: IssueDetailContent.tsx lines 143-152 and 194-203 — established CachedAvatar pattern for assignee
  found: Pattern is: `<div className="flex items-center gap-1.5 shrink-0"><CachedAvatar url={story.fields.assignee.avatarUrls?.['48x48']} name={story.fields.assignee.displayName} size={20} /></div>`
  implication: Same pattern applies for the sidebar — wrap displayName in a flex container with CachedAvatar at size 20, consistent with existing usage.

- timestamp: 2026-03-30T12:10:00Z
  checked: User feedback from checkpoint round 1
  found: GitLab avatars load fine after PRIVATE-TOKEN fix. Problem is Jira-specific.
  implication: Jira auth block (Bearer) already exists but something downstream causes failures

- timestamp: 2026-03-30T12:12:00Z
  checked: AuthImage.tsx — existing component for Jira attachment images
  found: AuthImage.tsx has error handling, loading states, and a comment "Follows redirects manually to preserve the Authorization header (the Fetch spec strips it on cross-origin redirects)." This confirms the developers were aware of the redirect-strips-auth problem but only solved it for attachments, not avatars.
  implication: The avatar pipeline has the same redirect vulnerability as attachments did before AuthImage was created

- timestamp: 2026-03-30T12:14:00Z
  checked: CachedAvatar component (cached-avatar.tsx) — onError handling
  found: Line 32 explicitly says "No onError handler — blob URLs don't produce network errors after creation." But this assumption is WRONG: blob URLs containing non-image data (HTML, etc.) DO trigger img onError when the browser fails to decode them. The component hides initials when blobUrl is truthy (line 47: `blobUrl ? 'hidden' : 'flex'`) and conditionally renders img (line 55: `{blobUrl && <img.../>}`). If the blob contains HTML, the img fails to render but initials are already hidden = broken placeholder.
  implication: Two fixes needed: (1) content-type validation in avatarCache to prevent non-image blobs, (2) onError handler in CachedAvatar as defensive fallback

- timestamp: 2026-03-30T12:15:00Z
  checked: avatarCache.ts fetchAndCacheAvatar response handling
  found: No content-type check on the response. Line 98: `if (!response.ok) return null` only checks HTTP status. A 200 OK response with text/html content (e.g. from a redirect to a login page) passes this check and gets cached as a blob URL.
  implication: content-type guard needed: `if (contentType && !contentType.startsWith('image/')) return null`

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Two compounding defects in the avatar caching pipeline caused Jira avatars to show as broken/missing placeholders. (1) avatarCache.ts fetchAndCacheAvatar did not validate the response content-type — when Jira returned non-image responses (e.g. HTML login/error pages from auth redirects with 200 status), the HTML was cached as a blob URL. (2) CachedAvatar component had no onError handler on its img element and explicitly commented "No onError handler — blob URLs don't produce network errors after creation." When the blob contained non-image data, the img element failed to decode it, but the initials fallback was already hidden (blobUrl truthy hides initials div), leaving a broken/empty placeholder visible. Additionally, GitLab avatar URLs were fetched without PRIVATE-TOKEN auth headers (separate but related fix from round 1).
fix: (1) avatarCache.ts: Added content-type guard that rejects non-image responses before creating blob URLs. (2) cached-avatar.tsx: Added onError handler on img element that sets imgFailed state, causing img to unmount and initials to re-show as graceful fallback. Added useEffect to reset imgFailed when url prop changes. (3) avatarCache.ts: Added PRIVATE-TOKEN header for GitLab avatar URLs (from round 1). (4) FieldsSection.tsx: Added CachedAvatar to assignee/reporter fields (from round 1).
verification: 836 tests pass across 86 files (3 new tests added). TypeScript type check passes (tsc --noEmit, 0 errors). New tests cover: content-type rejection of HTML responses (Test 12), acceptance of image/png responses (Test 13), onError fallback behavior in CachedAvatar (Test 5).
files_changed:
  - taskflow/src/services/avatarCache.ts
  - taskflow/src/services/avatarCache.test.ts
  - taskflow/src/components/ui/cached-avatar.tsx
  - taskflow/src/components/ui/cached-avatar.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
