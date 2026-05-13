import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WikiRenderer } from './WikiRenderer';

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn().mockResolvedValue({ ok: false }),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: Object.assign(
    (selector: (s: { jiraBaseUrl: string | null }) => unknown) => selector({ jiraBaseUrl: null }),
    { getState: () => ({ jiraBaseUrl: null }) },
  ),
}));

import { openUrl } from '@tauri-apps/plugin-opener';

describe('WikiRenderer', () => {
  describe('ISSUE-02: wiki markup rendering', () => {
    it('renders bold text from *bold* wiki markup', () => {
      const { container } = render(<WikiRenderer wikiText="*bold*" />);
      // jira2md converts *bold* → **bold**, react-markdown renders as <strong>
      const strong = container.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe('bold');
    });

    it('renders italic text from _italic_ wiki markup', () => {
      const { container } = render(<WikiRenderer wikiText="_italic_" />);
      // jira2md converts _italic_ → *italic*, react-markdown renders as <em>
      const em = container.querySelector('em');
      expect(em).not.toBeNull();
    });

    it('renders code block from {code} wiki markup', () => {
      const { container } = render(<WikiRenderer wikiText="{code}console.log('hi'){code}" />);
      // jira2md converts {code}...{code} to fenced code block; react-markdown renders as <code>
      const code = container.querySelector('code');
      expect(code).not.toBeNull();
    });

    it('renders bullet list from * item wiki markup', () => {
      const { container } = render(<WikiRenderer wikiText="* item one" />);
      const li = container.querySelector('li');
      expect(li).not.toBeNull();
      expect(li?.textContent).toContain('item one');
    });

    it('returns empty output for null/undefined input (no throw)', () => {
      expect(() => render(<WikiRenderer wikiText={null} />)).not.toThrow();
      expect(() => render(<WikiRenderer wikiText={undefined} />)).not.toThrow();
    });

    it('renders plain text unchanged', () => {
      render(<WikiRenderer wikiText="plain text" />);
      expect(screen.getByText('plain text')).toBeTruthy();
    });
  });

  it('wraps output in an article element with prose class', () => {
    const { container } = render(<WikiRenderer wikiText="hello" />);
    const article = container.querySelector('article');
    expect(article).not.toBeNull();
    expect(article?.className).toContain('prose');
  });

  describe('mention rendering', () => {
    it('renders [~john.doe] as a styled badge with @john.doe', () => {
      const { container } = render(<WikiRenderer wikiText="[~john.doe]" />);
      const badge = container.querySelector('span.mention-badge');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toContain('@john.doe');
    });

    it('renders [~accountId:abc123] as @abc123 badge', () => {
      const { container } = render(<WikiRenderer wikiText="[~accountId:abc123]" />);
      const badge = container.querySelector('span.mention-badge');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toContain('@abc123');
    });

    it('renders multiple mentions as separate badges', () => {
      const { container } = render(<WikiRenderer wikiText="[~alice] and [~bob]" />);
      const badges = container.querySelectorAll('span.mention-badge');
      expect(badges.length).toBe(2);
      expect(badges[0]?.textContent).toContain('@alice');
      expect(badges[1]?.textContent).toContain('@bob');
    });

    it('renders mention inside bold markup correctly', () => {
      const { container } = render(<WikiRenderer wikiText="*[~jane]*" />);
      const badge = container.querySelector('span.mention-badge');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toContain('@jane');
    });
  });

  describe('panel/callout rendering', () => {
    it('renders {info}text{info} as a blue-bordered callout', () => {
      const { container } = render(<WikiRenderer wikiText="{info}some info text{info}" />);
      const callout = container.querySelector('[data-callout="info"]');
      expect(callout).not.toBeNull();
      expect(callout?.textContent).toContain('some info text');
    });

    it('renders {warning}text{warning} as an amber-bordered callout', () => {
      const { container } = render(<WikiRenderer wikiText="{warning}caution text{warning}" />);
      const callout = container.querySelector('[data-callout="warning"]');
      expect(callout).not.toBeNull();
      expect(callout?.textContent).toContain('caution text');
    });

    it('renders {note}text{note} as a yellow-bordered callout', () => {
      const { container } = render(<WikiRenderer wikiText="{note}a note{note}" />);
      const callout = container.querySelector('[data-callout="note"]');
      expect(callout).not.toBeNull();
      expect(callout?.textContent).toContain('a note');
    });

    it('renders {panel:title=My Title}content{panel} with title', () => {
      const { container } = render(
        <WikiRenderer wikiText="{panel:title=My Title}content{panel}" />,
      );
      const callout = container.querySelector('[data-callout="panel"]');
      expect(callout).not.toBeNull();
      expect(callout?.textContent).toContain('My Title');
      expect(callout?.textContent).toContain('content');
    });

    it('renders {panel}untitled{panel} without title', () => {
      const { container } = render(<WikiRenderer wikiText="{panel}untitled{panel}" />);
      const callout = container.querySelector('[data-callout="panel"]');
      expect(callout).not.toBeNull();
      expect(callout?.textContent).toContain('untitled');
    });
  });

  describe('image rendering', () => {
    it('renders img with max-width constraint and cursor-pointer', () => {
      // jira2md converts !screenshot.png! to ![](screenshot.png)
      const { container } = render(<WikiRenderer wikiText="!screenshot.png!" />);
      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.className).toContain('max-w-full');
      expect(img?.className).toContain('cursor-pointer');
    });

    it('renders img element for Jira image syntax', () => {
      const { container } = render(<WikiRenderer wikiText="!screenshot.png!" />);
      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toContain('screenshot.png');
    });
  });

  describe('integration: mixed content', () => {
    it('renders mentions, panels, images, bold, and lists together without errors', () => {
      const mixedContent = [
        '*bold text*',
        '',
        '[~john.doe] mentioned this',
        '',
        '{info}important info{info}',
        '',
        '!image.png!',
        '',
        '* list item one',
        '* list item two',
      ].join('\n');

      const { container } = render(<WikiRenderer wikiText={mixedContent} />);

      // Bold renders
      expect(container.querySelector('strong')).not.toBeNull();
      // Mention renders
      expect(container.querySelector('span.mention-badge')).not.toBeNull();
      // Info callout renders
      expect(container.querySelector('[data-callout="info"]')).not.toBeNull();
      // Image renders
      expect(container.querySelector('img')).not.toBeNull();
      // List items render
      const listItems = container.querySelectorAll('li');
      expect(listItems.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('external link routing through openUrl (Plan 54-06)', () => {
    beforeEach(() => {
      vi.mocked(openUrl).mockClear();
    });

    it('renders external [name|url] link, click calls openUrl exactly once', () => {
      render(
        <WikiRenderer wikiText="[VAS.png|https://jira.orange.sk/secure/attachment/123/VAS.png]" />,
      );
      const link = screen.getByRole('link', { name: /VAS\.png/ });
      fireEvent.click(link);
      expect(openUrl).toHaveBeenCalledWith('https://jira.orange.sk/secure/attachment/123/VAS.png');
      expect(openUrl).toHaveBeenCalledTimes(1);
    });

    it('in-document anchor (#section) does NOT call openUrl', () => {
      render(<WikiRenderer wikiText="[See here|#section]" />);
      const link = screen.getByRole('link', { name: /See here/ });
      fireEvent.click(link);
      expect(openUrl).not.toHaveBeenCalled();
    });

    it('falsy/empty href does NOT call openUrl', () => {
      // Use raw HTML <a> without href — rehypeRaw allows raw HTML.
      // Anchors without href lack the implicit "link" role, so query via text.
      render(<WikiRenderer wikiText='<a class="bare">bare anchor</a>' />);
      const anchor = screen.getByText('bare anchor').closest('a');
      expect(anchor).not.toBeNull();
      fireEvent.click(anchor as HTMLAnchorElement);
      expect(openUrl).not.toHaveBeenCalled();
    });
  });

  describe('existing rendering (no regression)', () => {
    it('still renders bold text correctly', () => {
      const { container } = render(<WikiRenderer wikiText="*bold*" />);
      expect(container.querySelector('strong')).not.toBeNull();
    });

    it('still renders italic text correctly', () => {
      const { container } = render(<WikiRenderer wikiText="_italic_" />);
      expect(container.querySelector('em')).not.toBeNull();
    });

    it('still renders code blocks correctly', () => {
      const { container } = render(<WikiRenderer wikiText="{code}hello{code}" />);
      expect(container.querySelector('code')).not.toBeNull();
    });

    it('still renders lists correctly', () => {
      const { container } = render(<WikiRenderer wikiText="* item" />);
      expect(container.querySelector('li')).not.toBeNull();
    });
  });
});
