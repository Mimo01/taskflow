// @ts-check
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Release version from git tags. Only three-part release tags (vX.Y.Z) count:
// two-part tags (v1.14) are GSD milestone markers, and `git describe` picking
// one of those as the nearest tag stamped dev builds as 1.14.0.
// Prefer a release tag on HEAD itself (the CI release build), else the highest
// release tag reachable from HEAD, else 0.0.0-dev (local only; CI fails instead).
const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;
const releaseTags = (cmd) =>
  execSync(cmd, { encoding: 'utf8' })
    .split('\n')
    .map((t) => RELEASE_TAG.exec(t.trim()))
    .filter(Boolean)
    .map((m) => [Number(m[1]), Number(m[2]), Number(m[3])])
    .sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]);
let version;
try {
  const best = releaseTags('git tag --points-at HEAD')[0] ?? releaseTags('git tag --merged HEAD')[0];
  if (!best) throw new Error('no vX.Y.Z release tag reachable from HEAD');
  version = best.join('.');
} catch (err) {
  if (process.env.CI) {
    process.stderr.write(`inject-version: ${err.message}\n`);
    process.exit(1);
  }
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
