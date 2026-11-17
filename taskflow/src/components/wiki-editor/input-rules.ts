import {
  Extension,
  InputRule,
  markInputRule,
  textblockTypeInputRule,
  wrappingInputRule,
} from '@tiptap/core';
import type { NodeType } from '@tiptap/pm/model';
import { JIRA_EMOTICON_TOKENS } from '@/lib/wiki/preprocess';

// Mark rules: the LAST capture group is the inner text (see markInputRule).
const BOLD_RE = /(?:^|\s)(\*\*?([^\s*](?:[^*]*[^\s*])?)\*\*?)$/;
const ITALIC_RE = /(?:^|\s)(_([^\s_](?:[^_]*[^\s_])?)_)$/;
const STRIKE_RE = /(?:^|\s)(-([^\s-](?:[^-]*[^\s-])?)-)$/;
const UNDERLINE_RE = /(?:^|\s)(\+([^\s+](?:[^+]*[^\s+])?)\+)$/;
const SUP_RE = /(\^([^\s^]+)\^)$/;
const SUB_RE = /(~([^\s~]+)~)$/;
const MONO_RE = /(\{\{([^{}]+)\}\})$/;

const WIKI_HEADING_RE = /^h([1-6])\.\s$/;
const MD_HEADING_RE = /^(#{2,6})\s$/;
const ORDERED_RE = /^#\s$/;
const CODE_RE = /^\{code(?::([a-z]+))?\}$/;
const NOFORMAT_RE = /^\{noformat\}$/;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Longest token first. Only the real Jira tokens convert; ":)" and "(y)" are not Jira (C2).
const EMOTICON_TOKENS_LONGEST_FIRST = [...JIRA_EMOTICON_TOKENS].sort((a, b) => b.length - a.length);

/** Typing the closing paren of a full Jira emoticon token converts it to an emoticon node. */
function emoticonRule(token: string, type: NodeType): InputRule {
  return new InputRule({
    find: new RegExp(`${escapeRe(token)}$`),
    handler: ({ state, range }) => {
      const { $from } = state.selection;
      if ($from.parent.type.spec.code) return null;
      const marks = state.storedMarks ?? $from.marks();
      if (marks.some((m) => m.type.name === 'mono')) return null;
      state.tr.replaceWith(range.from, range.to, type.create({ src: token }));
    },
  });
}

/** Wiki meaning wins over TipTap's markdown defaults (they are excluded by EDITOR_RULE_OPTIONS). */
export const WikiInputRules = Extension.create({
  name: 'wikiInputRules',
  addInputRules() {
    const { marks, nodes } = this.editor.schema;
    return [
      markInputRule({ find: BOLD_RE, type: marks.bold }),
      markInputRule({ find: ITALIC_RE, type: marks.italic }),
      markInputRule({ find: STRIKE_RE, type: marks.strike }),
      markInputRule({ find: UNDERLINE_RE, type: marks.underline }),
      markInputRule({ find: SUP_RE, type: marks.sup }),
      markInputRule({ find: SUB_RE, type: marks.sub }),
      markInputRule({ find: MONO_RE, type: marks.mono }),
      textblockTypeInputRule({
        find: WIKI_HEADING_RE,
        type: nodes.heading,
        getAttributes: (m) => ({ level: Number(m[1]) }),
      }),
      textblockTypeInputRule({
        find: MD_HEADING_RE,
        type: nodes.heading,
        getAttributes: (m) => ({ level: (m[1] as string).length }),
      }),
      wrappingInputRule({ find: ORDERED_RE, type: nodes.orderedList }),
      textblockTypeInputRule({
        find: CODE_RE,
        type: nodes.codeBlock,
        getAttributes: (m) => ({ language: m[1] ?? null }),
      }),
      textblockTypeInputRule({
        find: NOFORMAT_RE,
        type: nodes.codeBlock,
        getAttributes: () => ({ language: null, open: '{noformat}', close: '{noformat}' }),
      }),
      ...EMOTICON_TOKENS_LONGEST_FIRST.map((token) =>
        emoticonRule(token, nodes.emoticon as NodeType),
      ),
    ];
  },
});
