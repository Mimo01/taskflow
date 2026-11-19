/**
 * Parses a URL's query string into ordered key/value rows for the log inspector.
 */

function decode(part: string): string {
  const spaced = part.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(spaced);
  } catch {
    // Malformed percent sequence: keep the raw text.
    return spaced;
  }
}

/** Keeps order and duplicates; returns [] when there is no query. */
export function parseQueryParams(url: string): [string, string][] {
  const qIdx = url.indexOf('?');
  if (qIdx === -1) return [];
  let query = url.slice(qIdx + 1);
  const hash = query.indexOf('#');
  if (hash !== -1) query = query.slice(0, hash);
  if (query === '') return [];
  const rows: [string, string][] = [];
  for (const pair of query.split('&')) {
    if (pair === '') continue;
    const eq = pair.indexOf('=');
    if (eq === -1) rows.push([decode(pair), '']);
    else rows.push([decode(pair.slice(0, eq)), decode(pair.slice(eq + 1))]);
  }
  return rows;
}
