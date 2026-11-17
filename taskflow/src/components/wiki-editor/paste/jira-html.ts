/**
 * Jira rendered-HTML rewrites (D-14). Runs on the inert DOMParser document and only emits the
 * `data-wiki-*` marker markup the allowlist walk re-validates. Anything not confidently mapped
 * is left alone and falls through to the generic allowlist (plain paragraphs).
 */
import { JIRA_EMOTICON_TOKENS } from '@/lib/wiki/preprocess';

export interface NormaliseContext {
  jiraBaseUrl?: string | null;
  attachments?: readonly { filename: string }[];
}

const USERNAME = /^[\w.@-]+$/;
const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;
const BROWSE = /\/browse\/([A-Z][A-Z0-9_]+-\d+)(?:[/?#]|$)/;
const ATTACHMENT_PATH = /\/secure\/(?:attachment|thumbnail)\/\d+\/([^/?#]+)/;
const BAD_NAME = /[!|\n{}[\]]/;

function parseUrl(href: string): URL | null {
  try {
    return new URL(href, 'https://placeholder.invalid');
  } catch {
    return null;
  }
}

function userOf(a: Element): string | null {
  const rel = a.getAttribute('rel');
  if (a.classList.contains('user-hover') && rel && USERNAME.test(rel)) return rel;
  const url = parseUrl(a.getAttribute('href') ?? '');
  if (url && /ViewProfile\.jspa$/i.test(url.pathname)) {
    const name = url.searchParams.get('name');
    if (name && USERNAME.test(name)) return name;
  }
  return null;
}

function issueKeyOf(a: Element): string | null {
  const href = a.getAttribute('href') ?? '';
  const fromHref = BROWSE.exec(parseUrl(href)?.pathname ?? '')?.[1];
  if (fromHref) return fromHref;
  if (a.classList.contains('issue-link')) {
    const key = a.getAttribute('data-issue-key') ?? '';
    if (ISSUE_KEY.test(key)) return key;
  }
  return null;
}

function marker(doc: Document, tag: string, attr: string, attrs: Record<string, string>) {
  const el = doc.createElement(tag);
  el.setAttribute(attr, '');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function rewriteLinks(doc: Document): void {
  for (const a of Array.from(doc.querySelectorAll('a'))) {
    const user = userOf(a);
    if (user) {
      a.replaceWith(marker(doc, 'span', 'data-wiki-mention', { id: user }));
      continue;
    }
    const key = issueKeyOf(a);
    if (key) a.replaceWith(doc.createTextNode(key));
  }
}

function attachmentName(src: string, ctx: NormaliseContext): string | null {
  const url = parseUrl(src);
  const seg = ATTACHMENT_PATH.exec(url?.pathname ?? '')?.[1];
  if (!seg) return null;
  let name = seg;
  try {
    name = decodeURIComponent(seg);
  } catch {
    return null;
  }
  if (BAD_NAME.test(name)) return null;
  return ctx.attachments?.some((x) => x.filename === name) ? name : null;
}

function rewriteImages(doc: Document, ctx: NormaliseContext): void {
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    const alt = img.getAttribute('alt') ?? '';
    if (img.classList.contains('emoticon') && JIRA_EMOTICON_TOKENS.includes(alt)) {
      img.replaceWith(marker(doc, 'span', 'data-wiki-emoticon', { src: alt }));
      continue;
    }
    const name = attachmentName(img.getAttribute('src') ?? '', ctx);
    if (name) img.replaceWith(marker(doc, 'span', 'data-wiki-image', { name }));
  }
}

const AUI_TYPES: readonly (readonly [RegExp, string])[] = [
  [/\b(?:note-macro|aui-message-note)\b/, 'note'],
  [/\b(?:tip-macro|aui-message-tip|aui-message-success|success-macro)\b/, 'tip'],
  [/\b(?:warning-macro|aui-message-warning)\b/, 'warning'],
  [/\b(?:information-macro|aui-message-info)\b/, 'info'],
];

function panelEl(doc: Document, type: string, title: string | null): HTMLElement {
  const el = marker(doc, 'div', 'data-wiki-panel', { 'data-type': type, type });
  const clean = (title ?? '').replace(/[}|\n\r]/g, ' ').trim();
  if (clean) el.setAttribute('params', `title=${clean}`);
  return el;
}

function moveChildren(from: Element, to: Element): void {
  while (from.firstChild) to.appendChild(from.firstChild);
}

function rewriteCodePanels(doc: Document): void {
  for (const div of Array.from(doc.querySelectorAll('div.code.panel'))) {
    const pre = div.querySelector('pre');
    if (!pre) continue;
    const lang = /\bcode-([a-z]+)\b/.exec(pre.getAttribute('class') ?? '')?.[1];
    const out = doc.createElement('pre');
    const code = doc.createElement('code');
    if (lang && lang !== 'none') code.setAttribute('class', `language-${lang}`);
    code.textContent = pre.textContent ?? '';
    out.appendChild(code);
    div.replaceWith(out);
  }
  for (const div of Array.from(doc.querySelectorAll('div.preformatted.panel'))) {
    const pre = div.querySelector('pre');
    if (!pre) continue;
    const out = marker(doc, 'pre', 'data-wiki-noformat', {});
    out.textContent = pre.textContent ?? '';
    div.replaceWith(out);
  }
}

function rewritePanels(doc: Document): void {
  for (const div of Array.from(doc.querySelectorAll('div.panel')).reverse()) {
    const content = div.querySelector(':scope > .panelContent');
    if (!content) continue;
    const header = div.querySelector(':scope > .panelHeader');
    const out = panelEl(doc, 'panel', header?.textContent ?? null);
    moveChildren(content, out);
    div.replaceWith(out);
  }
  for (const div of Array.from(doc.querySelectorAll('div.aui-message')).reverse()) {
    const cls = div.getAttribute('class') ?? '';
    const type = AUI_TYPES.find(([re]) => re.test(cls))?.[1];
    if (!type) continue;
    for (const icon of Array.from(div.querySelectorAll('.aui-icon'))) icon.remove();
    const content = div.querySelector(':scope > .message-content') ?? div;
    const out = panelEl(doc, type, null);
    moveChildren(content, out);
    div.replaceWith(out);
  }
}

export function applyJiraRewrites(doc: Document, ctx: NormaliseContext): void {
  rewriteLinks(doc);
  rewriteImages(doc, ctx);
  rewriteCodePanels(doc);
  rewritePanels(doc);
}
