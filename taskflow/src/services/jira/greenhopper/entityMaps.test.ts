/**
 * Tests for entityMaps.ts — buildEntityMaps + resolvers + warnOnce.
 *
 * Coverage matrix (from Phase 71 D-07/D-08/D-09 + 71-PATTERNS.md):
 *   1. buildEntityMaps returns all four maps populated (real-capture fixture)
 *   2. resolveStatus hit → named status
 *   3. resolveStatus miss → Unknown fallback + one warn
 *   4. Two consecutive misses → ONE warn (warnOnce)
 *   5. resolvePriority / resolveType mirror status (hit + miss + warnOnce)
 *   6. resolveEpic(undefined) → undefined, no warn (D-08)
 *   7. resolveEpic(missing id) → undefined, no warn (D-08)
 *   8. resolveEpic(known id) → populated shape
 *   9. resolveParent(undefined,undefined) → undefined; (id,key) → shape
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import allData from './__fixtures__/allData.real.json';
import {
  buildEntityMaps,
  resolveStatus,
  resolvePriority,
  resolveType,
  resolveEpic,
  resolveParent,
  __resetWarnOnce,
} from './entityMaps';
import type { GhAllDataResponse } from './types';

const typed = allData as unknown as GhAllDataResponse;
const maps = buildEntityMaps(typed);

const KNOWN_STATUS_ID = Object.keys(typed.entityData.statuses)[0];
const KNOWN_PRIORITY_ID = Object.keys(typed.entityData.priorities)[0];
const KNOWN_TYPE_ID = Object.keys(typed.entityData.types)[0];
const KNOWN_EPIC_ID = Number(Object.keys(typed.entityData.epics)[0]);

describe('entityMaps', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __resetWarnOnce();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('buildEntityMaps returns all four maps populated', () => {
    expect(Object.keys(maps.statuses).length).toBeGreaterThan(0);
    expect(Object.keys(maps.priorities).length).toBeGreaterThan(0);
    expect(Object.keys(maps.types).length).toBeGreaterThan(0);
    expect(Object.keys(maps.epics).length).toBeGreaterThan(0);
    // reference equality (no clone) per D-09 purity
    expect(maps.statuses).toBe(typed.entityData.statuses);
  });

  it('resolveStatus returns named status on hit (no warn)', () => {
    const result = resolveStatus(KNOWN_STATUS_ID, maps);
    expect(result.id).toBe(KNOWN_STATUS_ID);
    expect(result.name).toBe(typed.entityData.statuses[KNOWN_STATUS_ID].status.name);
    expect(['new', 'indeterminate', 'done']).toContain(result.statusCategory.key);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('resolveStatus on miss returns Unknown fallback and warns once', () => {
    const result = resolveStatus('999-missing', maps);
    expect(result).toEqual({
      id: '999-missing',
      name: 'Unknown',
      statusCategory: { key: 'indeterminate' },
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('two consecutive resolveStatus misses produce ONE warn (warnOnce)', () => {
    resolveStatus('999-missing', maps);
    resolveStatus('999-missing', maps);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('resolvePriority hit returns named priority; miss warns and shims', () => {
    const hit = resolvePriority(KNOWN_PRIORITY_ID, maps);
    expect(hit.id).toBe(KNOWN_PRIORITY_ID);
    expect(hit.name).toBe(typed.entityData.priorities[KNOWN_PRIORITY_ID].priorityName);
    expect(hit.iconUrl).toBe(typed.entityData.priorities[KNOWN_PRIORITY_ID].priorityUrl);
    expect(warnSpy).not.toHaveBeenCalled();

    const miss = resolvePriority('p-missing', maps);
    expect(miss).toEqual({ id: 'p-missing', name: 'Unknown', iconUrl: '' });
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Second miss with same id is silent
    resolvePriority('p-missing', maps);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('resolveType hit returns named type; miss warns and shims', () => {
    const hit = resolveType(KNOWN_TYPE_ID, maps);
    expect(hit.id).toBe(KNOWN_TYPE_ID);
    expect(hit.name).toBe(typed.entityData.types[KNOWN_TYPE_ID].typeName);
    expect(warnSpy).not.toHaveBeenCalled();

    const miss = resolveType('t-missing', maps);
    expect(miss).toEqual({ id: 't-missing', name: 'Unknown' });
    expect(warnSpy).toHaveBeenCalledTimes(1);

    resolveType('t-missing', maps);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('resolveEpic(undefined) returns undefined with no warn (D-08)', () => {
    expect(resolveEpic(undefined, maps)).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('resolveEpic(missing id) returns undefined with no warn (D-08)', () => {
    expect(resolveEpic(99999, maps)).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('resolveEpic(known id) returns populated shape from fixture', () => {
    const entry = typed.entityData.epics[String(KNOWN_EPIC_ID)];
    expect(resolveEpic(KNOWN_EPIC_ID, maps)).toEqual({
      id: String(KNOWN_EPIC_ID),
      key: entry.epicField.epicKey,
      name: entry.epicField.text,
      color: entry.epicField.epicColor,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('resolveParent: undefined inputs → undefined; both present → shape', () => {
    expect(resolveParent(undefined, undefined)).toBeUndefined();
    expect(resolveParent(123, undefined)).toBeUndefined();
    expect(resolveParent(undefined, 'PROJ-7')).toBeUndefined();
    expect(resolveParent(123, 'PROJ-7')).toEqual({ id: '123', key: 'PROJ-7' });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
