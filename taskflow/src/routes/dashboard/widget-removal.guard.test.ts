/**
 * G3 — REMOVE-02: Absence guard for deleted widget files in the dashboard subtree.
 *
 * Source-string assertion rationale: the requirement being verified is a deletion —
 * "widget files and the widgets/ directory must not exist on the filesystem".
 * fs.existsSync is used in preference to import.meta.glob because import.meta.glob
 * is evaluated at build time and may not reflect actual filesystem state in test mode.
 * These are pure filesystem-presence assertions with no runtime import of deleted code.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DASHBOARD_DIR = path.resolve(__dirname);

describe('dashboard subtree — widget file absence guard (Phase 59)', () => {
  it('widgets/ directory does not exist', () => {
    const widgetsDir = path.join(DASHBOARD_DIR, 'widgets');
    expect(fs.existsSync(widgetsDir)).toBe(false);
  });

  it('WidgetGrid.tsx does not exist', () => {
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'WidgetGrid.tsx'))).toBe(false);
  });

  it('WidgetCard.tsx does not exist', () => {
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'WidgetCard.tsx'))).toBe(false);
  });

  it('WidgetPicker.tsx does not exist', () => {
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'WidgetPicker.tsx'))).toBe(false);
  });

  it('WorkloadTab.tsx does not exist', () => {
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'WorkloadTab.tsx'))).toBe(false);
  });

  it('WorkloadSkeleton.tsx does not exist', () => {
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'WorkloadSkeleton.tsx'))).toBe(false);
  });
});
