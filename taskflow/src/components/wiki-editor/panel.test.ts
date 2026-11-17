import { describe, expect, it } from 'vitest';
import { loadWiki } from '@/lib/wiki/editor';
import {
  paramsFromTitle,
  removePanel,
  sanitizePanelTitle,
  setPanelTitle,
  setPanelType,
  titleFromParams,
} from './panel-commands';
import { makeEditor, saveText } from './test-utils';

describe('panel title helpers', () => {
  it('sanitises', () => {
    expect(sanitizePanelTitle('a}b|c\nd\re')).toBe('abcde');
    expect(sanitizePanelTitle('  hi  ')).toBe('hi');
  });
  it('maps params', () => {
    expect(paramsFromTitle('')).toBeNull();
    expect(paramsFromTitle('Hi')).toBe('title=Hi');
    expect(titleFromParams('title=Hi')).toBe('Hi');
    expect(titleFromParams(null)).toBe('');
  });
});

describe('panel commands', () => {
  it.each(['Hi', 'a}b', 'x|y', 'line\nbreak', 'Ünïcode'])('title %j round-trips', (input) => {
    const { editor, load } = makeEditor('{info}\nbody\n{info}');
    expect(setPanelTitle(editor, 0, input)).toBe(true);
    const r = saveText(editor, load);
    expect(r.kind).toBe('saved');
    if (r.kind !== 'saved') return;
    const again = loadWiki(r.text);
    expect('doc' in again).toBe(true);
    if (!('doc' in again)) return;
    const panel = again.doc.content?.[0];
    expect(panel?.type).toBe('panel');
    const params = panel?.attrs?.params;
    expect(titleFromParams(typeof params === 'string' ? params : null)).toBe(
      sanitizePanelTitle(input),
    );
  });

  it('switches type', () => {
    const { editor, load } = makeEditor('{info}\nbody\n{info}');
    setPanelType(editor, 0, 'warning');
    const r = saveText(editor, load);
    expect(r.kind === 'saved' && r.text).toBe('{warning}\nbody\n{warning}');
  });

  it('removes the panel in one undo step', () => {
    const { editor } = makeEditor('{info}\nbody\n{info}');
    removePanel(editor, 0);
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph');
    editor.commands.undo();
    expect(editor.state.doc.firstChild?.type.name).toBe('panel');
  });
});
