/**
 * Word clipboard rewrites (D-13). Runs on the inert DOMParser document before the allowlist
 * walk: drops conditional comments and namespaced elements, and rebuilds `MsoListParagraph`
 * runs into real nested lists.
 */

const COMMENT_NODE_FILTER = 128; // NodeFilter.SHOW_COMMENT

const LEVEL = /level(\d+)/i;
const ORDERED_BULLET = /^\s*(?:\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)]/;

interface ListFrame {
  level: number;
  list: Element;
}

function isListParagraph(p: Element): boolean {
  const style = p.getAttribute('style') ?? '';
  return /^MsoListParagraph/i.test(p.getAttribute('class') ?? '') || /mso-list/i.test(style);
}

function levelOf(p: Element): number {
  const m = LEVEL.exec(p.getAttribute('style') ?? '');
  const n = m?.[1] ? Number.parseInt(m[1], 10) : 1;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : 1;
}

/** Remove the bullet/number span and report whether it looked like a number. */
function takeBullet(p: Element): boolean {
  let ordered = false;
  for (const span of Array.from(p.querySelectorAll('span'))) {
    if (!/mso-list\s*:\s*ignore/i.test(span.getAttribute('style') ?? '')) continue;
    if (ORDERED_BULLET.test(span.textContent ?? '')) ordered = true;
    span.remove();
  }
  return ordered;
}

function rewriteListParagraphs(doc: Document): void {
  const roots = new Map<Element, ListFrame[]>();
  for (const p of Array.from(doc.body.querySelectorAll('p'))) {
    if (!isListParagraph(p) || !p.parentNode) continue;
    const ordered = takeBullet(p);
    const level = levelOf(p);
    const prev = p.previousElementSibling;
    let stack = prev ? roots.get(prev) : undefined;
    const makeList = () => doc.createElement(ordered ? 'ol' : 'ul');
    if (!stack) {
      const list = makeList();
      p.before(list);
      stack = [{ level, list }];
      roots.set(list, stack);
    }
    while (stack.length > 1 && (stack[stack.length - 1] as ListFrame).level > level) stack.pop();
    let top = stack[stack.length - 1] as ListFrame;
    if (level > top.level) {
      const list = makeList();
      const lastLi = top.list.lastElementChild;
      (lastLi ?? top.list).appendChild(list);
      top = { level, list };
      stack.push(top);
    }
    const li = doc.createElement('li');
    while (p.firstChild) li.appendChild(p.firstChild);
    top.list.appendChild(li);
    p.remove();
  }
}

export function applyWordRewrites(doc: Document): void {
  const walker = doc.createTreeWalker(doc, COMMENT_NODE_FILTER);
  const comments: Node[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) comments.push(n);
  for (const c of comments) c.parentNode?.removeChild(c);
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    if (el.tagName.includes(':')) el.remove();
  }
  rewriteListParagraphs(doc);
}
