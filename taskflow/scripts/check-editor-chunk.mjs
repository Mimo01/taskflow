#!/usr/bin/env node
/**
 * check-editor-chunk.mjs — Phase 98 bundle guard (EDIT-09).
 *
 * After `npm run build`, asserts that ProseMirror/TipTap code lives only in an async chunk:
 * the entry script referenced by dist/index.html must contain no ProseMirror/TipTap marker,
 * and at least one other dist/assets/*.js chunk must. Exits 1 on failure.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const MARKER = /prosemirror|@tiptap|tiptap/i;

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const entryMatch = html.match(/<script[^>]*\ssrc="([^"]+\.js)"/);
if (!entryMatch) {
  console.error('FAIL: no entry script found in dist/index.html');
  process.exit(1);
}
const entryFile = entryMatch[1].replace(/^\//, '');
const entryText = readFileSync(join(dist, entryFile), 'utf8');
if (MARKER.test(entryText)) {
  console.error(`FAIL: entry chunk ${entryFile} contains ProseMirror/TipTap code`);
  process.exit(1);
}

const assets = join(dist, 'assets');
const holders = readdirSync(assets)
  .filter((f) => f.endsWith('.js') && `assets/${f}` !== entryFile)
  .filter((f) => MARKER.test(readFileSync(join(assets, f), 'utf8')));
if (holders.length === 0) {
  console.error('FAIL: no async chunk contains the editor');
  process.exit(1);
}
for (const f of holders) {
  const kb = (statSync(join(assets, f)).size / 1024).toFixed(1);
  console.log(`OK: editor in async chunk ${f} (${kb} KB); entry ${entryFile} is clean`);
}
