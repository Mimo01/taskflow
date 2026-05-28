/**
 * Entity-map utilities for the GreenHopper adapter foundation.
 *
 * Provides the pure builder `buildEntityMaps` (Phase 71 D-09: same input → same
 * output, no clones, no I/O, no state mutation) plus the five field resolvers
 * called per-issue by `adapter.ts` (Phase 71-05):
 *
 *   - resolveStatus / resolvePriority / resolveType  → D-07: required-resolvers,
 *     return a fallback `Unknown` shim on miss AND fire `console.warn` exactly
 *     ONCE per (kind, id) per session via the module-private `warnOnce` guard.
 *
 *   - resolveEpic / resolveParent                    → D-08: optional-resolvers,
 *     return `undefined` for missing input OR missing map entry, never warn.
 *
 * This module satisfies GH-ADAPT-02.
 *
 * Note: client.ts is NOT consumed here (Phase 71 D-06 — client is private to the
 * fetcher modules and is not re-exported through the package barrel).
 */

import type { EntityMaps, GhAllDataResponse } from './types';

/**
 * Build the four-map aggregate from a freshly-fetched allData response.
 *
 * Purity contract (D-09): returns the same input sub-objects by reference.
 * Same input → same output. No cloning, no spreading, no side effects.
 */
export function buildEntityMaps(allData: GhAllDataResponse): EntityMaps {
  return {
    statuses: allData.entityData.statuses,
    priorities: allData.entityData.priorities,
    types: allData.entityData.types,
    epics: allData.entityData.epics,
  };
}

// Module-level guard for warnOnce semantics (D-07).
const seenMissing = new Set<string>();

function warnOnce(kind: string, id: string): void {
  const key = `${kind}:${id}`;
  if (seenMissing.has(key)) return;
  seenMissing.add(key);
  console.warn(`[greenhopper] missing ${kind} id="${id}" — using Unknown fallback`);
}

/**
 * Test-only: clear the warnOnce guard between cases so each `it()` can
 * independently assert "two misses, one warn" behavior.
 *
 * Internal — not part of the public adapter surface.
 */
export function __resetWarnOnce(): void {
  seenMissing.clear();
}

type StatusCategoryKey = 'new' | 'indeterminate' | 'done';

function narrowStatusCategoryKey(raw: string): StatusCategoryKey {
  return raw === 'new' || raw === 'indeterminate' || raw === 'done' ? raw : 'indeterminate';
}

/**
 * Resolve a statusId to the UI-facing `Status` shape (D-07 required-resolver).
 * On miss: returns `{ id, name: 'Unknown', statusCategory: { key: 'indeterminate' } }`
 * and warns once per unique missing id.
 */
export function resolveStatus(
  id: string,
  maps: EntityMaps,
): { id: string; name: string; statusCategory: { key: StatusCategoryKey } } {
  const entry = maps.statuses[id];
  if (!entry) {
    warnOnce('status', id);
    return { id, name: 'Unknown', statusCategory: { key: 'indeterminate' } };
  }
  return {
    id,
    name: entry.status.name,
    statusCategory: { key: narrowStatusCategoryKey(entry.status.statusCategory.key) },
  };
}

/**
 * Resolve a priorityId to `{ id, name, iconUrl }` (D-07 required-resolver).
 * On miss: `{ id, name: 'Unknown', iconUrl: '' }` + warn-once.
 */
export function resolvePriority(
  id: string,
  maps: EntityMaps,
): { id: string; name: string; iconUrl: string } {
  const entry = maps.priorities[id];
  if (!entry) {
    warnOnce('priority', id);
    return { id, name: 'Unknown', iconUrl: '' };
  }
  return { id, name: entry.priorityName, iconUrl: entry.priorityUrl };
}

/**
 * Resolve a typeId to `{ id, name }` (D-07 required-resolver).
 * On miss: `{ id, name: 'Unknown' }` + warn-once.
 */
export function resolveType(id: string, maps: EntityMaps): { id: string; name: string } {
  const entry = maps.types[id];
  if (!entry) {
    warnOnce('type', id);
    return { id, name: 'Unknown' };
  }
  return { id, name: entry.typeName };
}

/**
 * Resolve an epicId (optional) to `{ id, key, name, color }` (D-08 optional-resolver).
 * Returns `undefined` for missing id OR missing map entry. Never warns.
 */
export function resolveEpic(
  id: number | undefined,
  maps: EntityMaps,
): { id: string; key: string; name: string; color: string } | undefined {
  if (id === undefined) return undefined;
  const key = String(id);
  const entry = maps.epics[key];
  if (!entry) return undefined;
  return {
    id: key,
    key: entry.epicField.epicKey,
    name: entry.epicField.text,
    color: entry.epicField.epicColor,
  };
}

/**
 * Resolve a parent reference (optional) to `{ id, key }` (D-08 optional-resolver).
 * Returns `undefined` unless BOTH parentId and parentKey are present. Never warns.
 */
export function resolveParent(
  parentId: number | undefined,
  parentKey: string | undefined,
): { id: string; key: string } | undefined {
  if (parentId === undefined || parentKey === undefined) return undefined;
  return { id: String(parentId), key: parentKey };
}
