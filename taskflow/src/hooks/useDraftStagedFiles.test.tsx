import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readDraftFile, stageDraftFile } from '@/lib/issue-draft-files';
import { StagedFilesStrip } from '@/routes/dashboard/StagedFilesStrip';
import { useDraftStagedFiles } from './useDraftStagedFiles';

vi.mock('@/lib/issue-draft-files', () => ({
  stageDraftFile: vi.fn(),
  readDraftFile: vi.fn(),
}));

const file = (name: string) => new File(['x'], name, { type: 'text/plain' });
const ref = (name: string) => ({
  name,
  size: 1,
  type: 'text/plain',
  path: `issue-drafts/d1/${name}`,
});

beforeEach(() => {
  vi.mocked(stageDraftFile).mockReset();
  vi.mocked(readDraftFile).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

function setup() {
  const onChange = vi.fn();
  const hook = renderHook(() => useDraftStagedFiles({ ensureDraftId: () => 'd1', onChange }));
  return { ...hook, onChange };
}

describe('useDraftStagedFiles', () => {
  it('stage appends the file immediately then the copied ref', async () => {
    vi.mocked(stageDraftFile).mockImplementation(async (_id, f) => ref(f.name));
    const { result, onChange } = setup();
    await act(async () => result.current.stage(file('a.txt')));
    expect(stageDraftFile).toHaveBeenCalledWith('d1', expect.any(File));
    expect(result.current.files.map((f) => f.name)).toEqual(['a.txt']);
    expect(result.current.refs).toEqual([ref('a.txt')]);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('keeps the file when the copy fails and flags copyFailed', async () => {
    vi.mocked(stageDraftFile).mockRejectedValue(new Error('disk'));
    const { result } = setup();
    await act(async () => result.current.stage(file('a.txt')));
    expect(result.current.files).toHaveLength(1);
    expect(result.current.refs).toEqual([]);
    expect(result.current.copyFailed).toBe(true);
  });

  it('remove drops the file and its ref by name', async () => {
    vi.mocked(stageDraftFile).mockImplementation(async (_id, f) => ref(f.name));
    const { result } = setup();
    await act(async () => {
      result.current.stage(file('a.txt'));
      result.current.stage(file('b.txt'));
    });
    act(() => result.current.remove(0));
    expect(result.current.files.map((f) => f.name)).toEqual(['b.txt']);
    expect(result.current.refs.map((r) => r.name)).toEqual(['b.txt']);
  });

  it('a file removed while its copy is still being written stays out of the draft (WR-01)', async () => {
    let finish: (r: ReturnType<typeof ref>) => void = () => {};
    vi.mocked(stageDraftFile).mockImplementation(
      () =>
        new Promise((res) => {
          finish = res;
        }),
    );
    const { result } = setup();
    act(() => result.current.stage(file('a.txt')));
    act(() => result.current.remove(0));
    await act(async () => finish(ref('a.txt')));
    expect(result.current.files).toEqual([]);
    expect(result.current.refs).toEqual([]);
  });

  it('restore splits found files from missing names', async () => {
    vi.mocked(readDraftFile).mockImplementation(async (r) =>
      r.name === 'gone.png' ? null : file(r.name),
    );
    const { result } = setup();
    await act(async () => result.current.restore([ref('ok.txt'), ref('gone.png')]));
    expect(result.current.files.map((f) => f.name)).toEqual(['ok.txt']);
    expect(result.current.refs.map((r) => r.name)).toEqual(['ok.txt']);
    expect(result.current.missing).toEqual(['gone.png']);
  });

  it('removeMissing drops the name', async () => {
    vi.mocked(readDraftFile).mockResolvedValue(null);
    const { result } = setup();
    await act(async () => result.current.restore([ref('gone.png')]));
    act(() => result.current.removeMissing('gone.png'));
    expect(result.current.missing).toEqual([]);
  });

  it('reset clears everything', async () => {
    vi.mocked(stageDraftFile).mockRejectedValue(new Error('disk'));
    const { result } = setup();
    await act(async () => result.current.stage(file('a.txt')));
    act(() => result.current.reset());
    expect(result.current.files).toEqual([]);
    expect(result.current.refs).toEqual([]);
    expect(result.current.missing).toEqual([]);
    expect(result.current.copyFailed).toBe(false);
  });
});

describe('StagedFilesStrip missing tiles', () => {
  it('renders a missing tile with a remove button and no size', () => {
    const onRemoveMissing = vi.fn();
    render(
      <StagedFilesStrip
        files={[]}
        onRemove={() => {}}
        missing={['photo.png']}
        onRemoveMissing={onRemoveMissing}
      />,
    );
    expect(screen.getByText('photo.png is missing')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Remove photo.png' }).click();
    expect(onRemoveMissing).toHaveBeenCalledWith('photo.png');
  });
});
