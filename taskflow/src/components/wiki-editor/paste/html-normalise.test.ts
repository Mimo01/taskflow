import type { Editor, JSONContent } from '@tiptap/core';
import type { ResolvedPos, Slice } from '@tiptap/pm/model';
import * as pmView from '@tiptap/pm/view';
import { describe, expect, it } from 'vitest';
import googleDocs from '../__fixtures__/paste/google-docs.html?raw';
import hostile from '../__fixtures__/paste/hostile.html?raw';
import jiraRendered from '../__fixtures__/paste/jira-rendered.html?raw';
import webArticle from '../__fixtures__/paste/web-article.html?raw';
import word from '../__fixtures__/paste/word.html?raw';
import { makeEditor, saveText } from '../test-utils';
import { type NormaliseContext, normalisePastedHtml } from './html-normalise';

/** `__parseFromClipboard` is exported at runtime but missing from the type declarations. */
const parseFromClipboard = (
  pmView as unknown as {
    __parseFromClipboard: (
      view: Editor['view'],
      text: string,
      html: string,
      plain: boolean,
      $context: ResolvedPos,
    ) => Slice;
  }
).__parseFromClipboard;

/** Normalise, parse through ProseMirror's clipboard parser, replace the doc, then save. */
function pasteInto(html: string, ctx: NormaliseContext = {}) {
  const result = normalisePastedHtml(html, ctx);
  const { editor, load } = makeEditor('x');
  const { view } = editor;
  const slice = parseFromClipboard(view, '', result.html, false, view.state.doc.resolve(1));
  view.dispatch(view.state.tr.replaceRange(0, view.state.doc.content.size, slice));
  return { result, editor, save: saveText(editor, load) };
}

function savedText(save: ReturnType<typeof saveText>): string {
  expect(save.kind).toBe('saved');
  return save.kind === 'saved' ? save.text : '';
}

function walk(node: JSONContent, out: JSONContent[] = []): JSONContent[] {
  out.push(node);
  for (const c of node.content ?? []) walk(c, out);
  return out;
}
const nodesOf = (editor: Editor) => walk(editor.getJSON());
const typesOf = (editor: Editor) => nodesOf(editor).map((n) => n.type);
const marksOf = (editor: Editor) =>
  nodesOf(editor).flatMap((n) => (n.marks ?? []).map((m) => m.type));

describe('normalisePastedHtml web article', () => {
  it('keeps structure, marks and safe links, and saves', () => {
    const { editor, save } = pasteInto(webArticle);
    const types = typesOf(editor);
    for (const t of [
      'heading',
      'bulletList',
      'orderedList',
      'blockquote',
      'codeBlock',
      'horizontalRule',
      'table',
    ]) {
      expect(types, t).toContain(t);
    }
    const marks = marksOf(editor);
    expect(marks).toContain('bold');
    expect(marks).toContain('italic');
    expect(marks).toContain('link');
    const text = savedText(save);
    expect(text).toContain('h2. Lorem heading');
    expect(text).toContain('[a link|https://example.invalid/page]');
    expect(text).toContain('{code:java}');
  });

  it('flattens table cells (multi-paragraph, lists, nested tables) so the emitter does not throw', () => {
    const { editor, save } = pasteInto(webArticle);
    savedText(save);
    const table = nodesOf(editor).find((n) => n.type === 'table');
    const cells = walk(table as JSONContent).filter(
      (n) => n.type === 'tableCell' || n.type === 'tableHeader',
    );
    for (const cell of cells) {
      expect(cell.content?.every((c) => c.type === 'paragraph')).toBe(true);
      expect(cell.attrs?.colspan ?? 1).toBe(1);
      expect(cell.attrs?.rowspan ?? 1).toBe(1);
    }
    expect(JSON.stringify(table)).toContain('nested');
  });
});

describe('normalisePastedHtml Word', () => {
  it('rebuilds MsoListParagraph runs into a nested bulletList and maps style marks', () => {
    const { editor, save } = pasteInto(word);
    const json = nodesOf(editor);
    const lists = json.filter((n) => n.type === 'bulletList');
    expect(lists.length).toBe(2);
    expect(JSON.stringify(editor.getJSON())).not.toMatch(/supportLists|o:p/);
    const marks = marksOf(editor);
    for (const m of ['bold', 'italic', 'underline', 'strike']) expect(marks, m).toContain(m);
    const text = savedText(save);
    expect(text).toContain('* Top one');
    expect(text).toContain('** Nested one');
    expect(text).toContain('* Top two');
  });

  it('keeps only palette colours through the {color} guard', () => {
    const { editor, save } = pasteInto(word);
    const colours = nodesOf(editor).flatMap((n) =>
      (n.marks ?? []).filter((m) => m.type === 'color').map((m) => m.attrs?.value),
    );
    expect(colours).toEqual(['#de350b']);
    const text = savedText(save);
    expect(text).toContain('{color:#de350b}Red text{color}');
    expect(text).not.toContain('{color:}');
    expect(text).toContain('black text');
    expect(text).toContain('odd text');
  });
});

