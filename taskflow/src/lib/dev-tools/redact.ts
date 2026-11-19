/**
 * Redaction helpers shared by apiFetch (capture), curl and the copy builders.
 * Pure; never throws.
 */

const SECRET_HEADERS = new Set([
  'authorization',
  'private-token',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
]);

const SECRET_HEADER_PATTERN = /token|secret|session|password/i;

const SECRET_URL_PARAMS =
  /([?&])(private_token|access_token|token|api_key|password|secret)=[^&#]*/gi;

export const REDACTED = '[REDACTED]';

function isSecretHeader(name: string): boolean {
  return SECRET_HEADERS.has(name.toLowerCase()) || SECRET_HEADER_PATTERN.test(name);
}

type HeaderInput = HeadersInit | Headers | Record<string, string> | undefined | null;

/** Normalises a Headers instance, tuple array or plain object into a redacted plain object. */
export function redactHeaders(input: HeaderInput): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;
  const put = (name: string, value: string) => {
    out[name] = isSecretHeader(name) ? REDACTED : value;
  };
  if (typeof Headers !== 'undefined' && input instanceof Headers) {
    input.forEach((value, name) => {
      put(name, value);
    });
  } else if (Array.isArray(input)) {
    for (const pair of input) {
      if (Array.isArray(pair) && pair.length >= 2) put(String(pair[0]), String(pair[1]));
    }
  } else {
    for (const [name, value] of Object.entries(input as Record<string, string>)) {
      put(name, String(value));
    }
  }
  return out;
}

/** Replaces the values of token-like query params with `REDACTED`. */
export function redactUrl(url: string): string {
  return url.replace(SECRET_URL_PARAMS, '$1$2=REDACTED');
}
