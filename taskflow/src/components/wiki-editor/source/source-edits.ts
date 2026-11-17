/** Pure text edit for source-mode toolbar inserts (mirrors DescriptionEditor's insertAtCursor). */
export function applyInsert(
  value: string,
  selStart: number,
  selEnd: number,
  before: string,
  after = '',
): { value: string; selStart: number; selEnd: number } {
  const isBlock = before.startsWith('{') || before.endsWith('\n');
  const midLine = selStart > 0 && value[selStart - 1] !== '\n';
  const lead = isBlock && midLine ? '\n' : '';
  const prefix = lead + before;
  return {
    value:
      value.slice(0, selStart) +
      prefix +
      value.slice(selStart, selEnd) +
      after +
      value.slice(selEnd),
    selStart: selStart + prefix.length,
    selEnd: selEnd + prefix.length,
  };
}
