// @ts-check
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Highest version tag reachable from HEAD, fallback to 0.0.0-dev if none.
// Not `git describe`: it returns the *nearest* tag, and a milestone tag (v1.14)
// created after the last release tag (v1.14.23) would win and yield 1.14.0.
let version;
try {
  const tags = execSync('git tag --merged HEAD --list "v[0-9]*"', { encoding: 'utf8' })
    .split('\n')
    .map((t) => t.trim())
    .filter((t) => /^v\d+(\.\d+){0,2}$/.test(t))
    // Normalize to SemVer: v1 -> 1.0.0, v1.5 -> 1.5.0, v1.5.0 -> 1.5.0
    .map((t) => t.slice(1).split('.').concat(['0', '0']).slice(0, 3).map(Number));
  if (tags.length === 0) throw new Error('no version tags');
  tags.sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]);
  version = tags[0].join('.');
} catch {
  version = '0.0.0-dev';
}

const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const buildDate = new Date().toISOString().substring(0, 10);

// Write version into tauri.conf.json
const confPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'));
conf.version = version;
fs.writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');

// Write version into package.json
const pkgPath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// Write version into Cargo.toml
const cargoPath = path.join(__dirname, '../src-tauri/Cargo.toml');
const cargo = fs.readFileSync(cargoPath, 'utf8');
fs.writeFileSync(cargoPath, cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`));

// Export for Vite define (consumed by package.json cross-env or shell eval)
process.stdout.write(`APP_VERSION=${version}\nAPP_COMMIT_SHA=${sha}\nAPP_BUILD_DATE=${buildDate}\n`);
