/**
 * Flatten a single Jira error-body candidate value into a readable string,
 * or `undefined` when the candidate is missing/null or flattens to an empty
 * string.
 *
 * Mirrors `flattenErrorCandidate` in `services/gitlab.ts`, but with Jira's
 * own separator conventions: `errorMessages` entries are joined with `'; '`
 * (they are already whole sentences), and `errors` object entries are
 * rendered `field: detail` joined with `'; '` (GitLab uses `field detail`
 * with no colon — do not unify the two).
 */
function flattenErrorMessages(candidate: unknown): string | undefined {
  if (candidate === undefined || candidate === null) return undefined;

  let flat: string | undefined;
  if (typeof candidate === 'string') {
    flat = candidate;
  } else if (Array.isArray(candidate)) {
    flat = candidate.join('; ');
  }

  return flat !== undefined && flat.length > 0 ? flat : undefined;
}

function flattenErrorsObject(candidate: unknown): string | undefined {
  if (
    candidate === undefined ||
    candidate === null ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate)
  ) {
    return undefined;
  }

  const flat = Object.entries(candidate as Record<string, unknown>)
    .map(([field, detail]) => {
      const detailStr = Array.isArray(detail)
        ? detail.join(', ')
        : typeof detail === 'string'
          ? detail
          : JSON.stringify(detail);
      return `${field}: ${detailStr}`;
    })
    .join('; ');

  return flat.length > 0 ? flat : undefined;
}

/**
 * Normalise a Jira API error body into a single readable string. Jira sibling
 * of `flattenGitLabError` (`services/gitlab.ts`) — closes the same class of
 * bug (WR-01) on the Jira side.
 *
 * Jira splits error bodies across two keys: `errorMessages: string[]` for
 * top-level failures, and a separate `errors` object (`{field: detail}`) for
 * field-validation failures — with `errorMessages` left empty in that case.
 * Every existing call site read only `errorMessages?.[0]`, silently
 * discarding field-validation reasons. This helper prefers `errorMessages`
 * and falls back to flattening `errors` when `errorMessages` is missing,
 * null, or flattens to empty.
 *
 * An empty flatten (`[]`, `{}`, `''`) must resolve to `undefined`, never
 * `''` — an empty string is falsy but not nullish, so it sails through every
 * caller's `?? 'literal'` fallback and produces a message ending in a bare
 * colon (the same WR-01 trap `flattenGitLabError` guards against).
 *
 * Do not reinvent a narrower widening at a call site — route all Jira error
 * bodies through this helper.
 *
 * @param body - The parsed JSON error body (or `null`/non-object)
 * @returns A readable message, or `undefined` when neither `errorMessages`
 *          nor `errors` yields a non-empty flattened string
 */
export function flattenJiraError(body: unknown): string | undefined {
  if (body === null || typeof body !== 'object') return undefined;
  const { errorMessages, errors } = body as { errorMessages?: unknown; errors?: unknown };
  return flattenErrorMessages(errorMessages) ?? flattenErrorsObject(errors);
}
