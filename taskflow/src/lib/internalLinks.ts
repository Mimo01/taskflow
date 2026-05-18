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
 *   Handles Jira instances with context paths (e.g. company.com/jira/browse/KEY).
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
    const jiraBase = normalizeBase(ctx.jiraBaseUrl);
    if (jiraBase) {
      // Check origin match first (cheap), then full prefix match.
      // Full prefix match is needed for Jira instances with context paths
      // (e.g. company.com/jira — the browse URL is company.com/jira/browse/KEY
      // so we must match the full prefix, not just the origin).
      if (url.origin === jiraBase.origin) {
        // Strip the jiraBaseUrl path prefix from the href pathname before
        // applying the browse regex. For jiraBase.pathname = "/", this is a no-op.
        const relPath = stripPathPrefix(url.pathname, jiraBase.pathname);
        if (relPath !== null) {
          const match = relPath.replace(/\/$/, '').match(/^\/browse\/([A-Z][A-Z0-9_]+-\d+)$/);
          if (match) {
            return `/issue/${match[1]}`;
          }
        }
        // Host (and context path) matched but not a browse path.
        // Do not fall through to GitLab check — the Jira host matched,
        // so this is a Jira URL that we don't have an internal route for.
        return null;
      }
    }
  }

  // 3. Try GitLab MR mapping.
  if (ctx.gitlabBaseUrl) {
    const gitlabBase = normalizeBase(ctx.gitlabBaseUrl);
    if (gitlabBase) {
      if (url.origin === gitlabBase.origin) {
        const relPath = stripPathPrefix(url.pathname, gitlabBase.pathname);
        if (relPath !== null) {
          const pathname = relPath.replace(/\/$/, '');
          // Match paths of the form /group/repo/-/merge_requests/42
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
        }
        // GitLab host but not an MR URL — fall through to null.
        return null;
      }
    }
  }

  // 4. Nothing matched.
  return null;
}

/**
 * Parse a base URL into origin + pathname (the context path prefix).
 * Returns null if the URL is invalid.
 *
 * Trailing slashes on the pathname are preserved as a single "/" (root).
 * This is used to support Jira/GitLab instances installed at a context path
 * (e.g. company.com/jira instead of jira.company.com).
 */
function normalizeBase(baseUrl: string): URL | null {
  try {
    // Strip trailing slash — we'll add our own separator when comparing.
    const u = new URL(baseUrl.replace(/\/$/, ''));
    // Ensure the pathname ends without a trailing slash for consistent prefix matching.
    return u;
  } catch {
    return null;
  }
}

/**
 * Strip a base path prefix from a full URL pathname.
 *
 * Returns the remaining path (starting with `/`) if `pathname` starts with
 * `basePath`, or null if it does not.
 *
 * Examples:
 *   stripPathPrefix("/jira/browse/PROJ-1", "/jira") → "/browse/PROJ-1"
 *   stripPathPrefix("/browse/PROJ-1",       "/")    → "/browse/PROJ-1"
 *   stripPathPrefix("/other/path",           "/jira") → null
 */
function stripPathPrefix(pathname: string, basePath: string): string | null {
  // Normalize basePath: strip trailing slash if it's not the root.
  const base = basePath === '/' ? '' : basePath.replace(/\/$/, '');

  if (base === '') {
    // No context path (root installation) — pathname is the full relative path.
    return pathname;
  }

  // The pathname must start with the base path followed by "/" or end exactly.
  if (pathname === base) {
    // href is exactly the base URL with no additional path (e.g. "https://host/jira")
    return '/';
  }
  if (pathname.startsWith(base + '/')) {
    return pathname.slice(base.length);
  }

  return null;
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
