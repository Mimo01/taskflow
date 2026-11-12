import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { openExternal } from '@/lib/openExternal';
import { TokenLinkHint } from './token-link-hint';

vi.mock('@/lib/openExternal', () => ({ openExternal: vi.fn() }));

describe('TokenLinkHint', () => {
  it('renders nothing without a url', () => {
    const { container } = render(<TokenLinkHint url={null} hint="hint" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('opens the url externally and shows the hint', () => {
    render(<TokenLinkHint url="https://x.example.com/t" hint="some hint" />);
    expect(screen.getByText(/some hint/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create a token' }));
    expect(openExternal).toHaveBeenCalledWith('https://x.example.com/t');
  });
  it('renders detail lines as a list', () => {
    render(
      <TokenLinkHint url="https://x.example.com/t" hint="h" details={['Read: A', 'Use: B']} />,
    );
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Read: A',
      'Use: B',
    ]);
  });
});
