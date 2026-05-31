/**
 * jiraWikiSerializer — ProseMirror/TipTap JSONContent → Jira wiki markup.
 *
 * Implements the full mapping table from RESEARCH "Round-Trip Mapping".
 * Walks the TipTap JSONContent tree recursively, emitting Jira wiki syntax
 * for each node type and mark type.
 *
 * Key design decisions (from PLAN decisions):
 * - RawJiraNode: emits attrs.raw VERBATIM — the #1 lossless guarantee
 * - Mentions: accountId-shaped id → [~accountId:id], else → [~id]
 * - Task list: (/) for checked, (x) for unchecked (D-OQ1 convention)
 * - Single-paragraph blockquote → bq. prefix; multi-line → {quote}...{quote}
 * - codeBlock with lang → {code:lang}...{code}; no lang → {code}...{code}
 * - JiraColorMark → {color:#hex}...{color}
 * - JiraCalloutNode kind=panel/title → {panel:title=T}...{panel}
 *   kind=info/warning/note → {info}...{info} etc.
 *
 * No DOM or React required — operates purely on JSONContent.
 */

import type { JSONContent } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialize a TipTap JSONContent doc to Jira wiki markup string.
 */
export function serializeToJiraWiki(doc: JSONContent): string {
  if (!doc) return '';

  // Accept non-doc root nodes for direct unit testing (e.g. taskList)
  if (doc.type !== 'doc') {
    return serializeBlock(doc, { listDepth: 0 }).trim();
  }

  const lines: string[] = [];
  for (const node of doc.content ?? []) {
    const serialized = serializeBlock(node, { listDepth: 0 });
    if (serialized !== '') {
      lines.push(serialized);
    }
  }

  // Collapse 3+ consecutive newlines to 2, then trim
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------------------
// Context passed through recursion
// ---------------------------------------------------------------------------

interface SerCtx {
  listDepth: number;
}

// ---------------------------------------------------------------------------
// Block node serializer
// ---------------------------------------------------------------------------

function serializeBlock(node: JSONContent, ctx: SerCtx): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map((n) => serializeBlock(n, ctx)).join('\n');

    case 'paragraph': {
      const text = serializeInlineContent(node.content ?? []);
      return text;
    }

    case 'heading': {
      const level = (node.attrs?.['level'] as number | undefined) ?? 1;
      const text = serializeInlineContent(node.content ?? []);
      return `h${level}. ${text}`;
    }

    case 'bulletList':
      return serializeList(node, '*', ctx.listDepth + 1);

    case 'orderedList':
      return serializeList(node, '#', ctx.listDepth + 1);

    case 'listItem': {
      // Direct call fallback: extract first paragraph text
      const firstPara = (node.content ?? []).find((n) => n.type === 'paragraph');
      return firstPara ? serializeInlineContent(firstPara.content ?? []) : '';
    }

    case 'taskList':
      return serializeTaskList(node);

    case 'taskItem': {
      const checked = node.attrs?.['checked'] === true;
      const prefix = checked ? '(/) ' : '(x) ';
      const text = (node.content ?? [])
        .map((n) => serializeBlock(n, { listDepth: 0 }))
        .join('')
        .trim();
      return `${prefix}${text}`;
    }

    case 'blockquote':
      return serializeBlockquote(node);

    case 'codeBlock': {
      const lang = (node.attrs?.['language'] as string | null | undefined) ?? '';
      // extractPlainText may include a trailing newline from TipTap's codeBlock model — trim it
      const code = extractPlainText(node).replace(/\n$/, '');
      const header = lang ? `{code:${lang}}` : '{code}';
      return `${header}\n${code}\n{code}`;
    }

    case 'horizontalRule':
      return '----';

    case 'table':
      return serializeTable(node);

    case 'tableRow':
      return serializeTableRow(node);

    case 'rawJira':
      // Verbatim passthrough — never modify this content
      return (node.attrs?.['raw'] as string | undefined) ?? '';

    case 'jiraCallout':
      return serializeCallout(node);

    case 'hardBreak':
      return '\\\\';

    case 'text':
      return serializeTextWithMarks(node);

    case 'mention':
      return serializeMention(node);

    default:
      // Unknown node type — degrade gracefully by extracting text
      return extractPlainText(node);
  }
}

