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

/**
 * Phase 83: assertions for the three dashboard cards deleted in plan 83-03.
 * These existsSync assertions are RED until 83-03 performs the deletions — expected and by design.
 * GREEN after 83-03.
 */
describe('dashboard subtree — Phase 83 widget removal guard', () => {
  it('SmokeTestChart.tsx does not exist', () => {
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'SmokeTestChart.tsx'))).toBe(false);
  });

  it('DashboardSprintCard.tsx does not exist', () => {
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'DashboardSprintCard.tsx'))).toBe(false);
  });

  it('DashboardInProgressCard.tsx does not exist', () => {
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'DashboardInProgressCard.tsx'))).toBe(false);
  });

  it('index.tsx does not import SmokeTestChart, DashboardSprintCard, or DashboardInProgressCard', () => {
    const indexSrc = fs.readFileSync(path.join(DASHBOARD_DIR, 'index.tsx'), 'utf8');
    const nonCommentLines = indexSrc
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*'))
      .join('\n');
    expect(nonCommentLines).not.toMatch(/SmokeTestChart/);
    expect(nonCommentLines).not.toMatch(/DashboardSprintCard/);
    expect(nonCommentLines).not.toMatch(/DashboardInProgressCard/);
  });
});

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
