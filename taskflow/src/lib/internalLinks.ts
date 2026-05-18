/**
 * Pure helper for mapping external Jira / GitLab URLs to internal React Router paths.
 *
 * Design: this module has NO React imports, NO auth-store imports, and NO side-effects.
 * It receives all context values via `ctx` so it can be unit-tested trivially without
 * mocking any module boundaries.
 *
 * Consumer responsibility: read auth-store values (jiraBaseUrl, gitlabBaseUrl,
 * activeGitlabProject, activeGitlabProjectPath), build an InternalLinkCtx, call this
 * helper, then call `useNavigate()` when the return value is non-null.
 */

/** Context that the consumer (e.g. WikiRenderer) reads from the auth store and passes in. */
export type InternalLinkCtx = {
  jiraBaseUrl: string | null;
  gitlabBaseUrl: string | null;
  activeGitlabProject: number | null;
  activeGitlabProjectPath: string | null;
};

/**
 * Attempt to map `href` to an in-app React Router path.
 *
 * Returns the internal path string (e.g. `"/issue/PROJ-12345"`) when the URL
 * corresponds to a route the app renders natively, or `null` when the URL should
 * fall through to the OS browser via `openUrl`.
 *
 * Mapping rules:
 * - `{jiraBaseUrl}/browse/{KEY}` → `/issue/{KEY}`
 * - `{gitlabBaseUrl}/{activeGitlabProjectPath}/-/merge_requests/{iid}` → `/mr/{activeGitlabProject}/{iid}`
 *   (only when the URL's group/project path normalizes to the same value as
 *    `activeGitlabProjectPath`, to avoid navigating to the wrong project's MR)
 * - Everything else → `null`
 */
export function tryInternalPath(href: string, ctx: InternalLinkCtx): string | null {
  // 1. Sanitize inputs.
  if (!href || href.trim() === '') return null;

  // Refuse non-http(s) protocols early (defense against javascript: etc.)
  const trimmed = href.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  // Only http / https are safe to route internally.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  // 2. Try Jira browse mapping.
  if (ctx.jiraBaseUrl) {
    const jiraOrigin = normalizeOrigin(ctx.jiraBaseUrl);
    if (url.origin === jiraOrigin) {
      // pathname may end with a trailing slash; strip it before matching.
      const pathname = url.pathname.replace(/\/$/, '');
      const match = pathname.match(/^\/browse\/([A-Z][A-Z0-9_]+-\d+)$/);
      if (match) {
        return `/issue/${match[1]}`;
      }
      // Host matched but not a browse path — do not fall through to GitLab check.
      return null;
    }
  }

  // 3. Try GitLab MR mapping.
  if (ctx.gitlabBaseUrl) {
    const gitlabOrigin = normalizeOrigin(ctx.gitlabBaseUrl);
    if (url.origin === gitlabOrigin) {
      const pathname = url.pathname.replace(/\/$/, '');
      // Match paths of the form /group/repo(s)?/-/merge_requests/42
      const match = pathname.match(/^\/(.+?)\/-\/merge_requests\/(\d+)$/);
      if (match) {
        const urlPathPart = match[1];
        const iid = match[2];

        if (ctx.activeGitlabProject === null) return null;
        if (!ctx.activeGitlabProjectPath) return null;

        const normalizedUrl = normalizeProjectPath(urlPathPart);
        const normalizedCtx = normalizeProjectPath(ctx.activeGitlabProjectPath);

        if (normalizedUrl === normalizedCtx) {
          return `/mr/${ctx.activeGitlabProject}/${iid}`;
        }
        // Path mismatch — safer to open externally than navigate to the wrong project.
        return null;
      }
      // GitLab host but not an MR URL — fall through to null.
      return null;
    }
  }

  // 4. Nothing matched.
  return null;
}

/** Strip trailing slash from a base URL and return just the origin (scheme + host + port). */
function normalizeOrigin(baseUrl: string): string {
  try {
    return new URL(baseUrl.replace(/\/$/, '')).origin;
  } catch {
    return baseUrl.replace(/\/$/, '');
  }
}

/**
 * Normalize a GitLab project path for comparison.
 *
 * Rules:
 * - Lowercase
 * - Replace whitespace around slashes (regex: whitespace* slash whitespace*) with a single `/`
 * - Trim leading/trailing slashes and whitespace
 *
 * This handles display labels like "Org / My Project" → "org/my project"
 * vs slug paths like "group/repo" → "group/repo".
 * Note: a display label with spaces inside a segment (e.g. "My Project")
 * will NOT match a slug path with dashes (e.g. "my-project") — this is
 * intentional; we prefer returning null over wrong-project navigation.
 */
function normalizeProjectPath(path: string): string {
  return path
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/^\/|\/$/g, '');
}