// ---------------------------------------------------------------------------
// List serializers
// ---------------------------------------------------------------------------

function serializeList(listNode: JSONContent, marker: string, depth: number): string {
  const prefix = marker.repeat(depth);
  const lines: string[] = [];

  for (const item of listNode.content ?? []) {
    if (item.type !== 'listItem') continue;
    const children = item.content ?? [];

    // First child is the paragraph with the item text
    const firstChild = children[0];
    const rest = children.slice(1);

    const lineText = firstChild?.type === 'paragraph'
      ? serializeInlineContent(firstChild.content ?? [])
      : serializeBlock(firstChild ?? { type: 'paragraph' }, { listDepth: depth });

    lines.push(`${prefix} ${lineText}`);

    // Nested lists (bulletList / orderedList inside this listItem)
    for (const nested of rest) {
      if (nested.type === 'bulletList') {
        lines.push(serializeList(nested, '*', depth + 1));
      } else if (nested.type === 'orderedList') {
        lines.push(serializeList(nested, '#', depth + 1));
      } else {
        const s = serializeBlock(nested, { listDepth: depth });
        if (s) lines.push(s);
      }
    }
  }

  return lines.join('\n');
}

function serializeTaskList(node: JSONContent): string {
  const lines: string[] = [];
  for (const item of node.content ?? []) {
    if (item.type !== 'taskItem') continue;
    const checked = item.attrs?.['checked'] === true;
    const prefix = checked ? '(/) ' : '(x) ';
    const text = (item.content ?? [])
      .map((n) => serializeBlock(n, { listDepth: 0 }))
      .join('')
      .trim();
    lines.push(`${prefix}${text}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Blockquote serializer
// ---------------------------------------------------------------------------

function serializeBlockquote(node: JSONContent): string {
  const children = node.content ?? [];

  if (children.length === 1 && children[0].type === 'paragraph') {
    const paraContent = children[0].content ?? [];
    // If the paragraph contains a hardBreak, it's a multi-line quote —
    // the {quote} preprocessor collapses multiple lines into one paragraph
    // with <br> separators. Detect and emit {quote}...{quote} in that case.
    const hasHardBreak = paraContent.some((n) => n.type === 'hardBreak');
    if (!hasHardBreak) {
      const text = serializeInlineContent(paraContent);
      return `bq. ${text}`;
    }
    // Multi-line single paragraph: split at hardBreaks and emit {quote} form
    const lines = splitAtHardBreaks(paraContent);
    return `{quote}\n${lines.join('\n')}\n{quote}`;
  }

  // Multi-paragraph → {quote}...{quote}
  const inner = children.map((n) => serializeBlock(n, { listDepth: 0 })).join('\n');
  return `{quote}\n${inner}\n{quote}`;
}

/**
 * Split an array of inline JSONContent nodes at hardBreak boundaries.
 * Returns an array of line strings.
 */
function splitAtHardBreaks(nodes: JSONContent[]): string[] {
  const lines: string[] = [];
  let current: JSONContent[] = [];
  for (const n of nodes) {
    if (n.type === 'hardBreak') {
      lines.push(serializeInlineContent(current));
      current = [];
    } else {
      current.push(n);
    }
  }
  lines.push(serializeInlineContent(current));
  return lines;
}

// ---------------------------------------------------------------------------
// Table serializer
// ---------------------------------------------------------------------------

function serializeTable(node: JSONContent): string {
  return (node.content ?? [])
    .filter((n) => n.type === 'tableRow')
    .map(serializeTableRow)
    .join('\n');
}

function serializeTableRow(row: JSONContent): string {
  const cells = row.content ?? [];
  if (cells.length === 0) return '';

  const isHeader = cells[0].type === 'tableHeader';

  const cellTexts = cells.map((cell) => {
    const content = cell.content ?? [];
    // Cell may contain a single paragraph or direct inline content
    if (content.length === 1 && content[0].type === 'paragraph') {
      return serializeInlineContent(content[0].content ?? []);
    }
    return content.map((n) => serializeBlock(n, { listDepth: 0 })).join('');
  });

  if (isHeader) {
    return `||${cellTexts.join('||')}||`;
  }
  return `|${cellTexts.join('|')}|`;
}

// ---------------------------------------------------------------------------
// Callout serializer
// ---------------------------------------------------------------------------

function serializeCallout(node: JSONContent): string {
  const kind = (node.attrs?.['kind'] as string | undefined) ?? 'panel';
  const title = node.attrs?.['title'] as string | null | undefined;
  const inner = (node.content ?? [])
    .map((n) => serializeBlock(n, { listDepth: 0 }))
    .join('\n');

  if (kind === 'panel') {
    const header = title ? `{panel:title=${title}}` : '{panel}';
    return `${header}\n${inner}\n{panel}`;
  }

  // info, warning, note
  return `{${kind}}\n${inner}\n{${kind}}`;
}

// ---------------------------------------------------------------------------
// Mention serializer
// ---------------------------------------------------------------------------

function serializeMention(node: JSONContent): string {
  const id = (node.attrs?.['id'] as string | undefined) ?? '';
  // jiraToTiptap stores accountId-form mentions as "accountId:XXX" in the id attr
  // (with the prefix intact) so we can round-trip [~accountId:XXX] without guessing.
  if (id.startsWith('accountId:')) {
    return `[~${id}]`;
  }
  // Long hex strings and JIRAUSER keys are Cloud accountIds
  const isAccountId = /^[a-f0-9]{24,}$/i.test(id) || id.startsWith('JIRAUSER');
  if (isAccountId) {
    return `[~accountId:${id}]`;
  }
  return `[~${id}]`;
}

// ---------------------------------------------------------------------------
// Inline content serializer
// ---------------------------------------------------------------------------

function serializeInlineContent(nodes: JSONContent[]): string {
  return nodes
    .map((n) => {
      if (n.type === 'hardBreak') return '\\\\';
      if (n.type === 'mention') return serializeMention(n);
      if (n.type === 'text') return serializeTextWithMarks(n);
      // Other inline nodes (e.g. rawJira used inline) — recurse
      return serializeBlock(n, { listDepth: 0 });
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Text node with marks
// ---------------------------------------------------------------------------

function serializeTextWithMarks(node: JSONContent): string {
  if (node.type !== 'text') {
    // Fallback for non-text nodes called via inline path
    return serializeBlock(node, { listDepth: 0 });
  }

  let text = node.text ?? '';
  const marks = node.marks ?? [];

  // Apply marks. Order matters for correct nesting.
  // Process marks in a stable order (same order TipTap applies them).
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        text = `*${text}*`;
        break;
      case 'italic':
        text = `_${text}_`;
        break;
      case 'strike':
        text = `-${text}-`;
        break;
      case 'code':
        text = `{{${text}}}`;
        break;
      case 'link': {
        const href = (mark.attrs?.['href'] as string | undefined) ?? '';
        if (!text || text === href) {
          text = `[${href}]`;
        } else {
          text = `[${text}|${href}]`;
        }
        break;
      }
      case 'jiraColor': {
        const color = (mark.attrs?.['color'] as string | undefined) ?? '';
        text = `{color:${color}}${text}{color}`;
        break;
      }
      case 'underline':
        text = `+${text}+`;
        break;
      // Other marks degrade gracefully as plain text
    }
  }

  return text;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function extractPlainText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  if (!node.content) return '';
  return node.content.map(extractPlainText).join('');
}
