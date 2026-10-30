import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IssueTypeIcon } from './issue-type-icon';

const COLOURS = ['text-red-500', 'text-green-600', 'text-blue-500', 'text-purple-500'];

describe('IssueTypeIcon', () => {
  it.each([
    'Bug',
    'Story',
    'Subtask',
    'Epic',
    'Task',
  ])('muted %s uses only the muted colour', (t) => {
    const { container } = render(<IssueTypeIcon typeName={t} muted />);
    const cls = container.querySelector('svg')?.getAttribute('class') ?? '';
    expect(cls).toContain('text-muted-foreground');
    for (const c of COLOURS) expect(cls).not.toContain(c);
  });

  it('default rendering keeps the per-type colour', () => {
    const { container } = render(<IssueTypeIcon typeName="Bug" />);
    const cls = container.querySelector('svg')?.getAttribute('class') ?? '';
    expect(cls).toContain('text-red-500');
    expect(cls).not.toContain('text-muted-foreground');
  });
});
