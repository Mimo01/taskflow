import { WikiIssueKeyDecoration } from './issue-key-decoration';
import { WikiSmartPaste } from './paste/paste-plugin';
import { WikiEmoticonForce, WikiEmoticonSuggestion } from './suggestion/emoticon-suggestion';
import { WikiIssueKeySuggestion } from './suggestion/key-suggestion';
import { WikiMentionSuggestion } from './suggestion/mention-suggestion';
import { WikiSlashSuggestion } from './suggestion/slash-suggestion';

/**
 * Phase 99 input extensions for the live (rich) editor. Order matters: the emoticon force
 * plugin must precede its suggestion, and WikiSmartPaste is appended after WikiLinkPaste
 * (inside buildEditorExtensions) so URL-over-selection still wins. Module scope, frozen.
 */
export const WIKI_INPUT_EXTENSIONS = Object.freeze([
  WikiIssueKeyDecoration,
  WikiMentionSuggestion,
  WikiEmoticonForce,
  WikiEmoticonSuggestion,
  WikiIssueKeySuggestion,
  WikiSlashSuggestion,
  WikiSmartPaste,
]);
