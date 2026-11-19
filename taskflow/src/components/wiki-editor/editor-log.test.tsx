import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/stores/settings.store';
import { useWikiEditorLogStore } from '@/stores/wiki-editor-log.store';
import { installLayoutStubs, liveEditor, renderEditor, textarea, typeAt } from './shell-test-utils';

vi.mock('@/lib/wiki/editor', async (orig) => {
  const actual = await orig<typeof import('@/lib/wiki/editor')>();
  return {
    ...actual,
    loadWiki: (text: string, ...rest: unknown[]) =>
      text.includes('FORCE_FAIL')
        ? { kind: 'failed' as const, original: text, reason: 'test reason' }
        : (actual.loadWiki as (...a: unknown[]) => unknown)(text, ...rest),
  };
});

installLayoutStubs();

const entries = () => useWikiEditorLogStore.getState().entries;
const events = () => entries().map((e) => e.event);

beforeEach(() => {
  act(() => {
    useSettingsStore.setState({ devToolsEnabled: true });
    useWikiEditorLogStore.getState().clear();
  });
});

describe('editor log', () => {
  it('logs open with metadata only, never document text', () => {
    renderEditor({ value: 'secret body', onChange: vi.fn() });
    const open = entries().find((e) => e.event === 'open');
    expect(open).toBeDefined();
    expect(open?.markup).toBeUndefined();
    expect(open?.details).toMatchObject({ mode: 'rich', length: 11 });
    expect(JSON.stringify(open)).not.toContain('secret body');
  });

  it('logs one save-failed entry with reason and markup, then blocked submit and mode switch', () => {
    renderEditor({ value: 'hello', onChange: vi.fn(), onSubmit: vi.fn() });
    const editor = liveEditor();
    act(() => typeAt(editor, 1, 'h1. '));
    const failed = entries().filter((e) => e.event === 'save-failed');
    expect(failed).toHaveLength(1);
    expect(failed[0].level).toBe('error');
    expect(failed[0].error?.message).toBeTruthy();
    expect(failed[0].markup?.original).toBe('hello');
    expect(failed[0].markup?.produced).toContain('h1. hello');

    act(() => typeAt(editor, 5, 'x'));
    act(() => typeAt(editor, 5, 'y'));
    expect(entries().filter((e) => e.event === 'save-failed')).toHaveLength(1);

    fireEvent.keyDown(editor.view.dom, { key: 'Enter', metaKey: true });
    expect(entries().filter((e) => e.event === 'submit-blocked')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Fix in source' }));
    const switches = entries().filter((e) => e.event === 'mode-switch');
    expect(switches).toHaveLength(1);
    expect(switches[0].details?.error).toBeTruthy();
    expect(entries().filter((e) => e.event === 'save-failed')).toHaveLength(1);
  });

  it('logs load-failed with the markup and reason', () => {
    renderEditor({ value: 'FORCE_FAIL text', onChange: vi.fn() });
    expect(textarea()).toBeInTheDocument();
    const failed = entries().find((e) => e.event === 'load-failed');
    expect(failed?.markup?.original).toBe('FORCE_FAIL text');
    expect(failed?.error?.message).toBe('test reason');
  });

  it('captures nothing while Developer Tools are disabled', () => {
    act(() => {
      useSettingsStore.setState({ devToolsEnabled: false });
    });
    renderEditor({ value: 'hello', onChange: vi.fn() });
    act(() => typeAt(liveEditor(), 1, 'h1. '));
    expect(events()).toEqual([]);
  });
});
