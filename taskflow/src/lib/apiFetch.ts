/**
 * apiFetch — Instrumented fetch wrapper for Jira and GitLab API calls.
 *
 * - When devToolsEnabled is disabled: passes through to @tauri-apps/plugin-http fetch unchanged.
 * - When devToolsEnabled is enabled: captures method, URL, headers, status, duration, response body
 *   based on granular toggle settings (requestLogging, responseBodyCapture). The log entry is
 *   appended when the request STARTS (state 'pending') and patched in place on completion.
 *   Logging never throws into the request path.
 *   Request and response headers go through redactHeaders (Authorization, PRIVATE-TOKEN, cookies and
 *   other secret-bearing headers become "[REDACTED]").
 *
 * Uses getState() (not hooks) — safe to call outside React render context.
 *
 * Every call is subject to a 15-second timeout. If the network does not respond
 * within API_TIMEOUT_MS the AbortController fires, fetch rejects with an AbortError,
 * and the error is re-thrown so existing callers surface the failure correctly.
 */
import { fetch } from '@tauri-apps/plugin-http';
import { useAuthStore } from '../stores/auth.store';
import type { ApiLogEntry } from '../stores/debug-log.store';
import { useDebugLogStore } from '../stores/debug-log.store';
import { useSettingsStore } from '../stores/settings.store';
import { currentRoute, nowMs } from './dev-tools/log-entry';
import { meaningfulQueuedAt, takeQueuedAt } from './dev-tools/queue-handoff';
import { redactHeaders } from './dev-tools/redact';

function markDisconnected(source: 'jira' | 'gitlab' | 'aio' | 'updater' | 'tempo') {
  if (source === 'aio' || source === 'updater' || source === 'tempo') return;
  const auth = useAuthStore.getState();
  if (source === 'gitlab') auth.setGitlabConnected(false);
  else auth.setJiraConnected(false);
}

const API_TIMEOUT_MS = 15_000;

/**
 * Instrumented fetch wrapper.
 * - When devToolsEnabled is disabled: passes through to @tauri-apps/plugin-http fetch unchanged.
 * - When devToolsEnabled is enabled: instruments the call based on granular toggles.
 *
 * @param source    - 'jira' | 'gitlab' — identifies which service made the call
 * @param url       - Request URL
 * @param init      - Standard RequestInit options
 * @param operation - Optional operation label shown (and filterable) in the Developer Tools Logs tab
 */
export async function apiFetch(
  source: 'jira' | 'gitlab' | 'aio' | 'updater' | 'tempo',
  url: string,
  init?: RequestInit,
  operation?: string,
): Promise<Response> {
  // Must be the first statement (before any await): consumes the limiter's queue-time handoff so it
  // can never leak to an unrelated call, even when dev tools are off.
  const queuedAt = takeQueuedAt();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  // Merge caller's signal with the timeout signal so EITHER can cancel the call
  const signal = init?.signal
    ? AbortSignal.any([controller.signal, init.signal])
    : controller.signal;

  const initWithSignal: RequestInit = { ...init, signal };

  const { devToolsEnabled, requestLogging, responseBodyCapture } = useSettingsStore.getState();

  if (!devToolsEnabled) {
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

  // Dev tools enabled: instrument the call
  const startedAt = nowMs();
  const waitedSince = meaningfulQueuedAt(queuedAt, startedAt);
  const method = init?.method ?? 'GET';

  // Sanitize headers for logging (handles Headers, tuple and plain-object inits)
  const safeHeaders = redactHeaders(init?.headers);

  // Capture request body for logging when requestLogging is enabled
  let requestBody: string | undefined;
  if (requestLogging && init?.body != null) {
    const raw = typeof init.body === 'string' ? init.body : String(init.body);
    try {
      const pretty = JSON.stringify(JSON.parse(raw), null, 2);
      requestBody = pretty.length > 5_000 ? `${pretty.slice(0, 5_000)}\n[truncated]` : pretty;
    } catch {
      requestBody = raw.length > 5_000 ? `${raw.slice(0, 5_000)}\n[truncated]` : raw;
    }
  }

  const entryId = crypto.randomUUID();
  // Append the pending entry before fetch so in-flight requests are visible.
  if (requestLogging) {
    try {
      useDebugLogStore.getState().append({
        id: entryId,
        timestamp: new Date().toISOString(),
        source,
        method,
        url,
        requestHeaders: safeHeaders,
        requestBody,
        status: null,
        durationMs: 0,
        responseBody: '',
        operation,
        state: 'pending',
        startedAt,
        route: currentRoute(),
        ...(waitedSince !== undefined ? { queuedAt: waitedSince } : {}),
      });
    } catch {
      // logging must never break the request
    }
  }

  const patchEntry = (patch: Partial<ApiLogEntry>) => {
    if (!requestLogging) return;
    try {
      useDebugLogStore.getState().update(entryId, patch);
    } catch {
      // logging must never break the request
    }
  };

  let response: Response;
  let status: number | null = null;
  let responseBody = '';

  try {
    response = await fetch(url, initWithSignal);
    status = response.status;

    // Only clone and read response body if responseBodyCapture is enabled
    if (responseBodyCapture) {
      const clone = response.clone();
      const text = await clone.text().catch(() => '');
      try {
        responseBody = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        responseBody = text;
      }
    }
  } catch (err) {
    const endedAt = nowMs();
    patchEntry({
      state: 'error',
      status: null,
      durationMs: Math.round(endedAt - startedAt),
      endedAt,
      error: err instanceof Error ? err.message : String(err),
    });

    // Network errors (timeout, DNS failure, etc.) do NOT mark disconnected.
    // Only a 401 response means credentials are invalid.
    throw err; // re-throw so callers still get the network error
  } finally {
    clearTimeout(timer);
  }

  const endedAt = nowMs();
  if (requestLogging) {
    let responseHeaders: Record<string, string> | undefined;
    try {
      responseHeaders = redactHeaders(response.headers);
    } catch {
      responseHeaders = undefined;
    }
    patchEntry({
      state: 'done',
      status,
      durationMs: Math.round(endedAt - startedAt),
      endedAt,
      responseBody,
      responseHeaders,
    });
  }

  if (response.status === 401) markDisconnected(source);
  return response;
}
