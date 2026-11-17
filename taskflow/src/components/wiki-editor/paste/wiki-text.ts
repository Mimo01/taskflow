/**
 * "Clearly wiki" plain-text heuristic for paste (D-12). Pure: no editor imports. The paste
 * plugin owns the loadWiki check and the plain-mode skip; this only answers "does this text
 * look like Jira wiki markup rather than prose or markdown".
 */

const MAX_LENGTH = 200_000;

const IMAGE_EXT = 'png|jpe?g|gif|webp|svg|bmp';

const STRONG: readonly RegExp[] = [
  /\{(?:code|noformat|panel|info|note|warning|tip|quote)(?::[^}\n]*)?\}/,
  /\{color:[^}\n]+\}/,
  /^h[1-6]\.\s/m,
  /^\|\|.+\|\|/m,
  /^bq\.\s/m,
  /\[~[\w.@-]+\]/,
  /\[\^[^\]\n]+\]/,
  new RegExp(`!\\S[^!\\n]*\\.(?:${IMAGE_EXT})(?:\\|[^!\\n]*)?!`, 'i'),
  /^----\s*$/m,
];

/** Weak signals: two DISTINCT kinds needed. `*word*` must not be part of markdown `**word**`. */
const WEAK: readonly RegExp[] = [
  /^(?:\*+|#+)\s\S.*\n(?:\*+|#+)\s\S/m,
  /(?<![\w*])\*[^*\s][^*\n]*\*(?![\w*])/,
  /(?<![\w_])_[^_\s][^_\n]*_(?![\w_])/,
  /(?<![\w+])\+[^+\s][^+\n]*\+(?![\w+])/,
  /\{\{[^}\n]+\}\}/,
  /\[[^\]|\n]+\|[^\]\n]+\]/,
];

export function looksLikeWiki(text: string): boolean {
  if (text.length > MAX_LENGTH) return false;
  if (STRONG.some((re) => re.test(text))) return true;
  let weak = 0;
  for (const re of WEAK) if (re.test(text)) weak++;
  return weak >= 2;
}
