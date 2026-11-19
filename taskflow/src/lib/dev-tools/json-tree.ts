/**
 * Pure JSON tree model for the Developer Tools JsonTree viewer: guarded parsing, path formatting,
 * node summaries and search matching. No React, no DOM.
 */
import { byteSize } from './json-preview';

export const MAX_TREE_BYTES = 1_000_000;
export const ARRAY_PAGE = 100;
export const DEFAULT_EXPAND_DEPTH = 2;

export type JsonPath = readonly (string | number)[];

export type ParsedBody =
  | { kind: 'json'; value: unknown }
  | { kind: 'text'; reason: 'invalid' | 'too-large' | 'empty' };

/** Parses a body for tree display. Oversized text is rejected before JSON.parse runs. */
export function parseJsonBody(text: string): ParsedBody {
  if (text.trim() === '') return { kind: 'text', reason: 'empty' };
  if (byteSize(text) > MAX_TREE_BYTES) return { kind: 'text', reason: 'too-large' };
  try {
    return { kind: 'json', value: JSON.parse(text) as unknown };
  } catch {
    return { kind: 'text', reason: 'invalid' };
  }
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** `fields.status.name`, `issues[3].key`, `[0].id`, `["weird key"]`; the root is `$`. */
export function formatJsonPath(path: JsonPath): string {
  if (path.length === 0) return '$';
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') {
      out += `[${seg}]`;
    } else if (IDENTIFIER.test(seg)) {
      out += out === '' ? seg : `.${seg}`;
    } else {
      out += `[${JSON.stringify(seg)}]`;
    }
  }
  return out;
}

/** Stable id for a path. */
export function pathKey(path: JsonPath): string {
  return JSON.stringify(path);
}

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

/** Collapsed-node summary such as `{…} 12 keys` or `[…] 50 items`. */
export function nodeSummary(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[] empty';
    return `[…] ${value.length} ${value.length === 1 ? 'item' : 'items'}`;
  }
  if (isContainer(value)) {
    const n = Object.keys(value).length;
    if (n === 0) return '{} empty';
    return `{…} ${n} ${n === 1 ? 'key' : 'keys'}`;
  }
  return String(value);
}

export interface JsonMatches {
  matches: Set<string>;
  expand: Set<string>;
  count: number;
  capped: boolean;
}

/**
 * Case-insensitive substring search over keys and stringified primitives. `matches` holds the
 * pathKeys of matching nodes, `expand` every ancestor container of every match (root included).
 */
export function findJsonMatches(value: unknown, needle: string, limit = 500): JsonMatches {
  const result: JsonMatches = { matches: new Set(), expand: new Set(), count: 0, capped: false };
  const q = needle.toLowerCase();
  if (q === '') return result;

  const record = (path: (string | number)[]) => {
    if (result.count >= limit) {
      result.capped = true;
      return;
    }
    result.count++;
    result.matches.add(pathKey(path));
    for (let i = 0; i < path.length; i++) result.expand.add(pathKey(path.slice(0, i)));
  };

  const walk = (node: unknown, path: (string | number)[]) => {
    if (result.capped) return;
    if (Array.isArray(node)) {
      node.forEach((child, i) => {
        walk(child, [...path, i]);
      });
    } else if (isContainer(node)) {
      for (const [k, child] of Object.entries(node)) {
        const childPath = [...path, k];
        if (k.toLowerCase().includes(q)) record(childPath);
        walk(child, childPath);
      }
    } else if (String(node).toLowerCase().includes(q)) {
      record(path);
    }
  };
  walk(value, []);
  return result;
}

/** pathKeys of every object and array; descends only into the first ARRAY_PAGE array children. */
export function collectContainerKeys(value: unknown, maxNodes = 5000): Set<string> {
  const keys = new Set<string>();
  const walk = (node: unknown, path: (string | number)[]) => {
    if (keys.size >= maxNodes || !isContainer(node)) return;
    keys.add(pathKey(path));
    if (Array.isArray(node)) {
      node.slice(0, ARRAY_PAGE).forEach((child, i) => {
        walk(child, [...path, i]);
      });
    } else {
      for (const [k, child] of Object.entries(node)) walk(child, [...path, k]);
    }
  };
  walk(value, []);
  return keys;
}
