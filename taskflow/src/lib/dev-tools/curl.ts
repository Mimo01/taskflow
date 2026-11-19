/**
 * Build a copy-pasteable cURL command from a captured log entry.
 *
 * Capture already replaces Authorization/PRIVATE-TOKEN values with "[REDACTED]", so tokens are
 * emitted as double-quoted env-var placeholders ($JIRA_TOKEN, $GITLAB_TOKEN, $AIO_TOKEN, …). As defence in depth, other
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

/** Env var each source's PAT is expected in when the command is pasted into a shell. */
const TOKEN_VAR: Record<ApiLogEntry['source'], string> = {
  jira: 'JIRA_TOKEN',
  gitlab: 'GITLAB_TOKEN',
  aio: 'AIO_TOKEN',
  tempo: 'TEMPO_TOKEN',
  updater: 'UPDATER_TOKEN',
};

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
      // Double quotes so the shell expands the env var (single quotes would send it literally).
      parts.push(`-H "Authorization: Bearer $${TOKEN_VAR[entry.source]}"`);
    } else if (lower === 'private-token') {
      parts.push('-H "PRIVATE-TOKEN: $GITLAB_TOKEN"');
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
