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
 *   2. jira2md.to_markdown() — converts Jira → markdown
 *   3. fixMarkdownLinkUnderscores() — fixes URL corruption from jira2md italic pass
 *   4. jira2md.md_to_html() — markdown → HTML (via marked)
 *   5. generateJSON(html, buildExtensions()) — HTML → TipTap JSONContent
 *      Custom parseHTML rules on RawJiraNode, JiraColorMark, JiraCalloutNode, mention
 *      node capture the special tags emitted in step 1.
 *   6. Post-process: scan for unrecognized {macro} patterns and wrap in rawJira nodes.
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
