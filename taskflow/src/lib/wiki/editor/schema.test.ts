import { describe, expect, it } from 'vitest';
import { wikiSchema } from './schema';

const NODES = [
  'doc',
  'paragraph',
  'text',
  'heading',
  'horizontalRule',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'hardBreak',
  'table',
  'tableRow',
  'tableHeader',
  'tableCell',
  'panel',
  'rawBlock',
  'rawInline',
  'emoticon',
  'mention',
  'escape',
  'image',
  'attachment',
];
const MARKS = [
  'bold',
  'italic',
  'strike',
  'underline',
  'link',
  'sup',
  'sub',
  'cite',
  'mono',
  'color',
];

const p = (...content: object[]) => ({ type: 'paragraph', content });
const t = (text: string, marks?: object[]) => ({ type: 'text', text, ...(marks ? { marks } : {}) });

const FULL_DOC = {
  type: 'doc',
  attrs: { eol: 'crlf', tail: 1 },
  content: [
    { type: 'heading', attrs: { level: 2, sep: '' }, content: [t('Title')] },
    p(
      t('b', [{ type: 'bold', attrs: { open: '{*}', close: '{*}' } }]),
      t('i', [{ type: 'italic' }]),
      t('s', [{ type: 'strike' }]),
      t('u', [{ type: 'underline' }]),
      t('l', [{ type: 'link', attrs: { href: 'https://example.com', form: 'bare' } }]),
      t('sup', [{ type: 'sup' }]),
      t('sub', [{ type: 'sub' }]),
      t('cite', [{ type: 'cite' }]),
      t('mono', [{ type: 'mono' }]),
      t('red', [{ type: 'color', attrs: { value: 'red', span: 'c1' } }]),
      { type: 'hardBreak', attrs: { src: '\\\\' } },
      { type: 'rawInline', attrs: { raw: '{status:colour=Green}' } },
      { type: 'emoticon', attrs: { src: '(/)' } },
      { type: 'mention', attrs: { id: 'jdoe' } },
      { type: 'escape', attrs: { src: '\\*' } },
      { type: 'image', attrs: { name: 'diagram.png', params: 'thumbnail' } },
      { type: 'attachment', attrs: { name: 'spec.pdf' } },
    ),
    { type: 'horizontalRule' },
    {
      type: 'bulletList',
      attrs: { marker: '-' },
      content: [
        {
          type: 'listItem',
          content: [
            p(t('a')),
            {
              type: 'orderedList',
              content: [
                { type: 'listItem', content: [p(t('b')), { type: 'panel', content: [p(t('x'))] }] },
              ],
            },
          ],
        },
      ],
    },
    { type: 'blockquote', attrs: { form: 'macro' }, content: [p(t('q'))] },
    { type: 'codeBlock', attrs: { language: 'java', open: '{code:java}' }, content: [t('int a;')] },
    {
      type: 'panel',
      attrs: { type: 'info', params: 'title=Steps' },
      content: [p(t('x')), { type: 'panel', attrs: { type: 'tip' }, content: [p(t('y'))] }],
    },
    {
      type: 'table',
      attrs: { headerless: true },
      content: [
        {
          type: 'tableRow',
          attrs: { indent: ' ', close: '|' },
          content: [
            { type: 'tableHeader', attrs: { padL: ' ' }, content: [p(t('h'))] },
            {
              type: 'tableCell',
              attrs: { padR: ' ' },
              content: [p(t('c')), { type: 'panel', content: [p(t('z'))] }],
            },
          ],
        },
      ],
    },
    { type: 'rawBlock', attrs: { raw: '{expand}x{expand}' } },
  ],
};

describe('wikiSchema', () => {
  it('has every node and mark, and no StarterKit code mark', () => {
    const nodes = Object.keys(wikiSchema.nodes);
    const marks = Object.keys(wikiSchema.marks);
    for (const n of NODES) expect(nodes).toContain(n);
    for (const m of MARKS) expect(marks).toContain(m);
    expect(marks).not.toContain('code');
  });

  it('validates a doc that uses every node and mark', () => {
    expect(() => wikiSchema.nodeFromJSON(FULL_DOC).check()).not.toThrow();
  });

  it('rejects a table row holding a bare paragraph', () => {
    const bad = {
      type: 'doc',
      content: [{ type: 'table', content: [{ type: 'tableRow', content: [p(t('x'))] }] }],
    };
    expect(() => wikiSchema.nodeFromJSON(bad).check()).toThrow();
  });

  it('rejects a rawInline at block level', () => {
    const bad = { type: 'doc', content: [{ type: 'rawInline', attrs: { raw: '{x}' } }] };
    expect(() => wikiSchema.nodeFromJSON(bad).check()).toThrow();
  });

  it('defaults spelling attributes', () => {
    for (const name of [
      'paragraph',
      'heading',
      'horizontalRule',
      'bulletList',
      'orderedList',
      'blockquote',
      'codeBlock',
      'table',
      'panel',
      'rawBlock',
    ]) {
      expect(wikiSchema.nodes[name]?.createAndFill()?.attrs.gap, name).toBe(1);
    }
    expect(wikiSchema.nodes.doc?.createAndFill()?.attrs).toMatchObject({ eol: 'lf', tail: 0 });
    expect(wikiSchema.nodes.table?.createAndFill()?.attrs.headerless).toBe(false);
  });

  it('is a module-scope singleton', async () => {
    const again = await import('./schema');
    expect(again.wikiSchema).toBe(wikiSchema);
  });
});
