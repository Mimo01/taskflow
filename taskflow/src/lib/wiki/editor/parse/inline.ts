import type { JSONContent } from '@tiptap/core';
import { JIRA_EMOTICON_TOKENS } from '../../preprocess';
import { KNOWN_MACROS } from './macros';
import { type LineScan, type MarkSpan, matchMark, scanLine } from './marks';

/**
 * Inline parser for a block's LF text. A single left-to-right scan per line
 * producing text, line breaks and inline atoms (emoticons, mentions, escapes,
 * images, attachments, bracket links, unknown inline macros), followed by a
 * mark pass (marks.ts) that wraps recorded-delimiter spans around the items. Every atom stores its exact
 * source token so the emitter replays it (SAFE-06); spelling is never decoded.
 * Closers are searched on the same line only and every pattern excludes the
 * opening bracket from its body, so the scan stays linear. Never throws.
 */

/** Characters whose backslash escape is modelled as an atom. */
const ESCAPABLE = '*_-+^~?{}[]|!#';

/** One inline item of a line: a source character or an opaque node. */
type Item = { ch: string } | { node: JSONContent };

type MarkJSON = { type: string; attrs: { open: string; close: string; span: number } };

const BARE_LINK = /^[a-z][a-z0-9+.-]*:\S+$/i;

/** Nodes of `items[s, e)` with `active` marks applied; spans are matched recursively. */
function build(
  items: readonly Item[],
  scan: LineScan,
  s: number,
  e: number,
  active: readonly MarkJSON[],
  literal: boolean,
  counter: { n: number },
): JSONContent[] {
  const out: JSONContent[] = [];
  let text = '';
  const flush = (): void => {
    if (text === '') return;
    out.push(active.length ? { type: 'text', text, marks: [...active] } : { type: 'text', text });
    text = '';
  };
  let i = s;
  while (i < e) {
    const item = items[i] as Item;
    if (!literal && 'ch' in item) {
      const sp: MarkSpan | null = matchMark(scan, i, e);
      if (sp) {
        flush();
        const mark: MarkJSON = {
          type: sp.mark,
          attrs: { open: sp.open, close: sp.close, span: counter.n++ },
        };
        out.push(...build(items, scan, sp.cs, sp.ce, [...active, mark], sp.literal, counter));
        i = sp.end;
        continue;
      }
    }
    if ('ch' in item) text += item.ch;
    else {
      flush();
      const node = item.node;
      if (active.length) {
        out.push({ ...node, marks: [...active, ...(node.marks ?? [])] });
      } else out.push(node);
    }
    i++;
  }
  flush();
  return out;
}

export function parseInline(src: string): JSONContent[] {
  const out: JSONContent[] = [];
  const counter = { n: 0 };
  const mention = /\[~([^[\]\n]+)\]/y;
  const attachment = /\[(?:([^[\]|\n]+)\|)?\^([^[\]\n]+)\]/y;
  const link = /\[([^[\]\n|]*)(?:\|([^[\]\n|]*))?\]/y;
  const macro = /\{([A-Za-z][A-Za-z0-9]*)(?::[^{}\n]*)?\}/y;

  const parts = src.split('\n');
  for (let li = 0; li < parts.length; li++) {
    if (li > 0) out.push({ type: 'hardBreak', attrs: { src: '\n' } });
    const line = parts[li] ?? '';
    const items: Item[] = [];
    const atom = (node: JSONContent): void => {
      items.push({ node });
    };
    let i = 0;
    while (i < line.length) {
      const ch = line[i] as string;
      if (ch === '\\') {
        if (line[i + 1] === '\\') {
          atom({ type: 'hardBreak', attrs: { src: '\\\\' } });
          i += 2;
          continue;
        }
        const next = line[i + 1];
        if (next !== undefined && ESCAPABLE.includes(next)) {
          atom({ type: 'escape', attrs: { src: `\\${next}` } });
          i += 2;
          continue;
        }
      } else if (ch === '(') {
        const token = JIRA_EMOTICON_TOKENS.find((t) => line.startsWith(t, i));
        if (token) {
          atom({ type: 'emoticon', attrs: { src: token } });
          i += token.length;
          continue;
        }
      } else if (ch === '[') {
        mention.lastIndex = i;
        const m = mention.exec(line);
        if (m) {
          const body = m[1] ?? '';
          const acct = /^accountid:(.+)$/i.exec(body);
          atom({ type: 'mention', attrs: { id: acct ? acct[1] : body, src: m[0] } });
          i += m[0].length;
          continue;
        }
        attachment.lastIndex = i;
        const a = attachment.exec(line);
        if (a) {
          atom({ type: 'attachment', attrs: { name: a[2], label: a[1] ?? null, src: a[0] } });
          i += a[0].length;
          continue;
        }
        link.lastIndex = i;
        const l = link.exec(line);
        if (l) {
          const label = l[1] ?? '';
          const href = l[2];
          const named = href !== undefined && label !== '' && href !== '';
          const bare = href === undefined && BARE_LINK.test(label);
          if (named || bare) {
            atom({
              type: 'text',
              text: label,
              marks: [
                {
                  type: 'link',
                  attrs: { href: named ? href : label, form: named ? 'named' : 'bare', src: l[0] },
                },
              ],
            });
            i += l[0].length;
            continue;
          }
        }
      } else if (ch === '!') {
        const close = line.indexOf('!', i + 1);
        if (close > i + 1) {
          const x = line.slice(i + 1, close);
          if (!/^\s|\s$/.test(x)) {
            const bar = x.indexOf('|');
            atom({
              type: 'image',
              attrs: {
                name: bar === -1 ? x : x.slice(0, bar),
                params: bar === -1 ? null : x.slice(bar + 1),
                src: `!${x}!`,
              },
            });
            i = close + 1;
            continue;
          }
        }
      } else if (ch === '{') {
        macro.lastIndex = i;
        const m = macro.exec(line);
        if (m && !KNOWN_MACROS.has(m[1] ?? '')) {
          atom({ type: 'rawInline', attrs: { raw: m[0] } });
          i += m[0].length;
          continue;
        }
      }
      items.push({ ch });
      i++;
    }
    const mask = items.map((it) => ('ch' in it ? it.ch : '\x01')).join('');
    out.push(...build(items, scanLine(mask), 0, items.length, [], false, counter));
  }
  return out;
}
