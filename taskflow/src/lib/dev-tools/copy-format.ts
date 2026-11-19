/**
 * Builders for the Developer Tools copy actions: redacted entry JSON and bug-report Markdown.
 * Capture already redacts secrets; everything here redacts again as defence in depth.
 */
import type { ApiLogEntry } from '../../stores/debug-log.store';
import { capText } from './json-preview';
import { isPending } from './log-entry';
import { urlPath } from './log-stats';
import { queueSplit } from './queue-handoff';
import { redactHeaders, redactUrl } from './redact';

/** JSON value when the text parses, otherwise the raw string. */
function bodyValue(text: string | undefined): unknown {
  if (text === undefined || text === '') return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function redactedEntry(entry: ApiLogEntry): Record<string, unknown> {
  const { requestHeaders, responseHeaders, requestBody, responseBody, url, ...rest } = entry;
  const out: Record<string, unknown> = { ...rest, url: redactUrl(url) };
  out.requestHeaders = redactHeaders(requestHeaders);
  if (responseHeaders) out.responseHeaders = redactHeaders(responseHeaders);
  if (requestBody !== undefined) out.requestBody = bodyValue(requestBody);
  out.responseBody = bodyValue(responseBody);
  return out;
}

export function entryToJson(entry: ApiLogEntry): string {
  return JSON.stringify(redactedEntry(entry), null, 2);
}

export function entriesToJson(entries: ApiLogEntry[]): string {
  return JSON.stringify(entries.map(redactedEntry), null, 2);
}

/** A code fence longer than any backtick run inside the content. */
function fence(content: string, lang: string): string {
  let longest = 0;
  for (const run of content.match(/`+/g) ?? []) longest = Math.max(longest, run.length);
  const ticks = '`'.repeat(Math.max(3, longest + 1));
  return `${ticks}${lang}\n${content}\n${ticks}`;
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Bug-report-ready Markdown block for one entry. */
export function entryToMarkdown(entry: ApiLogEntry, maxResponseBytes = 4096): string {
  const url = redactUrl(entry.url);
  const pending = isPending(entry);
  const status = pending ? 'pending' : entry.status === null ? 'ERR' : String(entry.status);
  const lines: string[] = [
    `### ${entry.method} ${urlPath(url)} → ${status}`,
    '',
    `- URL: ${url}`,
    `- Status: ${status}`,
  ];
  if (!pending) lines.push(`- Duration: ${entry.durationMs} ms`);
  const { queuedMs } = queueSplit(entry);
  if (queuedMs !== null) lines.push(`- Queued ${queuedMs} ms`);
  lines.push(`- Time: ${entry.timestamp}`, `- Source: ${entry.source}`);
  if (entry.operation) lines.push(`- Operation: ${entry.operation}`);
  if (entry.error) lines.push(`- Error: ${entry.error}`);

  if (entry.requestBody) {
    lines.push('', '**Request body**', '', fence(entry.requestBody, 'json'));
  }

  lines.push('', '**Response**', '');
  if (pending) {
    lines.push('_Waiting for response_');
  } else if (entry.responseBody) {
    const capped = capText(entry.responseBody, maxResponseBytes);
    const body = capped.truncated
      ? `${capped.text}\n… truncated (${kb(capped.totalBytes)} total)`
      : capped.text;
    lines.push(fence(body, 'json'));
  } else {
    lines.push('_Response body not captured_');
  }
  return lines.join('\n');
}
