import { JIRA_EMOTICON_MAP, JIRA_EMOTICON_TOKENS } from '@/lib/wiki/preprocess';

export interface EmoticonEntry {
  token: string;
  name: string;
  keywords: readonly string[];
  glyph: string;
}

const META: Record<string, { name: string; keywords: readonly string[] }> = {
  '(/)': { name: 'check', keywords: ['tick', 'done', 'yes'] },
  '(x)': { name: 'cross', keywords: ['error', 'no'] },
  '(!)': { name: 'warning', keywords: ['alert', 'attention'] },
  '(+)': { name: 'plus', keywords: ['add'] },
  '(-)': { name: 'minus', keywords: ['remove'] },
  '(?)': { name: 'question', keywords: ['help'] },
  '(i)': { name: 'info', keywords: ['information'] },
  '(*r)': { name: 'red star', keywords: ['star', 'red'] },
  '(*g)': { name: 'green star', keywords: ['star', 'green'] },
  '(*b)': { name: 'blue star', keywords: ['star', 'blue'] },
  '(*y)': { name: 'yellow star', keywords: ['star', 'yellow'] },
  '(*)': { name: 'star', keywords: ['favourite'] },
  '(on)': { name: 'light on', keywords: ['bulb', 'idea'] },
  '(off)': { name: 'light off', keywords: ['bulb', 'mute'] },
  '(flagoff)': { name: 'flag off', keywords: ['flag', 'white'] },
  '(flag)': { name: 'flag', keywords: ['red', 'mark'] },
};

export const EMOTICONS: readonly EmoticonEntry[] = JIRA_EMOTICON_TOKENS.map((token, i) => {
  const meta = META[token] ?? { name: token, keywords: [token] };
  return {
    token,
    name: meta.name,
    keywords: meta.keywords,
    glyph: JIRA_EMOTICON_MAP[i]?.[1] ?? token,
  };
});

export function emoticonGlyph(token: string): string | undefined {
  return EMOTICONS.find((e) => e.token === token)?.glyph;
}
