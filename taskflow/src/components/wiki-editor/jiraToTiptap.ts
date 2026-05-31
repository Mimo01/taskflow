/**
 * jiraToTiptap — load path: Jira wiki markup → TipTap JSON (JSONContent).
 *
 * Reuses the existing WikiRenderer pipeline (preprocessJiraMarkup + jira2md)
 * to avoid writing a second Jira→HTML parser (MEMORY: jira.ts dual-file lesson).
 *
 * Pipeline:
 *   1. preprocessJiraMarkup(wiki) — handles emoticons, mentions, panels, color,
 *      tables, hard-breaks, images. Emits HTML-enriched text with custom tags:
 *      <mention data-id>, <div data-callout>, <span data-color>, etc.
 *      NOTE: (/) → ✅  and  (x) → ❌  here (emoticon substitution).
 *   2. jira2md.to_markdown() — converts Jira → markdown
 *   3. fixMarkdownLinkUnderscores() — fixes URL corruption from jira2md italic pass
 *   4. jira2md.md_to_html() — markdown → HTML (via marked)
 *   5. generateJSON(html, buildExtensions()) — HTML → TipTap JSONContent
 *      Custom parseHTML rules on RawJiraNode, JiraColorMark, JiraCalloutNode, mention
 *      node capture the special tags emitted in step 1.
 *   6. Post-process: scan for unrecognized {macro} patterns and wrap in rawJira nodes.
 *   7. Post-process: reconvert task-item paragraphs back to taskList/taskItem nodes
 *      (CR-04). preprocessJiraMarkup converts (/) → ✅ and (x) → ❌ for rendering,
 *      so after generateJSON those appear as paragraphs starting with ✅/❌. We
 *      detect consecutive such paragraphs at the top level and replace them with a
 *      real taskList so they round-trip back as interactive checkboxes.
 *
 * Note on unknown macros: preprocessJiraMarkup does NOT handle unknown macros —
 * they pass through as literal text. After generateJSON the doc may contain
 * paragraphs with verbatim {macro}...{macro} text. We scan the JSON for these
 * and replace the matching paragraph(s) with rawJira nodes.
 */

import type { AnyExtension, JSONContent } from '@tiptap/core';
import { generateJSON } from '@tiptap/html';
// @ts-expect-error — jira2md has no default export type declarations
import j2m from 'jira2md';

import {
  type AttachmentMap,
  preprocessJiraMarkup,
  type UserMap,
} from '@/routes/dashboard/WikiRenderer';
import { buildExtensions } from './wikiEditorExtensions';

// Re-export for use in tests
export type { AttachmentMap, UserMap };

/**
 * fixMarkdownLinkUnderscores — same fix as in WikiRenderer (private there).
 * Restores underscores in URLs that jira2md's italic pass corrupted to *.
 */
function fixMarkdownLinkUnderscores(md: string): string {
  let result = md.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_match, text: string, url: string) => {
    const fixedUrl = url.replace(/\*/g, '_');
    const fixedText = /^https?:\/\//.test(text) ? text.replace(/\*/g, '_') : text;
    return `[${fixedText}](${fixedUrl})`;
  });
  result = result.replace(/<(https?:\/\/[^>]*)>/g, (_match, url: string) => {
    return `<${url.replace(/\*/g, '_')}>`;
  });
  return result;
}

/**
 * Convert Jira wiki markup to HTML using the WikiRenderer pipeline.
 * This is the shared step between WikiRenderer and jiraToTiptap.
 */
export function jiraWikiToHtml(wiki: string, attachments?: AttachmentMap, users?: UserMap): string {
  const preprocessed = preprocessJiraMarkup(wiki, attachments, users);
  const markdown = fixMarkdownLinkUnderscores(j2m.to_markdown(preprocessed));
  // j2m.md_to_html uses marked internally — same parser WikiRenderer uses
  // (WikiRenderer calls remark but for TipTap load we use marked which is
  // already bundled with jira2md; the HTML output is equivalent for our schema)
  const html = j2m.md_to_html(markdown);
  return html;
}

/**
 * Mark <mention data-id> elements that originated from [~accountId:XXX] so the
 * serializer can emit [~accountId:XXX] on save.
 *
 * preprocessJiraMarkup converts [~accountId:XXX] → <mention data-id="XXX"> and
 * [~username] → <mention data-id="username"> — both end up with just data-id.
 * We re-scan the original wiki to identify which ids were accountId-form and mark
 * the HTML with data-is-account-id="true" so the mention extension can store that.
 *
 * Strategy: extract all accountId values from the original wiki, then do a string
 * replace on the HTML to add the data-is-account-id attribute.
 */
