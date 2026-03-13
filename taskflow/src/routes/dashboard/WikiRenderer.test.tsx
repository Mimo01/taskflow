import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { WikiRenderer } from './WikiRenderer'

describe('WikiRenderer', () => {
  describe('ISSUE-02: wiki markup rendering', () => {
    it('renders bold text from *bold* wiki markup', () => {
      const { container } = render(<WikiRenderer wikiText="*bold*" />)
      // jira2md converts *bold* → **bold**, react-markdown renders as <strong>
      const strong = container.querySelector('strong')
      expect(strong).not.toBeNull()
      expect(strong?.textContent).toBe('bold')
    })

    it('renders italic text from _italic_ wiki markup', () => {
      const { container } = render(<WikiRenderer wikiText="_italic_" />)
      // jira2md converts _italic_ → *italic*, react-markdown renders as <em>
      const em = container.querySelector('em')
      expect(em).not.toBeNull()
    })

    it('renders code block from {code} wiki markup', () => {
      const { container } = render(<WikiRenderer wikiText="{code}console.log('hi'){code}" />)
      // jira2md converts {code}...{code} to fenced code block; react-markdown renders as <code>
      const code = container.querySelector('code')
      expect(code).not.toBeNull()
    })

    it('renders bullet list from * item wiki markup', () => {
      const { container } = render(<WikiRenderer wikiText="* item one" />)
      const li = container.querySelector('li')
      expect(li).not.toBeNull()
      expect(li?.textContent).toContain('item one')
    })

    it('returns empty output for null/undefined input (no throw)', () => {
      expect(() => render(<WikiRenderer wikiText={null} />)).not.toThrow()
      expect(() => render(<WikiRenderer wikiText={undefined} />)).not.toThrow()
    })

    it('renders plain text unchanged', () => {
      render(<WikiRenderer wikiText="plain text" />)
      expect(screen.getByText('plain text')).toBeTruthy()
    })
  })

  it('wraps output in an article element with prose class', () => {
    const { container } = render(<WikiRenderer wikiText="hello" />)
    const article = container.querySelector('article')
    expect(article).not.toBeNull()
    expect(article?.className).toContain('prose')
  })
})
