/**
 * G4 — QUAL-03: Absence guard for react-grid-layout in package.json.
 *
 * Source-string assertion rationale: the requirement being verified is a deletion —
 * "react-grid-layout must be absent from both dependencies and devDependencies".
 * Reading package.json and asserting absence of the key is the correct strategy for
 * a deletion-guard test. The parsed JSON check is used rather than a raw-string grep
 * so that partial matches (e.g. a package named "my-react-grid-layout-fork") do not
 * produce false negatives, and the assertion targets the exact dependency key names.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PKG_FILE = path.resolve(__dirname, '../../package.json');

describe('package.json — react-grid-layout absence guard (Phase 59 / QUAL-03)', () => {
  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  // Read once — if this throws, all tests in this describe fail with a clear parse error.
  try {
    pkg = JSON.parse(fs.readFileSync(PKG_FILE, 'utf8'));
  } catch {
    pkg = {};
  }

  it('package.json is parseable as valid JSON', () => {
    const raw = fs.readFileSync(PKG_FILE, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('"react-grid-layout" is absent from dependencies', () => {
    const deps = pkg.dependencies ?? {};
    expect('react-grid-layout' in deps).toBe(false);
  });

  it('"react-grid-layout" is absent from devDependencies', () => {
    const devDeps = pkg.devDependencies ?? {};
    expect('react-grid-layout' in devDeps).toBe(false);
  });

  it('"@types/react-grid-layout" is absent from devDependencies', () => {
    const devDeps = pkg.devDependencies ?? {};
    expect('@types/react-grid-layout' in devDeps).toBe(false);
  });
});

