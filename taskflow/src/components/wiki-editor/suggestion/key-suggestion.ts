import { closeHistory } from '@tiptap/pm/history';
import { searchJiraForLink } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { getHost } from '../host';
import { knownPrefixes } from '../issue-key-decoration';
import { createSuggestionExtension, type SuggestionRow } from './create-suggestion';

const KEY_BEFORE_CARET = /(?:^|[^A-Za-z0-9_/.:-])([A-Z][A-Z0-9_]+)-(\d*)$/;

/** Typing a known project prefix plus a dash (ABC-) suggests issues; inserts the plain key. */
export const WikiIssueKeySuggestion = createSuggestionExtension({
  name: 'wikiIssueKey',
  char: '-',
  maxRows: 8,
  debounce: 250,
  emptyText: 'No matching issues',
  // Once digits are typed the text is already a key: Enter must not swap it for row 0 (CR-01).
  commitNeedsNavigation: (query) => /-\d+$/.test(query),
  findSuggestionMatch: ({ $position }) => {
    const offset = $position.parentOffset;
    const before = $position.parent.textBetween(0, offset, undefined, '\ufffc');
    const m = KEY_BEFORE_CARET.exec(before);
    if (!m) return null;
    const prefix = m[1];
    const start = offset - (prefix.length + 1 + m[2].length);
    const base = $position.start();
    return {
      range: { from: base + start, to: base + offset },
      query: `${prefix}-${m[2]}`,
      text: `${prefix}-${m[2]}`,
    };
  },
  allow: ({ editor, state, range }) => {
    const prefix = state.doc.textBetween(range.from, range.to).split('-')[0];
    return knownPrefixes(editor).includes(prefix);
  },
  items: async ({ query, editor }): Promise<SuggestionRow[]> => {
    const { queryClient } = getHost(editor);
    const baseUrl = useAuthStore.getState().jiraBaseUrl;
    if (!queryClient || !baseUrl) return [];
    const projectKey = query.split('-')[0];
    const issues = await queryClient.fetchQuery({
      queryKey: ['wiki-editor-issue-search', baseUrl, projectKey, query],
      queryFn: async () => {
        const token = await readSecret('jira-pat').catch(() => '');
        if (!token) return [];
        return searchJiraForLink(baseUrl, token, projectKey, query);
      },
      staleTime: 30_000,
    });
    // An exact key match ranks first, ahead of issues that merely mention it.
    const ranked = [...issues].sort((a, b) => Number(b.key === query) - Number(a.key === query));
    return ranked.map((i) => ({
      key: i.key,
      label: i.key,
      mono: true,
      detail: i.fields?.summary,
      data: i.key,
    }));
  },
  command: ({ editor, range, row }) => {
    // Own undo step: one undo restores the typed prefix.
    editor.view.dispatch(closeHistory(editor.state.tr));
    editor
      .chain()
      .focus()
      .insertContentAt(range, `${String(row.data)} `)
      .run();
  },
});
