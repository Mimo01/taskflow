/**
 * Copy-menu items for one API log entry (shared by the inspector menu).
 */
import { entryToJson, entryToMarkdown } from '../../lib/dev-tools/copy-format';
import { buildCurl } from '../../lib/dev-tools/curl';
import type { ApiLogEntry } from '../../stores/debug-log.store';
import type { CopyMenuItem } from './dev-tools-ui';

export function copyActionsFor(entry: ApiLogEntry): CopyMenuItem[] {
  return [
    { label: 'Copy URL', getText: () => entry.url },
    { label: 'Copy as cURL', getText: () => buildCurl(entry) },
    {
      label: 'Copy response',
      getText: () => entry.responseBody,
      disabled: !entry.responseBody,
    },
    {
      label: 'Copy request body',
      getText: () => entry.requestBody ?? '',
      disabled: !entry.requestBody,
    },
    { label: 'Copy log entry as JSON', getText: () => entryToJson(entry) },
    { label: 'Copy as Markdown', getText: () => entryToMarkdown(entry) },
  ];
}