function markAccountIdMentions(html: string, wiki: string): string {
  const ACCOUNT_ID_RE = /\[~accountId:([^\]]+)\]/g;
  let result = html;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((match = ACCOUNT_ID_RE.exec(wiki)) !== null) {
    const accountId = match[1];
    // Replace <mention data-id="accountId"> with <mention data-id="accountId:accountId" data-is-account-id="true">
    // We store "accountId:XXX" as the id so the serializer can detect and emit [~accountId:XXX]
    result = result.replace(
      new RegExp(`<mention data-id="${escapeRegex(accountId)}"`, 'g'),
      `<mention data-id="accountId:${accountId}" data-is-account-id="true"`,
    );
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface JiraToTiptapOpts {
  attachments?: AttachmentMap;
  users?: UserMap;
  mention?: AnyExtension;
}

/**
 * Convert Jira wiki markup to TipTap JSONContent.
 *
 * @param wiki — Jira wiki markup string (the canonical value stored/loaded)
 * @param opts — optional attachments, users map, mention extension
 * @returns TipTap JSONContent (doc node)
 */
export function jiraToTiptap(wiki: string, opts: JiraToTiptapOpts = {}): JSONContent {
  if (!wiki || !wiki.trim()) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const extensions = buildExtensions({ mention: opts.mention });

  // Step 1-4: Jira wiki → HTML via the shared pipeline
  const rawHtml = jiraWikiToHtml(wiki, opts.attachments, opts.users);
  // Step 4b: mark accountId mentions so the serializer can round-trip [~accountId:XXX]
  const html = markAccountIdMentions(rawHtml, wiki);

  // Step 5: HTML → TipTap JSON using the shared extension schema
  let doc: JSONContent;
  try {
    doc = generateJSON(html, extensions) as JSONContent;
  } catch {
    // Fallback: wrap the raw wiki as a rawJira node so nothing is lost
    return {
      type: 'doc',
      content: [
        {
          type: 'rawJira',
          attrs: { raw: wiki },
        },
      ],
    };
  }

  // Step 6: scan for residual {macro}...{macro} patterns in text nodes
  // and wrap those paragraphs as rawJira nodes to guarantee lossless passthrough.
  doc = wrapUnknownMacros(doc, wiki);

  // Step 7 (CR-04): reconvert ✅/❌-prefixed paragraphs back to taskList nodes.
  // preprocessJiraMarkup converts (/) → ✅ and (x) → ❌ before the pipeline, so
  // serialized task items arrive as plain paragraphs after generateJSON. We detect
  // consecutive groups of these at the top level and replace them with taskList so
  // they reload as interactive checkboxes rather than static emoji text.
  doc = reconvertTaskItems(doc);

  return doc;
}

/**
 * Scan the JSONContent tree for paragraphs whose text content contains
 * {someMacro}...{someMacro} patterns that the preprocessor didn't handle
 * (unknown macros). Replace those paragraphs with rawJira atom nodes.
 *
 * We match against the ORIGINAL wiki source to extract verbatim macro blocks
 * and mark them for passthrough. This is the "lossless preservation" guarantee.
 */
function wrapUnknownMacros(doc: JSONContent, originalWiki: string): JSONContent {
  // Extract all {macro}...{macro} blocks from the original wiki that are NOT
  // known macros (the known ones are handled by preprocessJiraMarkup).
  const KNOWN_MACROS = new Set([
    'panel',
    'info',
    'warning',
    'note',
    'quote',
    'code',
    'color',
    'noformat',
    'section',
    'column',
    'anchor',
  ]);

  // Match {macroName...}...{macroName} (greedy, macro name can have params)
  const MACRO_RE = /\{([a-zA-Z][a-zA-Z0-9-]*)(?::[^}]*)?\}([\s\S]*?)\{\1\}/g;
  const unknownBlocks: string[] = [];
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((match = MACRO_RE.exec(originalWiki)) !== null) {
    const macroName = match[1].toLowerCase();
    if (!KNOWN_MACROS.has(macroName)) {
      unknownBlocks.push(match[0]);
    }
  }

  if (unknownBlocks.length === 0) return doc;

  // Walk the doc tree and replace paragraphs containing unknown macro text
  // with rawJira nodes.
  return transformContent(doc, unknownBlocks);
}

function transformContent(node: JSONContent, unknownBlocks: string[]): JSONContent {
  if (!node.content) return node;

  const newContent: JSONContent[] = [];
  for (const child of node.content) {
    if (child.type === 'paragraph') {
      const text = extractText(child);
      const matchingBlock = unknownBlocks.find((block) => text.includes(block.substring(0, 20)));
      if (matchingBlock) {
        newContent.push({
          type: 'rawJira',
          attrs: { raw: matchingBlock },
        });
        continue;
      }
    }
    newContent.push(transformContent(child, unknownBlocks));
  }

  return { ...node, content: newContent };
}

function extractText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  if (!node.content) return '';
  return node.content.map(extractText).join('');
}

// ---------------------------------------------------------------------------
// CR-04: Task-item reconversion post-pass
// ---------------------------------------------------------------------------

const CHECKED_PREFIX = '✅ ';
const UNCHECKED_PREFIX = '❌ ';

type TaskKind = 'checked' | 'unchecked';

/**
 * If the inline text starts with a task-item emoji prefix, return the kind
 * and the text with the prefix stripped. Otherwise return null.
 */
