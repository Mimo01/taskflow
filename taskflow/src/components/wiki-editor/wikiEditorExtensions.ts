/**
 * wikiEditorExtensions — single source of the TipTap extension/schema set.
 *
 * Used by BOTH:
 *   - jiraToTiptap (load path): generateJSON(html, buildExtensions())
 *   - WikiEditor (render/edit path): useEditor({ extensions: buildExtensions(opts) })
 *
 * Keeping one schema source prevents load/save drift (the jira.ts dual-file lesson).
 */

import { type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Mention } from '@tiptap/extension-mention';
import type { AnyExtension } from '@tiptap/core';

import { RawJiraNode } from './extensions/RawJiraNode';
import { JiraColorMark } from './extensions/JiraColorMark';
import { JiraCalloutNode } from './extensions/JiraCalloutNode';

export interface BuildExtensionsOpts {
  /**
   * Optional: pass a configured mention extension (from createMentionExtension).
   * When omitted the load-path mention extension is used (parses <mention data-id>
   * but has no suggestion UI — suitable for generateJSON / headless use).
   */
  mention?: AnyExtension;
}

/**
 * A minimal mention extension for the load path (jiraToTiptap / generateJSON).
 * Parses <mention data-id="..."> emitted by preprocessJiraMarkup.
 * No suggestion UI — that is wired in createMentionExtension (Task 4).
 */
const LoadPathMention = Mention.extend({
  parseHTML() {
    return [
      // Standard TipTap mention span (WYSIWYG render output)
      {
        tag: `span[data-type="${this.name}"]`,
      },
      // Jira preprocessor output: <mention data-id="...">
      // jiraToTiptap pre-processes the HTML to add data-is-account-id="true"
      // and stores data-id="accountId:XXX" for [~accountId:XXX] mentions.
      // Username mentions stay as data-id="username".
      {
        tag: 'mention[data-id]',
        getAttrs: (el) => {
          const element = el as HTMLElement;
          const rawId = element.getAttribute('data-id') ?? '';
          return {
            id: rawId,
            label: element.textContent ?? '',
          };
        },
      },
    ];
  },
}).configure({
  // No suggestion in load-path use — provide a no-op to suppress TipTap warning
  suggestion: {
    char: '@',
    command: () => {},
    items: async () => [],
    render: () => ({
      onStart: () => {},
      onUpdate: () => {},
      onKeyDown: () => false,
      onExit: () => {},
    }),
  },
});

/**
 * Build the full TipTap extension set for wiki editing.
 * Returns the same schema for both load (jiraToTiptap) and edit (WikiEditor).
 */
export function buildExtensions(opts: BuildExtensionsOpts = {}): Extensions {
  const base: Extensions = [
    StarterKit.configure({
      // StarterKit v3 includes: document, paragraph, text, bold, italic, strike,
      // code, codeBlock, heading, blockquote, bulletList, orderedList, listItem,
      // listKeymap, hardBreak, horizontalRule, link, underline, dropcursor, gapcursor
      // Keep all defaults — they all map to Jira wiki constructs.
      codeBlock: {
        // Allow language attribute (used for {code:lang}...{code} serialization)
        HTMLAttributes: {},
      },
    }),
    Table.configure({ resizable: false }),
    TableRow,
    TableCell,
    TableHeader,
    TaskList,
    TaskItem.configure({ nested: false }),
    RawJiraNode,
    JiraColorMark,
    JiraCalloutNode,
    // Use the caller-supplied mention extension (full UI) or the load-path one (parse-only)
    opts.mention ?? LoadPathMention,
  ];

  return base;
}
