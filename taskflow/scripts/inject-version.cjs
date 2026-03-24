// @ts-check
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read git tag, fallback to 0.0.0-dev if no tags exist
let version;
try {
  const tag = execSync('git describe --tags --match "v[0-9]*" --abbrev=0', { encoding: 'utf8' }).trim();
  // Normalize to SemVer: v1 -> 1.0.0, v1.5 -> 1.5.0, v1.5.0 -> 1.5.0
  version = tag.replace(/^v/, '').split('.').concat(['0', '0']).slice(0, 3).join('.');
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

// Export for Vite define (consumed by package.json cross-env or shell eval)
process.stdout.write(`APP_VERSION=${version}\nAPP_COMMIT_SHA=${sha}\nAPP_BUILD_DATE=${buildDate}\n`);
