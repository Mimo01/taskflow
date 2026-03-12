/**
 * apiFetch — Instrumented fetch wrapper for Jira and GitLab API calls.
 *
 * - When debugMode is disabled: passes through to @tauri-apps/plugin-http fetch unchanged.
 * - When debugMode is enabled: captures method, URL, headers, status, duration, response body.
 *   Sanitizes Authorization and PRIVATE-TOKEN header values — replaces with "[REDACTED]".
 *
 * Uses getState() (not hooks) — safe to call outside React render context.
 */
import { fetch } from '@tauri-apps/plugin-http';
import { useSettingsStore } from '../stores/settings.store';
import { useDebugLogStore } from '../stores/debug-log.store';
import type { ApiLogEntry } from '../stores/debug-log.store';

/**
 * Instrumented fetch wrapper.
 * - When debugMode is disabled: passes through to @tauri-apps/plugin-http fetch unchanged.
 * - When debugMode is enabled: captures method, URL, headers, status, duration, response body.
 *   Sanitizes Authorization and PRIVATE-TOKEN header values — replaces with "[REDACTED]".
 *
 * @param source - 'jira' | 'gitlab' — identifies which service made the call
 * @param url    - Request URL
 * @param init   - Standard RequestInit options
 */
export async function apiFetch(
  source: 'jira' | 'gitlab',
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const { debugMode } = useSettingsStore.getState();

  if (!debugMode) {
    return fetch(url, init);
  }

  // Debug mode: instrument the call
  const start = performance.now();
  const method = init?.method ?? 'GET';

  // Sanitize headers for logging — redact auth values
  const rawHeaders = (init?.headers ?? {}) as Record<string, string>;
  const safeHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawHeaders)) {
    const lower = k.toLowerCase();
    if (lower === 'authorization' || lower === 'private-token') {
      safeHeaders[k] = '[REDACTED]';
    } else {
      safeHeaders[k] = v;
    }
  }

  let response: Response;
  let errorMsg: string | undefined;
  let status: number | null = null;
  let responseBody = '';

  try {
    response = await fetch(url, init);
    status = response.status;
    // Clone before reading so callers can still read the body
    const clone = response.clone();
    const text = await clone.text().catch(() => '');
    responseBody = text.length > 10_000 ? text.slice(0, 10_000) + '\n[truncated]' : text;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    errorMsg = err instanceof Error ? err.message : String(err);
    const entry: ApiLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      source,
      method,
      url,
      requestHeaders: safeHeaders,
      status: null,
      durationMs,
      responseBody: '',
      error: errorMsg,
    };
    useDebugLogStore.getState().append(entry);
    throw err; // re-throw so callers still get the network error
  }

  const durationMs = Math.round(performance.now() - start);
  const entry: ApiLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source,
    method,
    url,
    requestHeaders: safeHeaders,
    status,
    durationMs,
    responseBody,
  };
  useDebugLogStore.getState().append(entry);

  return response;
}
