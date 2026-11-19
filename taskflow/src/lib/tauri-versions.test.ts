import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// `tauri build` (release CI) refuses to build when a Tauri npm package and its
// Rust crate differ in major.minor; `tauri dev` never checks. v1.15.0 failed in
// CI this way. This keeps the full suite (pre-push) red until they line up.
describe('Tauri npm/Rust versions', () => {
  it('every @tauri-apps package matches its crate in major.minor', () => {
    const script = resolve(process.cwd(), 'scripts/check-tauri-versions.mjs');
    let output = '';
    try {
      output = execFileSync(process.execPath, [script], { encoding: 'utf8', stdio: 'pipe' });
    } catch (err) {
      const e = err as { stderr?: string };
      throw new Error(e.stderr ?? String(err));
    }
    expect(output).toMatch(/pairs aligned/);
  });
});