describe('normalisePastedHtml Google Docs', () => {
  it('does not treat the font-weight:normal guid wrapper as bold', () => {
    const { editor, save } = pasteInto(googleDocs);
    const bolded = nodesOf(editor)
      .filter((n) => n.marks?.some((m) => m.type === 'bold'))
      .map((n) => n.text);
    expect(bolded).not.toContain('Plain docs text with ');
    expect(bolded).toContain('bold');
    const text = savedText(save);
    expect(text).toContain('Plain docs text with *bold* and {color:#0052cc}blue{color} words.');
  });

  it('does not bold a heading from its font-weight style (99 UAT gap)', () => {
    const { save } = pasteInto(googleDocs);
    expect(savedText(save)).toMatch(/^h2\. Docs heading$/m);
  });

  it('keeps explicit <strong> inside a heading', () => {
    const { save } = pasteInto('<h2>Plain <strong>loud</strong></h2>');
    expect(savedText(save)).toContain('h2. Plain *loud*');
  });
});

describe('normalisePastedHtml Jira rendered HTML', () => {
  const ctx = { attachments: [{ filename: 'diagram.png' }] };

  it('maps profile links to mentions and issue links to plain keys', () => {
    const { save } = pasteInto(jiraRendered, ctx);
    const text = savedText(save);
    expect(text).toContain('[~jdoe]');
    expect(text).toContain('[~rroe]');
    expect(text).toContain('DEMO-12');
    expect(text).not.toContain('Demo summary text');
    expect(text).not.toContain('/browse/');
  });

  it('maps emoticon images to emoticon nodes', () => {
    const { editor, save } = pasteInto(jiraRendered, ctx);
    expect(savedText(save)).toContain('(/)');
    const emo = nodesOf(editor).find((n) => n.type === 'emoticon');
    expect(emo?.attrs?.src).toBe('(/)');
  });

  it('maps panels and aui-message macros to panel nodes', () => {
    const { editor, save } = pasteInto(jiraRendered, ctx);
    const text = savedText(save);
    const types = nodesOf(editor)
      .filter((n) => n.type === 'panel')
      .map((n) => n.attrs?.type);
    expect(types).toEqual(['panel', 'info', 'warning']);
    expect(text).toContain('{panel:title=Panel title}');
    expect(text).toContain('{info}');
    expect(text).toContain('{warning}');
  });

  it('maps code and preformatted panels to code blocks', () => {
    const { editor, save } = pasteInto(jiraRendered, ctx);
    const text = savedText(save);
    expect(text).toContain('{code:java}');
    expect(text).toContain('{noformat}');
    const blocks = nodesOf(editor).filter((n) => n.type === 'codeBlock');
    expect(blocks.map((b) => b.attrs?.language)).toEqual(['java', null]);
  });

  it('maps known Jira attachment images to image nodes and does not list them', () => {
    const { result, save } = pasteInto(jiraRendered, ctx);
    expect(savedText(save)).toContain('!diagram.png!');
    expect(result.images).toEqual([]);
  });

  it('leaves unknown attachment images out', () => {
    const { result } = pasteInto(jiraRendered, {});
    expect(result.images).toEqual([]);
    expect(result.html).not.toContain('data-wiki-image');
  });
});

describe('normalisePastedHtml images', () => {
  it('turns data: and http(s) images into ordered markers and drops file: images', () => {
    const html =
      '<p><img src="data:image/png;base64,AAAA" alt="one"> <img src="https://example.invalid/x.png" alt="two"> <img src="file:///x.png"></p>';
    const { result, save } = pasteInto(html);
    expect(result.images).toEqual([
      { marker: 'wiki-paste-image-1', src: 'data:image/png;base64,AAAA', alt: 'one' },
      { marker: 'wiki-paste-image-2', src: 'https://example.invalid/x.png', alt: 'two' },
    ]);
    expect(result.html).toContain('name="wiki-paste-image-1"');
    expect(result.html).not.toContain('file:');
    expect(savedText(save)).toContain('!wiki-paste-image-2!');
  });
});

describe('normalisePastedHtml hostile input', () => {
  it('drops script, handlers, styles and unsafe hrefs but keeps link text', () => {
    const { result, save } = pasteInto(hostile);
    for (const bad of [
      '<script',
      'onerror',
      'onclick',
      'onload',
      'onmouseover',
      'javascript:',
      'data:text',
      'style=',
      '<iframe',
      '<svg',
      '<object',
      'file:',
    ]) {
      expect(result.html, bad).not.toContain(bad);
    }
    expect(result.html).toContain('bad link');
    expect(result.html).toContain('data link');
    expect(result.html).toContain('href="https://example.invalid/ok"');
    const text = savedText(save);
    expect(text).toContain('bad link');
    expect(text).toContain('[good link|https://example.invalid/ok]');
  });

  it('rejects a mention id outside [\\w.@-]', () => {
    expect(normalisePastedHtml(hostile).html).not.toContain('data-wiki-mention');
  });
});
