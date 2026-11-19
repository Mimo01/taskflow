import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logWikiEditor, nextEditorSessionId } from '../lib/wiki-editor-log';
import { useSettingsStore } from './settings.store';
import { type WikiEditorLogEntry, useWikiEditorLogStore } from './wiki-editor-log.store';

type Built = Omit<WikiEditorLogEntry, 'id' | 'timestamp'>;
const base = (message: string): Built => ({
  session: 1,
  event: 'open',
  level: 'info',
  message,
});

describe('wiki-editor-log store', () => {
  beforeEach(() => {
    useSettingsStore.setState({ devToolsEnabled: true, retentionLimit: 200 });
    useWikiEditorLogStore.getState().clear();
  });

  it('stores newest first, caps at the retention limit and clears', () => {
    useSettingsStore.setState({ retentionLimit: 2 });
    for (const m of ['a', 'b', 'c']) logWikiEditor(() => base(m));
    expect(useWikiEditorLogStore.getState().entries.map((e) => e.message)).toEqual(['c', 'b']);
    useWikiEditorLogStore.getState().clear();
    expect(useWikiEditorLogStore.getState().entries).toEqual([]);
  });
});

describe('logWikiEditor', () => {
  beforeEach(() => {
    useSettingsStore.setState({ devToolsEnabled: true, retentionLimit: 200 });
    useWikiEditorLogStore.getState().clear();
  });

  it('does not call build or append when Developer Tools are disabled', () => {
    useSettingsStore.setState({ devToolsEnabled: false });
    const build = vi.fn(() => base('x'));
    logWikiEditor(build);
    expect(build).not.toHaveBeenCalled();
    expect(useWikiEditorLogStore.getState().entries).toEqual([]);
  });

  it('appends with a generated id and ISO timestamp', () => {
    logWikiEditor(() => base('x'));
    const [entry] = useWikiEditorLogStore.getState().entries;
    expect(entry.id).toMatch(/^wiki-editor-\d+$/);
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it('swallows a throwing build and appends nothing', () => {
    expect(() =>
      logWikiEditor(() => {
        throw new Error('boom');
      }),
    ).not.toThrow();
    expect(useWikiEditorLogStore.getState().entries).toEqual([]);
  });

  it('truncates oversized markup with a marker', () => {
    logWikiEditor(() => ({
      ...base('big'),
      markup: { original: 'a'.repeat(20_050), produced: 'short' },
    }));
    const { markup } = useWikiEditorLogStore.getState().entries[0];
    expect(markup?.original).toContain('… [truncated 50 chars]');
    expect(markup?.original?.length).toBeLessThan(20_100);
    expect(markup?.produced).toBe('short');
  });

  it('hands out increasing session ids', () => {
    const a = nextEditorSessionId();
    expect(nextEditorSessionId()).toBe(a + 1);
  });
});
