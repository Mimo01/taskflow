export interface CaretRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

const COPIED = [
  'boxSizing',
  'width',
  'font',
  'letterSpacing',
  'textTransform',
  'textIndent',
  'tabSize',
  'wordSpacing',
  'padding',
  'border',
  'lineHeight',
] as const;

/**
 * Viewport rect of the caret at `index` inside a textarea, measured with a hidden mirror div
 * that copies the textarea's text metrics. The mirror is always removed again.
 */
export function getTextareaCaretRect(el: HTMLTextAreaElement, index: number): CaretRect {
  const mirror = document.createElement('div');
  try {
    const style = getComputedStyle(el);
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.top = '0';
    mirror.style.left = '-9999px';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.overflow = 'hidden';
    for (const prop of COPIED) mirror.style[prop] = style[prop];
    mirror.textContent = el.value.substring(0, index);
    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const mirrorRect = mirror.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const left = box.left + (markerRect.left - mirrorRect.left) - el.scrollLeft;
    const top = box.top + (markerRect.top - mirrorRect.top) - el.scrollTop;
    const height = markerRect.height;
    return { left, top, bottom: top + height, width: 0, height };
  } finally {
    mirror.remove();
  }
}
