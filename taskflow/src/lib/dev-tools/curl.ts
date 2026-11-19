/**
 * Build a copy-pasteable cURL command from a captured log entry.
 *
 * Capture already replaces Authorization/PRIVATE-TOKEN values with "[REDACTED]", so tokens are
 * emitted as env-var placeholders ($JIRA_TOKEN / $GITLAB_TOKEN). As defence in depth, other
 * secret-bearing headers are dropped and token-like URL params are scrubbed.
 */
import type { ApiLogEntry } from '../../stores/debug-log.store';

const DROPPED_HEADERS = new Set([
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'proxy-authorization',
]);

const SECRET_URL_PARAMS = /([?&])(private_token|access_token|token|api_key)=[^&#]*/gi;

function sq(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildCurl(entry: ApiLogEntry): string {
  const parts: string[] = [];
  if (entry.method !== 'GET') parts.push(`-X ${sq(entry.method)}`);

  for (const [name, value] of Object.entries(entry.requestHeaders)) {
    const lower = name.toLowerCase();
    if (DROPPED_HEADERS.has(lower)) continue;
    if (lower === 'authorization') {
      const token = entry.source === 'gitlab' ? '$GITLAB_TOKEN' : '$JIRA_TOKEN';
      parts.push(`-H ${sq(`Authorization: Bearer ${token}`)}`);
    } else if (lower === 'private-token') {
      parts.push(`-H ${sq('PRIVATE-TOKEN: $GITLAB_TOKEN')}`);
    } else {
      parts.push(`-H ${sq(`${name}: ${value}`)}`);
    }
  }

  let prefix = '';
  if (entry.requestBody) {
    if (entry.requestBody.endsWith('[truncated]')) {
      prefix = '# request body truncated in log\n';
    } else {
      parts.push(`--data-raw ${sq(entry.requestBody)}`);
    }
  }

  const url = entry.url.replace(SECRET_URL_PARAMS, '$1$2=REDACTED');
  parts.push(sq(url));
  return `${prefix}curl ${parts.join(' \\\n  ')}`;
}
