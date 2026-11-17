/**
 * HOST-05 / D-18: guard that the old textarea editing code stays deleted.
 *
 * Source-string assertion rationale: the requirement is a removal, so these are
 * filesystem-presence and source-scan assertions (fs.existsSync / readFileSync)
 * with no runtime import of deleted code. Comment lines are stripped so
 * explanatory comments cannot trip the scan.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DASHBOARD_DIR = path.resolve(__dirname);
const SRC_DIR = path.resolve(__dirname, '../..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|guard\.test)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(src: string): string {
  return src
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*'))
    .join('\n');
}

const NON_TEST_FILES = walk(SRC_DIR).map((file) => ({
  file: path.relative(SRC_DIR, file),
  code: stripComments(fs.readFileSync(file, 'utf8')),
}));

function offenders(pattern: RegExp): string[] {
  return NON_TEST_FILES.filter(({ code }) => pattern.test(code)).map(({ file }) => file);
}

describe('old editor removal guard (HOST-05)', () => {
  it.each([
    'DescriptionEditor.tsx',
    'MentionPopover.tsx',
    'InlineComment.tsx',
    'IssueDetailSheet.tsx',
    'issue-detail/DescriptionSection.tsx',
  ])('%s does not exist', (rel) => {
    expect(fs.existsSync(path.join(DASHBOARD_DIR, rel))).toBe(false);
  });

  it('no non-test source contains insertAtCursor', () => {
    expect(offenders(/insertAtCursor/)).toEqual([]);
  });

  it('no non-test source contains applyMarkup', () => {
    expect(offenders(/applyMarkup/)).toEqual([]);
  });

  it('no non-test source has a Preview tab trigger', () => {
    expect(offenders(/TabsTrigger[^>]*value=["']preview["']/)).toEqual([]);
  });

  it('no non-test source imports a deleted module', () => {
    expect(
      offenders(
        /from\s+['"][^'"]*\/(DescriptionEditor|MentionPopover|InlineComment|IssueDetailSheet|DescriptionSection)['"]/,
      ),
    ).toEqual([]);
  });

  it.each([
    'CommentComposer.tsx',
    'IssueDetailView.tsx',
    'CreateEpicDialog.tsx',
    'create-edit-issue/CreateEditIssueModal.tsx',
  ])('%s has no textarea editing surface', (rel) => {
    const code = stripComments(fs.readFileSync(path.join(DASHBOARD_DIR, rel), 'utf8'));
    expect(code).not.toMatch(/<[Tt]extarea/);
  });
});
