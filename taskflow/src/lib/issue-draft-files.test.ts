import * as fs from '@tauri-apps/plugin-fs';

const { readDir } = fs;
import {
  purgeAllDraftFiles,
  purgeOrphanDraftFiles,
  readDraftFile,
  removeDraftFiles,
  safeDraftFileName,
  stageDraftFile,
} from './issue-draft-files';

describe('issue-draft-files', () => {
  afterEach(async () => {
    await purgeAllDraftFiles();
    vi.restoreAllMocks();
  });

  it('sanitises file names', () => {
    for (const n of ['../a/b.png', '..\\..\\x.txt', 'a/../b']) {
      const s = safeDraftFileName(n);
      expect(s).not.toMatch(/[\\/]/);
      expect(s).not.toContain('..');
    }
    expect(safeDraftFileName('../a/b.png')).toBe('b.png');
    expect(safeDraftFileName('')).toBe('file');
  });

  it('stages a file under issue-drafts/<id>/ and reads it back', async () => {
    const f = new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' });
    const ref = await stageDraftFile('id1', f);
    expect(ref).toEqual({
      name: 'x.png',
      size: 3,
      type: 'image/png',
      path: 'issue-drafts/id1/x.png',
    });
    const back = await readDraftFile(ref);
    expect(back?.name).toBe('x.png');
    expect(back?.type).toBe('image/png');
    expect(new Uint8Array(await (back as File).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('creates the draft dir and file under AppData-relative paths', async () => {
    await stageDraftFile('id1', new File(['a'], 'x.png'));
    expect((await readDir('issue-drafts/id1')).map((e) => e.name)).toEqual(['x.png']);
  });

  it('rejects a non-token draft id without touching fs', async () => {
    await expect(stageDraftFile('../evil', new File(['a'], 'x.png'))).rejects.toThrow();
    expect(await readDir('issue-drafts')).toEqual([]);
  });

  it('returns null for a missing copy', async () => {
    expect(await readDraftFile({ name: 'n', size: 0, type: '', path: 'issue-drafts/zz/n' })).toBeNull();
  });

  it('removes one draft dir and swallows a missing one', async () => {
    await stageDraftFile('id1', new File(['a'], 'x.png'));
    await stageDraftFile('id2', new File(['a'], 'y.png'));
    await removeDraftFiles('id1');
    expect((await readDir('issue-drafts')).map((e) => e.name)).toEqual(['id2']);
    await expect(removeDraftFiles('never-existed')).resolves.toBeUndefined();
  });

  it('purges everything and swallows a missing root', async () => {
    await stageDraftFile('id1', new File(['a'], 'x.png'));
    await purgeAllDraftFiles();
    expect(await readDir('issue-drafts')).toEqual([]);
    await expect(purgeAllDraftFiles()).resolves.toBeUndefined();
  });

  it('purges orphan draft dirs only', async () => {
    await stageDraftFile('a', new File(['a'], 'x.png'));
    await stageDraftFile('b', new File(['a'], 'x.png'));
    await purgeOrphanDraftFiles(new Set(['a']));
    expect((await readDir('issue-drafts')).map((e) => e.name)).toEqual(['a']);
  });

  it('swallows a readDir failure during orphan purge', async () => {
    vi.spyOn(fs, 'readDir').mockRejectedValueOnce(new Error('missing'));
    await expect(purgeOrphanDraftFiles(new Set())).resolves.toBeUndefined();
  });
});
