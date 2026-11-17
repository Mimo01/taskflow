import { Slice } from '@tiptap/pm/model';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onMenuPastePlain } from '@/lib/plain-paste';
import { editorExtensions } from '../extensions';
import { WikiUpload } from '../media/upload-plugin';
import { makeEditor } from '../test-utils';
import { WikiSmartPaste } from './paste-plugin';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => invoke(...a) }));

type Ed = ReturnType<typeof makeEditor>['editor'];
const WIKI = 'h2. Title\n* a\n* b';

function setup() {
  return makeEditor('x', [...editorExtensions, WikiUpload, WikiSmartPaste]).editor;
}

function paste(editor: Ed, map: Record<string, string>): boolean {
  const { view } = editor;
  const ev = {
    clipboardData: { files: [], types: Object.keys(map), getData: (t: string) => map[t] ?? '' },
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent;
  return Boolean(view.someProp('handlePaste', (f) => f(view, ev, Slice.empty)));
}

function key(editor: Ed, k: string, mods: { metaKey?: boolean; shiftKey?: boolean } = {}) {
  const { view } = editor;
  const ev = { key: k, metaKey: false, ctrlKey: false, shiftKey: false, ...mods } as KeyboardEvent;
  view.someProp('handleKeyDown', (f) => f(view, ev));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('plain paste flag (WR-07)', () => {
  it('Cmd+Shift+V with no paste does not force the next paste after other typing', () => {
    const editor = setup();
    key(editor, 'v', { metaKey: true, shiftKey: true });
    key(editor, 'a');
    expect(paste(editor, { 'text/plain': WIKI })).toBe(true);
  });

  it('an armed flag expires when no paste follows', () => {
    const editor = setup();
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now);
    key(editor, 'v', { metaKey: true, shiftKey: true });
    spy.mockReturnValue(now + 5000);
    expect(paste(editor, { 'text/plain': WIKI })).toBe(true);
  });

  it('the Paste and Match Style menu flags the text/plain-only native paste as plain', async () => {
    const editor = setup();
    invoke.mockResolvedValue(undefined);
    await onMenuPastePlain();
    expect(invoke).toHaveBeenCalledWith('paste_as_plain_text');
    // pasteAsPlainText: delivers text/plain only and no keydown precedes it.
    expect(paste(editor, { 'text/plain': WIKI })).toBe(false);
    // One paste only: the next ordinary paste converts again (D-12).
    expect(paste(editor, { 'text/plain': WIKI })).toBe(true);
  });

  it('a failed native paste request does not leave the flag armed', async () => {
    const editor = setup();
    invoke.mockRejectedValue(new Error('no command'));
    await onMenuPastePlain();
    expect(paste(editor, { 'text/plain': WIKI })).toBe(true);
  });
});
