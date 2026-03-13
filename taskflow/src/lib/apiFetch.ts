/**
 * apiFetch — Instrumented fetch wrapper for Jira and GitLab API calls.
 *
 * - When debugMode is disabled: passes through to @tauri-apps/plugin-http fetch unchanged.
 * - When debugMode is enabled: captures method, URL, headers, status, duration, response body.
 *   Sanitizes Authorization and PRIVATE-TOKEN header values — replaces with "[REDACTED]".
 *
 * Uses getState() (not hooks) — safe to call outside React render context.
 *
 * Every call is subject to a 15-second timeout. If the network does not respond
 * within API_TIMEOUT_MS the AbortController fires, fetch rejects with an AbortError,
 * and the error is re-thrown so existing callers surface the failure correctly.
 */
import { fetch } from '@tauri-apps/plugin-http';
import { useSettingsStore } from '../stores/settings.store';
import { useDebugLogStore } from '../stores/debug-log.store';
import type { ApiLogEntry } from '../stores/debug-log.store';
import { useAuthStore } from '../stores/auth.store';

function markDisconnected(source: 'jira' | 'gitlab') {
  const auth = useAuthStore.getState();
  if (source === 'gitlab') auth.setGitlabConnected(false);
  else auth.setJiraConnected(false);
}

const API_TIMEOUT_MS = 15_000;

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  // Merge caller's signal with the timeout signal so EITHER can cancel the call
  const signal = init?.signal
    ? AbortSignal.any([controller.signal, init.signal])
    : controller.signal;

  const initWithSignal: RequestInit = { ...init, signal };

  const { debugMode } = useSettingsStore.getState();

  if (!debugMode) {
    let response: Response;
    try {
      response = await fetch(url, initWithSignal);
    } catch (err) {
      clearTimeout(timer);
      // Network errors (timeout, DNS failure, etc.) do NOT mark disconnected.
      // Only a 401 response means credentials are invalid.
      throw err;
    }
    clearTimeout(timer);
    if (response.status === 401) markDisconnected(source);
    return response;
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
    response = await fetch(url, initWithSignal);
    status = response.status;
    // Clone before reading so callers can still read the body
    const clone = response.clone();
    const text = await clone.text().catch(() => '');
    try {
      const pretty = JSON.stringify(JSON.parse(text), null, 2);
      responseBody = pretty.length > 10_000 ? pretty.slice(0, 10_000) + '\n[truncated]' : pretty;
    } catch {
      responseBody = text.length > 10_000 ? text.slice(0, 10_000) + '\n[truncated]' : text;
    }
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
    // Network errors (timeout, DNS failure, etc.) do NOT mark disconnected.
    // Only a 401 response means credentials are invalid.
    throw err; // re-throw so callers still get the network error
  } finally {
    clearTimeout(timer);
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

  if (response.status === 401) markDisconnected(source);
  return response;
}
