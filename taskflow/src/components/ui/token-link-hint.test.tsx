import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { openExternal } from '@/lib/openExternal';
import { TokenLinkHint } from './token-link-hint';

vi.mock('@/lib/openExternal', () => ({ openExternal: vi.fn() }));

describe('TokenLinkHint', () => {
  it('renders nothing without a url', () => {
    const { container } = render(<TokenLinkHint url={null} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('opens the url externally', () => {
    render(<TokenLinkHint url="https://x.example.com/t" />);
    fireEvent.click(screen.getByRole('button', { name: 'Create a token' }));
    expect(openExternal).toHaveBeenCalledWith('https://x.example.com/t');
  });
});
