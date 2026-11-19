/**
 * Pure helpers for rendering arbitrary values and large text safely in Developer Tools.
 */

/** JSON.stringify that survives Map, Set, BigInt and cycles. Never throws. */
export function safeStringify(value: unknown, space = 2): string {
  if (value === undefined) return 'undefined';
  try {
    const out = JSON.stringify(
      value,
      (_key, v: unknown) => {
        if (typeof v === 'bigint') return v.toString();
        if (v instanceof Map) return Object.fromEntries(v);
        if (v instanceof Set) return [...v];
        return v;
      },
      space,
    );
    return out === undefined ? String(value) : out;
  } catch {
    // Cycles (JSON.stringify throws a TypeError) and exotic values.
    return String(value);
  }
}

export function byteSize(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Caps rendered text at maxBytes. `totalBytes` is the full UTF-8 size. */
export function capText(
  text: string,
  maxBytes = 200_000,
): { text: string; truncated: boolean; totalBytes: number } {
  const totalBytes = byteSize(text);
  if (totalBytes <= maxBytes) return { text, truncated: false, totalBytes };
  return { text: text.slice(0, maxBytes), truncated: true, totalBytes };
}
