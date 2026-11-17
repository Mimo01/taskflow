import type { JiraAssignableUser } from '@/services/jira/types';
import { createSuggestionExtension, type SuggestionRow } from './create-suggestion';
import { searchPeople } from './search';

function toRow(user: JiraAssignableUser): SuggestionRow {
  const urls = user.avatarUrls;
  const url = urls?.['24x24'] ?? (urls ? Object.values(urls)[0] : undefined);
  return {
    key: user.name,
    label: user.displayName,
    detail: user.name,
    avatar: { url, name: user.displayName },
    data: user,
  };
}

/** `@` person mention: server-side search per query, inserts a mention node plus a space. */
export const WikiMentionSuggestion = createSuggestionExtension({
  name: 'wikiMention',
  char: '@',
  allowedPrefixes: [' ', '(', '['],
  debounce: 250,
  maxRows: 8,
  emptyText: 'No matching people',
  items: async ({ query, editor, signal }) =>
    (await searchPeople(editor, query, signal)).map(toRow),
  command: ({ editor, range, row }) => {
    const user = row.data as JiraAssignableUser;
    editor
      .chain()
      .focus()
      .insertContentAt(range, [
        { type: 'mention', attrs: { id: user.name, src: null } },
        { type: 'text', text: ' ' },
      ])
      .run();
  },
});
