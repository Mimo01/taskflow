import type { Editor, Range } from '@tiptap/core';
import { useSettingsStore } from '@/stores/settings.store';
import { createSuggestionExtension, type SuggestionRow } from './create-suggestion';
import { filterSlashItems, SLASH_ITEMS, type SlashItem } from './slash-items';

const toRow = (item: SlashItem, group: SuggestionRow['group'], prefix = ''): SuggestionRow => ({
  key: `${prefix}${item.id}`,
  label: item.label,
  icon: item.icon,
  group,
  data: item,
});

function recentRows(): SuggestionRow[] {
  const ids = useSettingsStore.getState().recentSlashItems ?? [];
  const rows: SuggestionRow[] = [];
  for (const id of ids) {
    const item = SLASH_ITEMS.find((i) => i.id === id);
    if (item) rows.push(toRow(item, 'Recent', 'recent:'));
  }
  return rows.slice(0, 3);
}

/**
 * Runs `item` so the /query deletion and the block change land in ONE transaction: every
 * `editor.chain()` the item opens starts with the range deletion, and a chain is a single
 * transaction (one undo).
 */
function runWithDeletion(editor: Editor, range: Range, item: SlashItem): void {
  const scoped = new Proxy(editor, {
    get(target, prop) {
      if (prop === 'chain') return () => target.chain().deleteRange(range);
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  item.run(scoped);
}

export const WikiSlashSuggestion = createSuggestionExtension({
  name: 'wikiSlash',
  char: '/',
  allowedPrefixes: [' ', ' '],
  startOfLine: false,
  maxRows: 10,
  closeOnEmpty: true,
  items: ({ query }) =>
    query
      ? filterSlashItems(query).map((i) => toRow(i, i.group))
      : [...recentRows(), ...SLASH_ITEMS.map((i) => toRow(i, i.group))],
  command: ({ editor, range, row }) => {
    const item = row.data as SlashItem;
    runWithDeletion(editor, range, item);
    useSettingsStore.getState().pushRecentSlashItem(item.id);
  },
});
