import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadAttachment } from '@/services/jira/attachments';
import { uploadStagedFiles } from './upload-staged-files';

vi.mock('@/services/jira/attachments');

const f = (n: string) => new File(['x'], n);

describe('uploadStagedFiles', () => {
  beforeEach(() => {
    vi.mocked(uploadAttachment).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('uploads in order to the issue key', async () => {
    vi.mocked(uploadAttachment).mockResolvedValue([]);
    const failed = await uploadStagedFiles('https://j', 't', 'A-1', [f('a'), f('b')]);
    expect(failed).toEqual([]);
    expect(vi.mocked(uploadAttachment).mock.calls.map((c) => [c[2], c[3].name])).toEqual([
      ['A-1', 'a'],
      ['A-1', 'b'],
    ]);
  });

  it('continues past a failure and returns failed names', async () => {
    vi.mocked(uploadAttachment).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([]);
    expect(await uploadStagedFiles('https://j', 't', 'A-1', [f('a'), f('b')])).toEqual(['a']);
    expect(uploadAttachment).toHaveBeenCalledTimes(2);
  });

  it('makes no calls for an empty list', async () => {
    expect(await uploadStagedFiles('https://j', 't', 'A-1', [])).toEqual([]);
    expect(uploadAttachment).not.toHaveBeenCalled();
  });
});
