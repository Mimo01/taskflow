/**
 * G1 — REMOVE-01 / D-02: Absence guard for /workload route and WorkloadTab symbol.
 *
 * Source-string assertion rationale: the requirement being verified is a deletion —
 * "WorkloadTab lazy import and /workload route entry must not exist in routes.tsx".
 * Reading the source file and asserting absence of the deleted strings is the correct
 * strategy for a deletion-guard test, because the truth being protected is that the
 * strings no longer appear in source at all, not merely that they are unreachable at
 * runtime.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES_FILE = path.resolve(__dirname, 'routes.tsx');

describe('routes.tsx — workload route absence guard (Phase 59)', () => {
  it('routes.tsx does not contain a WorkloadTab lazy import', () => {
    const src = fs.readFileSync(ROUTES_FILE, 'utf8');
    expect(src).not.toMatch(/WorkloadTab/);
  });

  it('routes.tsx does not contain a /workload route entry', () => {
    const src = fs.readFileSync(ROUTES_FILE, 'utf8');
    expect(src).not.toMatch(/['"]\/?workload['"]/);
  });

  it('routes.tsx still contains the /dashboard route (regression guard — preserved route)', () => {
    const src = fs.readFileSync(ROUTES_FILE, 'utf8');
    expect(src).toMatch(/path:\s*['"]\/dashboard['"]/);
  });
});
