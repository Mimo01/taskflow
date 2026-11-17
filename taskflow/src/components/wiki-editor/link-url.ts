const SAFE_SCHEME = /^(https?:\/\/|mailto:)/i;
const UNSAFE_CHARS = /[\s|\]]/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const HOST_LIKE = /^[\w-]+(\.[\w-]+)+([/?#].*)?$/;

/** Exact-string allowlist: http(s)/mailto only, nothing that would break `[text|url]` markup. */
export function isSafeLinkUrl(url: string): boolean {
  return url.length > 0 && SAFE_SCHEME.test(url) && !UNSAFE_CHARS.test(url);
}

export function normalizeLinkUrl(input: string): string | null {
  const trimmed = input.trim();
  const candidate =
    !SCHEME.test(trimmed) && HOST_LIKE.test(trimmed) ? `https://${trimmed}` : trimmed;
  return isSafeLinkUrl(candidate) ? candidate : null;
}
