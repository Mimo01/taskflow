import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUpdateStore } from './update.store';

describe('update.store', () => {
  beforeEach(() => {
    act(() => {
      useUpdateStore.setState({
        status: 'idle',
        availableVersion: null,
        changelog: null,
        releaseDate: null,
        downloadProgress: null,
        errorMessage: null,
      });
    });
  });

  it('initial status is idle with all nullable fields null', () => {
    const s = useUpdateStore.getState();
    expect(s.status).toBe('idle');
    expect(s.availableVersion).toBeNull();
    expect(s.changelog).toBeNull();
    expect(s.releaseDate).toBeNull();
    expect(s.downloadProgress).toBeNull();
    expect(s.errorMessage).toBeNull();
  });

  it('setChecking transitions to checking and clears errorMessage', () => {
    act(() => useUpdateStore.getState().setError('old error'));
    act(() => useUpdateStore.getState().setChecking());
    const s = useUpdateStore.getState();
    expect(s.status).toBe('checking');
    expect(s.errorMessage).toBeNull();
  });

  it('setAvailable stores version, changelog, and date', () => {
    act(() => useUpdateStore.getState().setAvailable('1.6.0', '## Notes', '2026-03-24'));
    const s = useUpdateStore.getState();
    expect(s.status).toBe('available');
    expect(s.availableVersion).toBe('1.6.0');
    expect(s.changelog).toBe('## Notes');
    expect(s.releaseDate).toBe('2026-03-24');
  });

  it('setDownloading transitions to downloading with progress 0', () => {
    act(() => useUpdateStore.getState().setDownloading());
    const s = useUpdateStore.getState();
    expect(s.status).toBe('downloading');
    expect(s.downloadProgress).toBe(0);
  });

  it('setProgress updates downloadProgress', () => {
    act(() => useUpdateStore.getState().setDownloading());
    act(() => useUpdateStore.getState().setProgress(50));
    expect(useUpdateStore.getState().downloadProgress).toBe(50);
  });

  it('setError transitions to error with message, clears downloadProgress', () => {
    act(() => useUpdateStore.getState().setDownloading());
    act(() => useUpdateStore.getState().setProgress(30));
    act(() => useUpdateStore.getState().setError('Download failed'));
    const s = useUpdateStore.getState();
    expect(s.status).toBe('error');
    expect(s.errorMessage).toBe('Download failed');
    expect(s.downloadProgress).toBeNull();
  });

  it('resetToIdle clears error and progress but preserves availableVersion', () => {
    act(() => useUpdateStore.getState().setAvailable('1.6.0', '## Notes', '2026-03-24'));
    act(() => useUpdateStore.getState().setError('fail'));
    act(() => useUpdateStore.getState().resetToIdle());
    const s = useUpdateStore.getState();
    expect(s.status).toBe('idle');
    expect(s.errorMessage).toBeNull();
    expect(s.downloadProgress).toBeNull();
    expect(s.availableVersion).toBe('1.6.0');
  });
});
