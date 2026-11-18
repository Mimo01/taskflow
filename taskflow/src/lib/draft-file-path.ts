// Shape of a staged draft file path: issue-drafts/<draftId>/<one file segment>.
// Dependency-free so both the drafts store (rehydrate) and the fs helpers can use it.
const DRAFT_FILE_PATH_RE = /^issue-drafts\/[A-Za-z0-9-]+\/[^/\\]+$/;

/** True only for a path inside one draft's directory, never '..' or nested segments. */
export function isDraftFilePath(path: unknown): path is string {
  if (typeof path !== 'string' || !DRAFT_FILE_PATH_RE.test(path)) return false;
  const file = path.slice(path.lastIndexOf('/') + 1);
  return file !== '.' && file !== '..';
}
