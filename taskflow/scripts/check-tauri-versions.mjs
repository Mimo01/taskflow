#!/usr/bin/env node
// Fails when a Tauri npm package and its Rust crate are on different major.minor
// versions. `tauri build` refuses to build in that state ("Found version
// mismatched Tauri packages"), but `tauri dev` does not check, so the drift only
// surfaced in the release CI (v1.15.0: @tauri-apps/api 2.12 vs tauri 2.10).
//
// Pairs: @tauri-apps/api <-> tauri, @tauri-apps/plugin-X <-> tauri-plugin-X.
// Versions come from the lockfiles (what actually gets built), not the ranges.
//
// Run by .husky/pre-commit when a manifest or lockfile is staged, and by
// scripts/release.sh before anything is bumped or pushed.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const npmLock = JSON.parse(readFileSync(resolve(ROOT, 'package-lock.json'), 'utf8'));
const cargoLock = readFileSync(resolve(ROOT, 'src-tauri', 'Cargo.lock'), 'utf8');

/** crate name -> versions in Cargo.lock (a crate can appear more than once) */
const crates = new Map();
for (const m of cargoLock.matchAll(/\[\[package\]\]\nname = "([^"]+)"\nversion = "([^"]+)"/g)) {
  const list = crates.get(m[1]) ?? [];
  list.push(m[2]);
  crates.set(m[1], list);
}

const minor = (v) => v.split('.').slice(0, 2).join('.');

const problems = [];
let checked = 0;
for (const [path, info] of Object.entries(npmLock.packages ?? {})) {
  const m = path.match(/(?:^|\/)node_modules\/@tauri-apps\/(api|plugin-[a-z0-9-]+)$/); // nested copies too
  if (!m || !info.version) continue;
  const crate = m[1] === 'api' ? 'tauri' : `tauri-${m[1]}`;
  const rust = crates.get(crate);
  if (!rust) {
    // An npm plugin with no Rust side is a different bug (the plugin isn't
    // registered), but it is not what `tauri build` rejects, so only warn.
    if (m[1] !== 'api') console.warn(`check-tauri-versions: warning: @tauri-apps/${m[1]} has no ${crate} crate in Cargo.lock`);
    continue;
  }
  checked++;
  if (!rust.some((v) => minor(v) === minor(info.version))) {
    problems.push(`  ${crate} (${rust.join(', ')}) : @tauri-apps/${m[1]} (${info.version})`);
  }
}

if (problems.length > 0) {
  console.error('check-tauri-versions: Tauri npm packages and Rust crates are on different major.minor versions.');
  console.error('`tauri build` (release CI) refuses to build like this:');
  console.error(problems.join('\n'));
  console.error('Fix: pin the npm package to the crate\'s minor (e.g. "~2.10.1") and run npm install,');
  console.error('or run `cargo update -p <crate>` in src-tauri to raise the crate.');
  process.exit(1);
}
console.log(`check-tauri-versions: ${checked} Tauri npm/Rust pairs aligned`);
