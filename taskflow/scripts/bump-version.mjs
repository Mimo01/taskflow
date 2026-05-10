#!/usr/bin/env node
// bump-version.mjs — Update version files, prepend changelog entry, commit, tag, push
// Usage: echo "<release notes>" | node scripts/bump-version.mjs <new-version>
// Example: echo "### Added\n- New feature" | node scripts/bump-version.mjs 1.8.0
//
// The script reads curated release notes from stdin and prepends them as a new
// section in CHANGELOG.md. This is designed to be driven by Claude, who analyzes
// the git log and writes meaningful release notes before piping them in.

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TASKFLOW_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(TASKFLOW_ROOT, '..');

const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Usage: echo "<release notes>" | node scripts/bump-version.mjs <new-version>');
  console.error('Example: echo "### Added\\n- New feature" | node scripts/bump-version.mjs 1.8.0');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error(`Error: Invalid version "${newVersion}". Expected format: X.Y.Z (e.g., 1.7.0)`);
  process.exit(1);
}

// --- Read release notes from stdin ---
console.log('Reading release notes from stdin...');
const releaseNotes = readFileSync(0, 'utf8').trim();

if (!releaseNotes) {
  console.error('Error: No release notes provided on stdin.');
  console.error('Pipe release notes into the script, e.g.:');
  console.error('  echo "### Added\\n- Feature" | node scripts/bump-version.mjs 1.8.0');
  process.exit(1);
}

console.log(`Bumping version to ${newVersion}`);

let hasError = false;

// --- package.json ---
try {
  const pkgPath = resolve(TASKFLOW_ROOT, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const oldVersion = pkg.version;
  pkg.version = newVersion;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`  package.json: ${oldVersion} -> ${newVersion}`);
} catch (err) {
  console.error(`  package.json: ERROR — ${err.message}`);
  hasError = true;
}

// --- src-tauri/tauri.conf.json ---
try {
  const tauriConfPath = resolve(TASKFLOW_ROOT, 'src-tauri', 'tauri.conf.json');
  const conf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
  const oldVersion = conf.version;
  conf.version = newVersion;
  writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2) + '\n', 'utf8');
  console.log(`  src-tauri/tauri.conf.json: ${oldVersion} -> ${newVersion}`);
} catch (err) {
  console.error(`  src-tauri/tauri.conf.json: ERROR — ${err.message}`);
  hasError = true;
}

// --- package-lock.json ---
try {
  const lockPath = resolve(TASKFLOW_ROOT, 'package-lock.json');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const oldVersion = lock.version;
  lock.version = newVersion;
  if (lock.packages?.['']) lock.packages[''].version = newVersion;
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
  console.log(`  package-lock.json: ${oldVersion} -> ${newVersion}`);
} catch (err) {
  console.error(`  package-lock.json: ERROR — ${err.message}`);
  hasError = true;
}

// --- src-tauri/Cargo.toml ---
try {
  const cargoPath = resolve(TASKFLOW_ROOT, 'src-tauri', 'Cargo.toml');
  const cargoContent = readFileSync(cargoPath, 'utf8');

  const packageSectionEnd = cargoContent.indexOf('\n[', cargoContent.indexOf('[package]') + 1);
  const packageSection = packageSectionEnd === -1
    ? cargoContent
    : cargoContent.slice(0, packageSectionEnd);
  const rest = packageSectionEnd === -1 ? '' : cargoContent.slice(packageSectionEnd);

  const versionMatch = packageSection.match(/^version = "(\d+\.\d+\.\d+)"/m);
  if (!versionMatch) {
    throw new Error('Could not find version = "X.Y.Z" in [package] section');
  }
  const oldVersion = versionMatch[1];
  const updatedPackageSection = packageSection.replace(
    /^version = "\d+\.\d+\.\d+"/m,
    `version = "${newVersion}"`
  );
  writeFileSync(cargoPath, updatedPackageSection + rest, 'utf8');
  console.log(`  src-tauri/Cargo.toml: ${oldVersion} -> ${newVersion}`);
} catch (err) {
  console.error(`  src-tauri/Cargo.toml: ERROR — ${err.message}`);
  hasError = true;
}

if (hasError) {
  console.error('\nOne or more files failed to update. Check errors above.');
  process.exit(1);
}

// --- Prepend new section to CHANGELOG.md ---
console.log('\nUpdating CHANGELOG.md...');
const changelogPath = resolve(TASKFLOW_ROOT, 'CHANGELOG.md');
const changelog = readFileSync(changelogPath, 'utf8');

const today = new Date().toISOString().slice(0, 10);
const newSection = `## [${newVersion}] — ${today}\n\n${releaseNotes}`;

// Insert after the header block (before the first ## [...] section)
const firstSectionIdx = changelog.indexOf('\n## [');
let updatedChangelog;
if (firstSectionIdx === -1) {
  // No existing sections — append after header
  updatedChangelog = changelog.trimEnd() + '\n\n' + newSection + '\n';
} else {
  updatedChangelog =
    changelog.slice(0, firstSectionIdx + 1) +
    newSection + '\n\n' +
    changelog.slice(firstSectionIdx + 1);
}

writeFileSync(changelogPath, updatedChangelog, 'utf8');
console.log(`  CHANGELOG.md: prepended v${newVersion} section.`);

// --- Git commit ---
console.log('\nCommitting version bump...');
execSync('git add -A', { cwd: REPO_ROOT, stdio: 'inherit' });
try {
  execSync(`git diff --cached --quiet`, { cwd: REPO_ROOT });
  console.log('  No changes to commit (already at this version).');
} catch {
  execSync(`git commit -m "chore: bump version to ${newVersion}"`, { cwd: REPO_ROOT, stdio: 'inherit' });
  console.log('  Committed.');
}

// --- Git tag with annotation ---
console.log(`\nCreating annotated tag v${newVersion}...`);
const tagMessage = `v${newVersion}\n\n${releaseNotes}\n`;
try {
  execSync(`git tag -a v${newVersion} -F -`, {
    cwd: REPO_ROOT,
    input: tagMessage,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  console.log(`  Tagged v${newVersion}.`);
} catch {
  console.log(`  Tag v${newVersion} already exists. Replacing...`);
  execSync(`git tag -d v${newVersion}`, { cwd: REPO_ROOT, stdio: 'inherit' });
  execSync(`git tag -a v${newVersion} -F -`, {
    cwd: REPO_ROOT,
    input: tagMessage,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  console.log(`  Re-tagged v${newVersion}.`);
}

// --- Git push ---
console.log('\nPushing to origin...');
execSync('git push origin main', { cwd: REPO_ROOT, stdio: 'inherit' });
execSync(`git push origin v${newVersion}`, { cwd: REPO_ROOT, stdio: 'inherit' });
console.log('  Pushed.');

console.log(`\nDone. Version bumped to v${newVersion}.`);
