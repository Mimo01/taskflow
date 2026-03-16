/**
 * ApiError — preserves HTTP status and source service for auth detection.
 *
 * Used by jira.ts and gitlab.ts to throw structured errors on 401/403.
 * Consumed by ErrorState component to auto-detect auth failures and
 * render the appropriate Reconnect CTA.
 */

export class ApiError extends Error {
  status: number;
  source: 'jira' | 'gitlab';

  constructor(message: string, status: number, source: 'jira' | 'gitlab') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.source = source;
  }
}

/**
 * Detect whether an error represents an authentication/authorization failure.
 *
 * Checks in order:
 * 1. ApiError with status 401 or 403
 * 2. Any object with a numeric .status of 401 or 403 (raw Response shape)
 * 3. Error.message containing "401", "403", or "token has expired"
 */
export function isAuthError(error: unknown): boolean {
  if (error == null) return false;

  // ApiError or any object with numeric status
  if (typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === 'number') {
      return status === 401 || status === 403;
    }
  }

  // Message heuristic for plain Error objects
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (/\b(401|403)\b/.test(msg)) return true;
    if (msg.includes('token has expired')) return true;
    if (msg.includes('lacks required permissions')) return true;
  }

  return false;
}

/**
 * Extract the service source from an ApiError, or null for other error types.
 */
export function getErrorSource(error: unknown): 'jira' | 'gitlab' | null {
  if (error instanceof ApiError) {
    return error.source;
  }
  return null;
}
