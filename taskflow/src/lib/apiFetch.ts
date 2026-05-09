/**
 * apiFetch — Instrumented fetch wrapper for Jira and GitLab API calls.
 *
 * - When devToolsEnabled is disabled: passes through to @tauri-apps/plugin-http fetch unchanged.
 * - When devToolsEnabled is enabled: captures method, URL, headers, status, duration, response body
 *   based on granular toggle settings (requestLogging, responseBodyCapture, operationProfiling).
 *   Sanitizes Authorization and PRIVATE-TOKEN header values — replaces with "[REDACTED]".
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
import type { FetchRecord } from '../stores/operation-profiler.store';
import { useOperationProfilerStore } from '../stores/operation-profiler.store';
import { useSettingsStore } from '../stores/settings.store';

function markDisconnected(source: 'jira' | 'gitlab') {
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
 * @param operation - Optional operation label for grouping fetches in the profiler
 */
export async function apiFetch(
  source: 'jira' | 'gitlab',
  url: string,
  init?: RequestInit,
  operation?: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  // Merge caller's signal with the timeout signal so EITHER can cancel the call
  const signal = init?.signal
    ? AbortSignal.any([controller.signal, init.signal])
    : controller.signal;

  const initWithSignal: RequestInit = { ...init, signal };

  const { devToolsEnabled, requestLogging, responseBodyCapture, operationProfiling } =
    useSettingsStore.getState();

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

  let response: Response;
  let errorMsg: string | undefined;
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
        const pretty = JSON.stringify(JSON.parse(text), null, 2);
        responseBody = pretty.length > 10_000 ? `${pretty.slice(0, 10_000)}\n[truncated]` : pretty;
      } catch {
        responseBody = text.length > 10_000 ? `${text.slice(0, 10_000)}\n[truncated]` : text;
      }
    }
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    errorMsg = err instanceof Error ? err.message : String(err);

    if (requestLogging) {
      const entry: ApiLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source,
        method,
        url,
        requestHeaders: safeHeaders,
        requestBody,
        status: null,
        durationMs,
        responseBody: '',
        error: errorMsg,
        operation,
      };
      useDebugLogStore.getState().append(entry);
    }

    if (operationProfiling) {
      const fetchRecord: FetchRecord = {
        id: crypto.randomUUID(),
        source,
        method,
        url,
        status: null,
        durationMs,
        startTime: start,
        responseSize: 0,
        error: errorMsg,
      };
      useOperationProfilerStore.getState().addFetch(operation, fetchRecord);
    }

    // Network errors (timeout, DNS failure, etc.) do NOT mark disconnected.
    // Only a 401 response means credentials are invalid.
    throw err; // re-throw so callers still get the network error
  } finally {
    clearTimeout(timer);
  }

  const durationMs = Math.round(performance.now() - start);

  if (requestLogging) {
    const entry: ApiLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      source,
      method,
      url,
      requestHeaders: safeHeaders,
      requestBody,
      status,
      durationMs,
      responseBody,
      operation,
    };
    useDebugLogStore.getState().append(entry);
  }

  if (operationProfiling) {
    // Capture response size from content-length header, or from already-read body text length
    let responseSize: number | undefined;
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const parsed = Number.parseInt(contentLength, 10);
      if (!Number.isNaN(parsed)) responseSize = parsed;
    } else if (responseBodyCapture && responseBody.length > 0) {
      responseSize = responseBody.length;
    }

    const fetchRecord: FetchRecord = {
      id: crypto.randomUUID(),
      source,
      method,
      url,
      status,
      durationMs,
      startTime: start,
      responseSize,
    };
    useOperationProfilerStore.getState().addFetch(operation, fetchRecord);
  }

  if (response.status === 401) markDisconnected(source);
  return response;
}
