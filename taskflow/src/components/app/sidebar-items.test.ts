/**
 * G2 — REMOVE-01 / D-02: Absence guard for Workload sidebar nav item.
 *
 * Source-string assertion rationale: the requirement being verified is a deletion —
 * "workload entry must not exist in SIDEBAR_NAV_ITEMS or the pmVisible preset Set".
 * Both a runtime import check (against the live exported array) and a source-string
 * check (against the file text) are used — the runtime check catches structural
 * re-introduction, the source-string check catches any literal string re-introduction.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SIDEBAR_NAV_ITEMS, getDefaultSidebarItems } from './sidebar-items';

const SIDEBAR_FILE = path.resolve(__dirname, 'sidebar-items.ts');

describe('sidebar-items — workload entry absence guard (Phase 59)', () => {
  it('SIDEBAR_NAV_ITEMS contains no item with id === "workload"', () => {
    const hit = SIDEBAR_NAV_ITEMS.find((item) => item.id === 'workload');
    expect(hit).toBeUndefined();
  });

  it('SIDEBAR_NAV_ITEMS contains no item with path === "/workload"', () => {
    const hit = SIDEBAR_NAV_ITEMS.find((item) => item.path === '/workload');
    expect(hit).toBeUndefined();
  });

  it('pmVisible preset (getDefaultSidebarItems("pm")) contains no workload entry', () => {
    const pmItems = getDefaultSidebarItems('pm');
    const hit = pmItems.find((item) => item.id === 'workload');
    expect(hit).toBeUndefined();
  });

  it('devVisible preset (getDefaultSidebarItems("dev")) contains no workload entry', () => {
    const devItems = getDefaultSidebarItems('dev');
    const hit = devItems.find((item) => item.id === 'workload');
    expect(hit).toBeUndefined();
  });

  it('sidebar-items.ts source contains no "workload" string', () => {
    const src = fs.readFileSync(SIDEBAR_FILE, 'utf8');
    expect(src.toLowerCase()).not.toMatch(/workload/);
  });

  it('sidebar-items.ts still contains the dashboard and aio-projects entries (preservation guard)', () => {
    const dashboardItem = SIDEBAR_NAV_ITEMS.find((item) => item.id === 'dashboard');
    const aioItem = SIDEBAR_NAV_ITEMS.find((item) => item.id === 'aio-projects');
    expect(dashboardItem).toBeDefined();
    expect(aioItem).toBeDefined();
  });
});