function detectTaskPrefix(text: string): { kind: TaskKind; rest: string } | null {
  if (text.startsWith(CHECKED_PREFIX))
    return { kind: 'checked', rest: text.slice(CHECKED_PREFIX.length) };
  if (text.startsWith(UNCHECKED_PREFIX))
    return { kind: 'unchecked', rest: text.slice(UNCHECKED_PREFIX.length) };
  return null;
}

/**
 * Split a paragraph's inline content at hardBreak boundaries into segments.
 * Each segment is an array of JSONContent inline nodes (no hardBreaks).
 */
function splitAtHardBreaksInline(nodes: JSONContent[]): JSONContent[][] {
  const segments: JSONContent[][] = [];
  let current: JSONContent[] = [];
  for (const n of nodes) {
    if (n.type === 'hardBreak') {
      segments.push(current);
      current = [];
    } else {
      current.push(n);
    }
  }
  segments.push(current);
  return segments;
}

/**
 * Given a segment (array of inline nodes), check if it begins with a task-item
 * emoji prefix (on the first text node). If so, return the kind and the segment
 * with the prefix stripped. Otherwise return null.
 */
function segmentAsTaskItem(
  segment: JSONContent[],
): { kind: TaskKind; content: JSONContent[] } | null {
  if (segment.length === 0) return null;
  const first = segment[0];
  if (first.type !== 'text') return null;
  const detected = detectTaskPrefix(first.text ?? '');
  if (!detected) return null;
  const strippedFirst = detected.rest ? [{ ...first, text: detected.rest }] : [];
  return { kind: detected.kind, content: [...strippedFirst, ...segment.slice(1)] };
}

/**
 * Walk the top-level doc content and convert task-item paragraphs to taskList
 * nodes (CR-04).
 *
 * jira2md collapses adjacent lines into a single <p> with <br> separators, so
 * "(/) Done item\n(x) Todo item" becomes one paragraph with a hardBreak between
 * the two segments. We handle both cases:
 *
 *   (a) A paragraph whose first segment is a task item — split the paragraph at
 *       hardBreak boundaries and collect all task-item segments into a taskList.
 *       Non-task-item trailing segments are re-emitted as a new paragraph.
 *
 *   (b) Consecutive separate top-level paragraphs each starting with a task-item
 *       prefix — grouped into a single taskList (less common but handled).
 *
 * Only operates on the doc's direct children. Task items nested inside blockquotes
 * etc. are not in scope (they wouldn't round-trip anyway).
 */
function reconvertTaskItems(doc: JSONContent): JSONContent {
  if (!doc.content) return doc;

  const newContent: JSONContent[] = [];
  let i = 0;

  while (i < doc.content.length) {
    const node = doc.content[i];

    if (node.type !== 'paragraph') {
      newContent.push(node);
      i++;
      continue;
    }

    // Split the paragraph at hardBreak boundaries
    const segments = splitAtHardBreaksInline(node.content ?? []);

    // Check if the first segment is a task item
    const firstAsTask = segmentAsTaskItem(segments[0]);
    if (firstAsTask === null) {
      newContent.push(node);
      i++;
      continue;
    }

    // This paragraph starts with a task item. Collect all leading task segments.
    const taskItems: JSONContent[] = [];
    const remainingSegments: JSONContent[][] = [];
    let inTaskRegion = true;
    for (const seg of segments) {
      if (inTaskRegion) {
        const asTask = segmentAsTaskItem(seg);
        if (asTask) {
          taskItems.push({
            type: 'taskItem',
            attrs: { checked: asTask.kind === 'checked' },
            content: [{ type: 'paragraph', content: asTask.content }],
          });
        } else {
          inTaskRegion = false;
          if (seg.length > 0) remainingSegments.push(seg);
        }
      } else {
        if (seg.length > 0) remainingSegments.push(seg);
      }
    }

    // Also consume subsequent top-level paragraphs that are task items
    i++;
    while (i < doc.content.length) {
      const next = doc.content[i];
      if (next.type !== 'paragraph') break;
      const nextSegments = splitAtHardBreaksInline(next.content ?? []);
      const nextFirstAsTask = segmentAsTaskItem(nextSegments[0]);
      if (!nextFirstAsTask) break;
      // Consume the whole next paragraph as task items
      for (const seg of nextSegments) {
        const asTask = segmentAsTaskItem(seg);
        if (asTask) {
          taskItems.push({
            type: 'taskItem',
            attrs: { checked: asTask.kind === 'checked' },
            content: [{ type: 'paragraph', content: asTask.content }],
          });
        }
      }
      i++;
    }

    newContent.push({ type: 'taskList', content: taskItems });

    // Re-emit any non-task trailing segments as a new paragraph
    if (remainingSegments.length > 0) {
      const remainingNodes: JSONContent[] = [];
      for (let s = 0; s < remainingSegments.length; s++) {
        if (s > 0) remainingNodes.push({ type: 'hardBreak' });
        remainingNodes.push(...remainingSegments[s]);
      }
      newContent.push({ type: 'paragraph', content: remainingNodes });
    }
  }

  return { ...doc, content: newContent };
}
