import { describe, expect, it } from 'vitest';
import { isTypingTarget } from './typing-target';

function editable(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'isContentEditable', { value: true });
  return el;
}

describe('isTypingTarget', () => {
  it('is false for null and plain elements', () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
  });

  it('is true for form fields', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      expect(isTypingTarget(document.createElement(tag))).toBe(true);
    }
  });

  it('is true for contenteditable elements and their children', () => {
    expect(isTypingTarget(editable())).toBe(true);
    const child = document.createElement('p');
    Object.defineProperty(child, 'isContentEditable', { value: true });
    expect(isTypingTarget(child)).toBe(true);
  });
});
