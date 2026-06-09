import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  injectHeaderlessTableSeparators,
  JIRA_EMOTICON_MAP,
  mergeOpenTableRows,
  splitInlineSingleLineTables,
  WikiRenderer,
} from './WikiRenderer';

vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn().mockResolvedValue({ ok: false }),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

// Auth store state shared across tests — each test suite resets it.
const authStoreState = {
  jiraBaseUrl: null as string | null,
  gitlabBaseUrl: null as string | null,
  activeGitlabProject: null as number | null,
  activeGitlabProjectPath: null as string | null,
};

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: Object.assign(
    (selector?: (s: typeof authStoreState) => unknown) =>
      typeof selector === 'function' ? selector(authStoreState) : authStoreState,
    { getState: () => authStoreState },
  ),
}));

// Navigate spy — injected via react-router-dom mock.
const navigateMock = vi.fn();

// Location stub — tests set `locationPathname` to control what useLocation() returns.
let locationPathname = '/';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: locationPathname }),
  };
});

// Breadcrumb store mock (260518-qw8) — shared state object; pushMock mutates it.
type TrailEntry = { path: string; label: string };
const breadcrumbState = { trail: [] as TrailEntry[] };
const pushMock = vi.fn((entry: TrailEntry) => {
  breadcrumbState.trail.push(entry);
});

vi.mock('@/stores/breadcrumb.store', () => ({
  useBreadcrumbStore: Object.assign(
    (selector?: (s: { push: typeof pushMock; trail: TrailEntry[] }) => unknown) =>
      typeof selector === 'function'
        ? selector({ push: pushMock, trail: breadcrumbState.trail })
        : breadcrumbState,
    { getState: () => ({ push: pushMock, trail: breadcrumbState.trail }) },
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

    // WIKI-TT-01: triple-brace teletype macro {{{TEXT}}} → <tt>TEXT</tt>
    it('renders {{{TEST}}} as a <tt> element with textContent "TEST"', () => {
      const { container } = render(<WikiRenderer wikiText="{{{TEST}}}" />);
      const tt = container.querySelector('tt');
      expect(tt).not.toBeNull();
      expect(tt?.textContent).toBe('TEST');
    });

    it('renders {{{hello world}}} as a <tt> element with textContent "hello world" (spaces inside triple-brace work)', () => {
      const { container } = render(<WikiRenderer wikiText="{{{hello world}}}" />);
      const tt = container.querySelector('tt');
      expect(tt).not.toBeNull();
      expect(tt?.textContent).toBe('hello world');
    });

    it('{{someCode}} double-brace monospace still renders as <code> (existing behaviour unchanged)', () => {
      const { container } = render(<WikiRenderer wikiText="{{someCode}}" />);
      const code = container.querySelector('code');
      expect(code).not.toBeNull();
      expect(code?.textContent).toBe('someCode');
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

    it('panels reset first/last-child margins (any element type) to neutralize prose spacing', () => {
      // Round-1 used [&>p:first-child]:mt-0, which only matched <p> first children.
      // When the panel body is an <ol> / <ul> / heading / etc. (e.g. a numbered
      // image-link list inside `{panel}…{panel}`), prose-sm still stacks the
      // element's top/bottom margin on top of the panel's `p-3` padding and the
      // panel still looks doubly-padded. The selector must be universal:
      // [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 — covers <p>, <ol>, <ul>,
      // headings, etc. equally.
      const calloutCases: Array<{ type: string; wikiText: string }> = [
        { type: 'panel', wikiText: '{panel}line 1\n\nline 2{panel}' },
        { type: 'info', wikiText: '{info}line 1\n\nline 2{info}' },
        { type: 'warning', wikiText: '{warning}line 1\n\nline 2{warning}' },
        { type: 'note', wikiText: '{note}line 1\n\nline 2{note}' },
      ];
      for (const { type, wikiText } of calloutCases) {
        const { container } = render(<WikiRenderer wikiText={wikiText} />);
        const callout = container.querySelector(`[data-callout="${type}"]`) as Element;
        expect(callout, `${type}: callout element should exist`).not.toBeNull();
        const cls = callout.className;
        expect(cls, `${type}: should contain [&>*:first-child]:mt-0`).toContain(
          '[&>*:first-child]:mt-0',
        );
        expect(cls, `${type}: should contain [&>*:last-child]:mb-0`).toContain(
          '[&>*:last-child]:mb-0',
        );
      }
    });

    it('inline panel does NOT emit stray leading/trailing <br/> tags around its inner <ol> (round-3 UAT: leading/trailing <br/> inside <span data-callout> added line-height of padding that the [&>*:…] reset could not zero)', () => {
      // Round-3 DOM observation: the rendered span looked like
      //   <span data-callout="panel"> <br/> <ol>…</ol> <br/> </span>
      // Those leading + trailing <br/> tokens are line breaks emitted by
      // `flattenInlineCalloutsForTableRow` substituting the source newlines
      // around `{panel}\n…\n{panel}` to `<br/>`. They each add a line-height
      // of visible space at the top/bottom of the panel, on top of `p-3`.
      // Trimming the inner body BEFORE the newline→<br/> substitution removes
      // those leading/trailing newlines entirely so they never become <br/>.
      const fixture = [
        '||*S.No.*||*Step*||',
        '|1. |Body before panel',
        '{panel}',
        '# [VAS.png|https://jira.orange.sk/secure/attachment/123/VAS.png]',
        '# [Kosik.png|https://jira.orange.sk/secure/attachment/124/Kosik.png]',
        '{panel}|',
      ].join('\n');
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const panelSpan = container.querySelector('[data-callout="panel"]');
      expect(panelSpan).not.toBeNull();
      // The <ol> is present.
      const ol = panelSpan?.querySelector('ol');
      expect(ol).not.toBeNull();
      // The first AND last element children of the panel span must be the
      // <ol>, not a <br>. (If the <br>s leaked through, firstElementChild
      // would be the leading <br>.)
      expect(panelSpan?.firstElementChild?.tagName).toBe('OL');
      expect(panelSpan?.lastElementChild?.tagName).toBe('OL');
      // And there must be NO <br> as a direct child of the panel span.
      const directBrs = Array.from(panelSpan?.children ?? []).filter((c) => c.tagName === 'BR');
      expect(directBrs.length).toBe(0);
    });

    it('inline panel containing an <ol> (table-cell variant) carries the universal margin-reset classes (regression: round-1 [&>p:…] selector missed the ESHOP <ol> case shown in UAT)', () => {
      // ESHOP fixture from Plan 54-09: `{panel}` with a numbered image-link
      // list nested inside a table cell. The renderer emits this as
      // `<span data-callout="panel"><ol>…</ol></span>` — so the panel's only
      // direct child is <ol>, not <p>. Round-1 selector `[&>p:first-child]:mt-0`
      // did not match, prose-sm `<ol>` margins kept stacking on top of `p-3`,
      // and the panel still rendered with doubled apparent padding (UAT screenshot).
      const fixture = [
        '||*S.No.*||*Step*||',
        '|1. |Body before panel',
        '{panel}',
        '# [VAS.png|https://jira.orange.sk/secure/attachment/123/VAS.png]',
        '# [Kosik.png|https://jira.orange.sk/secure/attachment/124/Kosik.png]',
        '{panel}|',
      ].join('\n');
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const panelSpan = container.querySelector('[data-callout="panel"]') as Element;
      expect(panelSpan).not.toBeNull();
      // The panel actually wraps an <ol> (proves the case we're regressing on).
      expect(panelSpan?.querySelector('ol')).not.toBeNull();
      // And the universal selector classes are present (this is what enables
      // the prose-sm <ol> margin to be zeroed — the [&>p:…] selector would
      // not have matched).
      const cls = panelSpan.className;
      expect(cls).toContain('[&>*:first-child]:mt-0');
      expect(cls).toContain('[&>*:last-child]:mb-0');
    });
  });

  describe('quote block rendering (wiki-quote-block-renders-raw)', () => {
    it('renders {quote}text{quote} as a <blockquote> element', () => {
      const { container } = render(<WikiRenderer wikiText="{quote}this is quoted text{quote}" />);
      const bq = container.querySelector('blockquote');
      expect(bq).not.toBeNull();
      expect(bq?.textContent).toContain('this is quoted text');
    });

    it('does NOT render literal {quote} tags as text in the output', () => {
      const { container } = render(<WikiRenderer wikiText="{quote}quoted content{quote}" />);
      expect(container.textContent).not.toContain('{quote}');
    });

    it('renders multi-line {quote} block as a blockquote preserving content', () => {
      const fixture = `{quote}
First line
Second line
{quote}`;
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const bq = container.querySelector('blockquote');
      expect(bq).not.toBeNull();
      expect(bq?.textContent).toContain('First line');
      expect(bq?.textContent).toContain('Second line');
    });

    it('renders {quote} block with styled left border and italic text class', () => {
      const { container } = render(<WikiRenderer wikiText="{quote}styled quote{quote}" />);
      const bq = container.querySelector('blockquote');
      expect(bq).not.toBeNull();
      expect(bq?.className).toContain('border-l-4');
    });

    it('renders {quote} block inside prose alongside other content', () => {
      const fixture = `Before quote
{quote}quoted text{quote}
After quote`;
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const bq = container.querySelector('blockquote');
      expect(bq).not.toBeNull();
      expect(bq?.textContent).toContain('quoted text');
      expect(container.textContent).toContain('Before quote');
      expect(container.textContent).toContain('After quote');
    });

    it('renders bold text inside {quote} block as <strong>', () => {
      const { container } = render(<WikiRenderer wikiText="{quote}*bold text*{quote}" />);
      const bq = container.querySelector('blockquote');
      expect(bq).not.toBeNull();
      expect(bq?.querySelector('strong')).not.toBeNull();
      expect(bq?.textContent).toContain('bold text');
    });

    it('renders italic text inside {quote} block as <em>', () => {
      const { container } = render(<WikiRenderer wikiText="{quote}_italic text_{quote}" />);
      const bq = container.querySelector('blockquote');
      expect(bq).not.toBeNull();
      expect(bq?.querySelector('em')).not.toBeNull();
      expect(bq?.textContent).toContain('italic text');
    });

    it('list item after {quote} block (closing tag on own line) renders outside the blockquote (wiki-renderer-list-in-quote)', () => {
      // Repro: {quote}text\n{quote}\n* item — closing {quote} on its own line produced
      // a trailing "> " empty blockquote line that absorbed the following list item.
      const wiki = `{quote}Finálnu definíciu eventov je potrebné odkonzultovať s analytickým tímom pred implementáciou.
{quote}
* DA lead form: item`;
      const { container } = render(<WikiRenderer wikiText={wiki} />);
      const bq = container.querySelector('blockquote');
      const li = container.querySelector('li');
      // The list item must exist somewhere in the rendered output
      expect(li).not.toBeNull();
      expect(li?.textContent).toContain('DA lead form');
      // The list item must NOT be inside the blockquote
      const liInsideBlockquote = bq?.querySelector('li') ?? null;
      expect(liInsideBlockquote).toBeNull();
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
      navigateMock.mockClear();
      // Ensure jiraBaseUrl is null so tryInternalPath always misses for these tests.
      authStoreState.jiraBaseUrl = null;
      authStoreState.gitlabBaseUrl = null;
      authStoreState.activeGitlabProject = null;
      authStoreState.activeGitlabProjectPath = null;
    });

    it('renders image-extension [name.png|url] as inline text anchor, click opens lightbox (NOT openUrl) — 54-06 UAT follow-up', () => {
      const { container } = render(
        <WikiRenderer wikiText="[VAS.png|https://jira.orange.sk/secure/attachment/123/VAS.png]" />,
      );
      // Prose flow preserved: rendered as text <a>, NOT an inline <img> thumbnail.
      const link = screen.getByRole('link', { name: /VAS\.png/ });
      expect(link.getAttribute('href')).toBe(
        'https://jira.orange.sk/secure/attachment/123/VAS.png',
      );
      // No lightbox open before click.
      expect(container.querySelector('[role="dialog"]')).toBeNull();
      fireEvent.click(link);
      // Click does NOT route to OS browser.
      expect(openUrl).not.toHaveBeenCalled();
      // Click opens the in-app ImageLightbox.
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it('renders non-image external [name|url] link, click calls openUrl exactly once', () => {
      render(<WikiRenderer wikiText="[See PROJ-123|https://jira.orange.sk/browse/PROJ-123]" />);
      const link = screen.getByRole('link', { name: /See PROJ-123/ });
      fireEvent.click(link);
      expect(openUrl).toHaveBeenCalledWith('https://jira.orange.sk/browse/PROJ-123');
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

  // --- Plan 54-07 Gap 3 — nested wiki inside table cells (Branch 3-A) ---
  //
  // Probe E (recorded in 54-PROBE-FINDINGS.md) selected Branch 3-A: a
  // preprocess heuristic that pre-merges multi-line `|cell|` rows so jira2md
  // sees one logical row, and substitutes embedded `{panel}…{panel}` blocks
  // to inline `<span data-callout="panel">…</span>` so the panel content
  // renders INSIDE the table cell.
  //
  // Verbatim ESHOP fixture from 54-06-UAT-FINDINGS.md Finding 1 lines 14-25.
  describe('Gap 3 — nested wiki inside table cells (Branch 3-A)', () => {
    const ATTACHMENT_URL =
      'https://jira.orange.sk/plugins/servlet/aio-tcms/bridge/tcms/browse?c_pId=10134&page=run-details-attachment&params=%7B%22cycleId%22:14041,%22caseId%22:68141,%22runId%22:263794,%22attachmentId%22:150383,%22projectId%22:10134%7D';

    // Pasted verbatim from 54-06-UAT-FINDINGS.md lines 14-25 (do NOT paraphrase).
    // The distinctive token "Plati pre paušály" anchors the acceptance grep.
    const FINDING_1_FIXTURE = [
      '||*S.No.*||*Step*||*Expected Result*||*Actual Result*||',
      '|1. |Nacitanie eshop home page |Kontrola OK |Works as expected|',
      `|2. |{color:#d04437}*FAILED:*{color} Plati pre paušály S, M, L: \\\\ • 5 GB (12657037, 5,13 €) |Kontrola OK |V kosiku mam Pro Biznis M a device na splatky...`,
      '{panel}',
      `# [VAS.png|${ATTACHMENT_URL}]`,
      '{panel}|',
    ].join('\n');

    // Plan 54-09 — verbatim two-item ESHOP fixture (extends FINDING_1_FIXTURE).
    // Round-2 evidence: both VAS.png AND Kosik.png appear inside the SAME `{panel}`
    // block as numbered-list items. Source: .planning/debug/panel-still-breaks-table-round-2.md.
    const KOSIK_URL = 'https://jira.orange.sk/secure/attachment/124/Kosik.png';
    const FINDING_1_TWO_ITEM_FIXTURE = [
      '||*S.No.*||*Step*||*Expected Result*||*Actual Result*||',
      '|1. |Nacitanie eshop home page |Kontrola OK |Works as expected|',
      `|2. |{color:#d04437}*FAILED:*{color} Plati pre paušály S, M, L: \\\\ • 5 GB (12657037, 5,13 €) |Kontrola OK |V kosiku mam Pro Biznis M a device na splatky...`,
      '{panel}',
      `# [VAS.png|${ATTACHMENT_URL}]`,
      `# [Kosik.png|${KOSIK_URL}]`,
      '{panel}|',
    ].join('\n');

    it('renders nested {panel} block + embedded image link inside a table cell on the verbatim ESHOP fixture', () => {
      const { container } = render(<WikiRenderer wikiText={FINDING_1_FIXTURE} />);

      // The table did not break — exactly one wiki table is rendered.
      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      // The {panel} block was substituted to an inline <span data-callout="panel">
      // and rendered INSIDE the table (not as a sibling block-level <div>).
      const panelSpan = table?.querySelector('[data-callout="panel"]');
      expect(panelSpan).not.toBeNull();

      // The VAS.png link is rendered as an <a> inside the panel span (which is
      // inside the table cell). 54-06 made image links open the lightbox via
      // text anchor — preserved here.
      const link = panelSpan?.querySelector('a');
      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toBe(ATTACHMENT_URL);
      expect(link?.textContent).toBe('VAS.png');

      // Distinctive Finding 1 content is in the cell, not stray-rendered above
      // or below the table.
      const failedCell = Array.from(table?.querySelectorAll('td') ?? []).find((td) =>
        td.textContent?.includes('Plati pre paušály'),
      );
      expect(failedCell).toBeDefined();
    });

    it('Plan 54-09 Concern A — mergeOpenTableRows consumes the full panel-bearing row with TWO numbered-list items', () => {
      const fixture = [
        '||*S.No.*||*Step*||*Expected Result*||*Actual Result*||',
        '|1. |Nacitanie eshop home page |Kontrola OK |Works as expected|',
        `|2. |FAILED step |Kontrola OK |Body before panel`,
        '{panel}',
        `# [VAS.png|https://jira.orange.sk/secure/attachment/123/VAS.png]`,
        `# [Kosik.png|https://jira.orange.sk/secure/attachment/124/Kosik.png]`,
        '{panel}|',
      ].join('\n');

      const merged = mergeOpenTableRows(fixture);
      const lines = merged.split('\n');

      // The 6-line panel-bearing row collapses into ONE merged line. Header + row 1 stay,
      // row 2 (lines 3-8 in source) becomes a single line. Expected: 3 lines total.
      expect(lines.length).toBe(3);

      // The merged row 2 line ends with `|` (proper table-row terminator after consumption).
      expect(lines[2].endsWith('|')).toBe(true);

      // BOTH panel list items survive inside the merged row.
      expect(lines[2]).toContain('VAS.png');
      expect(lines[2]).toContain('Kosik.png');

      // The panel body has been flattened to an inline <span data-callout="panel"> — no
      // raw `{panel}` markers remain in the merged row.
      expect(lines[2]).not.toMatch(/\{panel(:|\})/);

      // No raw `\n` characters inside the merged row (they were either substituted to
      // `<br/>` inside the span body or collapsed to a single space outside callouts).
      expect(lines[2].includes('\\n')).toBe(false);
    });

    it('Plan 54-09 Concerns B+C — two-item panel renders both items inside the same `<td>` as `<ol><li>`', () => {
      const { container } = render(<WikiRenderer wikiText={FINDING_1_TWO_ITEM_FIXTURE} />);

      // Anti-regression: single rendered table (no row escape splitting it).
      expect(container.querySelectorAll('table').length).toBe(1);
      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      // tbody has exactly 2 rows (header row in <thead>; data rows in <tbody>).
      const tbody = table?.querySelector('tbody');
      expect(tbody).not.toBeNull();
      expect(tbody?.querySelectorAll('tr').length).toBe(2);

      // The panel span lives inside a <td> of the second data row.
      const secondRow = tbody?.querySelectorAll('tr')[1];
      const panelSpan = secondRow?.querySelector('[data-callout="panel"]');
      expect(panelSpan).not.toBeNull();

      // Concern C — numbered list semantics preserved: <ol> with 2 <li> children.
      const ol = panelSpan?.querySelector('ol');
      expect(ol).not.toBeNull();
      const items = ol?.querySelectorAll('li');
      expect(items?.length).toBe(2);

      // li[0] anchor → VAS.png; li[1] anchor → Kosik.png.
      const link0 = items?.[0]?.querySelector('a');
      expect(link0).not.toBeNull();
      expect(link0?.textContent).toBe('VAS.png');
      expect(link0?.getAttribute('href')).toBe(ATTACHMENT_URL);

      const link1 = items?.[1]?.querySelector('a');
      expect(link1).not.toBeNull();
      expect(link1?.textContent).toBe('Kosik.png');
      expect(link1?.getAttribute('href')).toBe(KOSIK_URL);

      // Concern C — no bare `#` character leaks into the panel span text content.
      expect(panelSpan?.textContent ?? '').not.toMatch(/^\s*#/);
      expect(panelSpan?.textContent ?? '').not.toMatch(/\s#\s/);
    });

    it('Plan 54-09 Concerns B+C — no sibling escape of panel list items outside the table', () => {
      const { container } = render(<WikiRenderer wikiText={FINDING_1_TWO_ITEM_FIXTURE} />);

      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      // Gather text from elements that are NOT inside the table.
      const article = container.querySelector('article') as HTMLElement;
      expect(article).not.toBeNull();
      // Clone the article and remove the table; what remains is "sibling content".
      const cloned = article.cloneNode(true) as HTMLElement;
      for (const t of cloned.querySelectorAll('table')) t.remove();
      const outsideText = cloned.textContent ?? '';

      // Round-2 symptom: `# Kosik.png` (and `# VAS.png`) escaping outside the table.
      // After parser fix, these tokens must NOT appear outside the table at all.
      expect(outsideText).not.toContain('# Kosik.png');
      expect(outsideText).not.toContain('# VAS.png');
      // The link TEXT itself should also live only inside the table.
      expect(outsideText).not.toContain('Kosik.png');
      expect(outsideText).not.toContain('VAS.png');

      // All anchors with these texts must be descendants of the rendered table.
      const allLinks = Array.from(container.querySelectorAll('a'));
      const vasLinks = allLinks.filter((a) => a.textContent === 'VAS.png');
      const kosikLinks = allLinks.filter((a) => a.textContent === 'Kosik.png');
      expect(vasLinks.length).toBeGreaterThanOrEqual(1);
      expect(kosikLinks.length).toBeGreaterThanOrEqual(1);
      for (const link of [...vasLinks, ...kosikLinks]) {
        expect(table?.contains(link)).toBe(true);
      }
    });

    it('Plan 54-09 Concerns B+C — clicking VAS.png or Kosik.png inside the panel opens lightbox, NOT openUrl', () => {
      vi.mocked(openUrl).mockClear();
      const { container } = render(<WikiRenderer wikiText={FINDING_1_TWO_ITEM_FIXTURE} />);

      // No lightbox open before any click.
      expect(container.querySelector('[role="dialog"]')).toBeNull();

      const vasLink = Array.from(container.querySelectorAll('a')).find(
        (a) => a.textContent === 'VAS.png',
      );
      expect(vasLink).toBeDefined();
      fireEvent.click(vasLink as HTMLAnchorElement);
      expect(openUrl).not.toHaveBeenCalled();
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it('Plan 54-09 follow-up — `\\\\` hard-break immediately before `{panel}` (no space) renders panel on a new line', () => {
      // Real Jira ESHOP source from round-3 UAT feedback: the wiki body contains
      // `text\\{panel}` (zero whitespace between the `\\` hard-break marker and
      // the `{panel}` open). Jira native render puts the panel block on a new
      // line below the preceding text. Without the fix, our parser leaves the
      // literal `\\` as text and the panel `<span>` sits inline with the prose.
      const FIXTURE_NO_SPACE = [
        '||*Header*||*Result*||',
        `|Row 1 |Prefix text\\\\{panel}`,
        `# [VAS.png|${ATTACHMENT_URL}]`,
        '# [Kosik.png|https://jira.orange.sk/secure/attachment/124/Kosik.png]',
        '{panel}|',
      ].join('\n');

      const { container } = render(<WikiRenderer wikiText={FIXTURE_NO_SPACE} />);

      // Anti-regression: exactly one rendered table.
      expect(container.querySelectorAll('table').length).toBe(1);

      const table = container.querySelector('table');
      const cell = table?.querySelectorAll('tbody td')[1]; // the second-column Result cell
      expect(cell).not.toBeNull();

      // The cell must contain a <br/> hard break BEFORE the panel <span>.
      // (The `\\` literally preceded the `{panel}` open in the source — that
      // marker is the hard break per Jira wiki spec, and it must put the panel
      // on a new line visually.)
      const cellChildren = Array.from(cell?.childNodes ?? []);
      const brIndex = cellChildren.findIndex(
        (n) => n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === 'BR',
      );
      const panelIndex = cellChildren.findIndex(
        (n) =>
          n.nodeType === Node.ELEMENT_NODE &&
          (n as Element).getAttribute?.('data-callout') === 'panel',
      );
      expect(brIndex).toBeGreaterThanOrEqual(0);
      expect(panelIndex).toBeGreaterThan(brIndex);

      // Literal `\\` must NOT appear as text in the cell.
      expect(cell?.textContent ?? '').not.toMatch(/\\\\/);

      // Panel still has its <ol><li> contents with both items.
      const panelSpan = cell?.querySelector('[data-callout="panel"]');
      const ol = panelSpan?.querySelector('ol');
      expect(ol).not.toBeNull();
      expect(ol?.querySelectorAll('li').length).toBe(2);
    });

    it('Plan 54-09 Concern B — title panel with embedded wiki link does NOT split the table', () => {
      const fixture = [
        '||*Header*||*Result*||',
        `|Row 1 |Body before panel`,
        '{panel:title=Steps}',
        `# [VAS.png|${ATTACHMENT_URL}]`,
        '{panel}|',
      ].join('\n');

      const { container } = render(<WikiRenderer wikiText={fixture} />);

      // Anti-regression: exactly one rendered table.
      expect(container.querySelectorAll('table').length).toBe(1);
      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      // The panel-with-title carries data-callout="panel"; the title "Steps" is
      // rendered as visible text inside the panel span (markdownComponents.span
      // emits the title as a styled inner <span class="font-bold">).
      const panelSpan = table?.querySelector('[data-callout="panel"]');
      expect(panelSpan).not.toBeNull();
      expect(panelSpan?.textContent ?? '').toContain('Steps');

      // The link is rendered as an <a> descendant of the table.
      const link = panelSpan?.querySelector('a');
      expect(link).not.toBeNull();
      expect(link?.textContent).toBe('VAS.png');
      expect(link?.getAttribute('href')).toBe(ATTACHMENT_URL);
      expect(table?.contains(link as Node)).toBe(true);
    });

    it('T-54-07-01 — <script> payload inside a table cell does NOT inject a script element (no XSS surface)', () => {
      const fixture =
        '||header||\n|cell with <script data-test="injected">alert(1)</script> payload|\n|next row|\n{panel}\nfoo\n{panel}|';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      // rehype-sanitize must strip the <script> element entirely — neither a
      // raw script tag NOR an attribute-marked one is present in the DOM.
      expect(container.querySelector('script')).toBeNull();
      expect(container.querySelector('script[data-test="injected"]')).toBeNull();
      // The surrounding cell text is still rendered (table did not break).
      expect(container.textContent ?? '').toContain('cell with');
      expect(container.textContent ?? '').toContain('payload');
    });

    it('T-54-07-01 — <script> payload outside a table also strips the script element (rehype-sanitize covers all surfaces)', () => {
      const { container } = render(<WikiRenderer wikiText="<script>alert(1)</script> in prose" />);
      expect(container.querySelector('script')).toBeNull();
      // Surrounding prose text is preserved (only the <script> element body is stripped).
      expect(container.textContent ?? '').toContain('in prose');
    });

    it('T-54-07-01 — on-* event handler attributes are stripped (no JS execution surface via attributes)', () => {
      const { container } = render(
        <WikiRenderer wikiText='<a href="https://example.com" onclick="alert(1)">click</a>' />,
      );
      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      // The onclick attribute is stripped — only href + sanitized attrs remain.
      expect(link?.getAttribute('onclick')).toBeNull();
    });

    it('Plan 54-08 Gap 3 — wiki table inside a constrained-width parent is wrapped in an overflow-x-auto container (regression: panel content no longer breaks outer column layout)', () => {
      const { container } = render(
        <div style={{ width: 300 }} data-testid="constrained-parent">
          <WikiRenderer wikiText={FINDING_1_FIXTURE} />
        </div>,
      );
      // Exactly one wiki <table> (outer is a <div>; inner is the wiki table).
      const tables = container.querySelectorAll('table');
      expect(tables.length).toBe(1);
      // The rendered <table> has an ancestor with overflow-x-auto + max-w-full.
      const table = container.querySelector('table');
      expect(table).not.toBeNull();
      const overflowAncestor = table?.closest('.overflow-x-auto');
      expect(overflowAncestor).not.toBeNull();
      expect(overflowAncestor?.className).toContain('overflow-x-auto');
      expect(overflowAncestor?.className).toContain('max-w-full');
    });

    it('Plan 54-08 Gap 3 — overflow-x-auto wrapper is only emitted for wiki content containing tables', () => {
      const { container } = render(<WikiRenderer wikiText="*bold text* with no table" />);
      expect(container.querySelector('.overflow-x-auto')).toBeNull();
    });
  });

  // --- Headerless table fix ---
  //
  // Jira issue descriptions sometimes contain tables with only data rows
  // (`|cell|cell|`) and no `||header||` row. jira2md only emits the GFM
  // `| --- | --- |` separator when it sees `||header||` source, so remark-gfm
  // does not recognise the plain-pipe rows as a table and renders them as text.
  //
  // `injectHeaderlessTableSeparators` scans the preprocessed wiki and inserts
  // a synthetic empty-header + separator before each run of data rows that is
  // not preceded by a header row.
  describe('headerless table rendering', () => {
    it('injectHeaderlessTableSeparators — inserts header+separator before a headerless 3-column table', () => {
      const input = [
        'Some intro text',
        '|0905473496|Go Biznis 22 eur|[Shop|https://www.orange.sk/shop]|',
        '|0908807289|Go Biznis 22 eur|[Shop|https://www.orange.sk/shop2]|',
      ].join('\n');

      const result = injectHeaderlessTableSeparators(input);
      const lines = result.split('\n');

      // Two synthetic rows must be injected before the first data row.
      // Output: intro, header, separator, row1, row2 = 5 lines
      expect(lines.length).toBe(5);
      // lines[1] is the synthetic empty header: | | | |
      expect(lines[1]).toMatch(/^\|.*\|.*\|.*\|$/);
      // lines[2] is the separator: |---|---|---|
      expect(lines[2]).toMatch(/^\|---\|---\|---\|$/);
      // Original data rows are preserved.
      expect(lines[3]).toContain('0905473496');
      expect(lines[4]).toContain('0908807289');
    });

    it('injectHeaderlessTableSeparators — does NOT inject a separator when header row is present', () => {
      const input = [
        '||Phone||Plan||Link||',
        '|0905473496|Go Biznis 22 eur|[Shop|https://www.orange.sk/shop]|',
      ].join('\n');

      const result = injectHeaderlessTableSeparators(input);
      const lines = result.split('\n');

      // No injection: header + data row only (jira2md will produce the separator).
      expect(lines.length).toBe(2);
    });

    it('injectHeaderlessTableSeparators — only injects once per run, not before every row', () => {
      const input = ['|row one|data|', '|row two|data|', '|row three|data|'].join('\n');

      const result = injectHeaderlessTableSeparators(input);
      const lines = result.split('\n');

      // 3 original rows + 2 injected rows (header + sep) = 5 lines total.
      expect(lines.length).toBe(5);
      // Only one separator present.
      const sepLines = lines.filter((l) => /^\|---/.test(l));
      expect(sepLines.length).toBe(1);
    });

    it('injectHeaderlessTableSeparators — bracket-aware column count: [display|url] counts as one cell', () => {
      // Row has 3 logical columns even though there are 4 `|` inside `[text|url]`
      const input = '|phone|plan|[Beta Shop|https://beta.orange.sk]|';
      const result = injectHeaderlessTableSeparators(input);
      const lines = result.split('\n');

      // Separator must have exactly 3 `---` segments.
      const sep = lines.find((l) => /^\|---/.test(l));
      expect(sep).toBeDefined();
      expect(sep).toBe('|---|---|---|');
    });

    it('WikiRenderer renders headerless table as an HTML <table> element (end-to-end fix)', () => {
      // Verbatim fixture from the bug report (simplified URLs for test stability).
      const fixture = [
        'B2B Voice issue description',
        '|0905473496|Go Biznis 22 eur|[Beta Shop|https://www.orange.sk/eshop-beta]|',
        '|0908807289|Go Biznis 22 eur|[Live Shop|https://www.orange.sk/eshop]|',
      ].join('\n');

      const { container } = render(<WikiRenderer wikiText={fixture} />);

      // The two data rows must render as an HTML table, not raw text.
      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      // Both rows are present as <tr> elements inside the table body.
      const rows = table?.querySelectorAll('tbody tr');
      expect(rows?.length).toBe(2);

      // Cell data is preserved.
      const allText = table?.textContent ?? '';
      expect(allText).toContain('0905473496');
      expect(allText).toContain('0908807289');
      expect(allText).toContain('Go Biznis 22 eur');
    });

    it('WikiRenderer headerless table — links in cells are rendered as <a> elements', () => {
      const fixture = [
        '|0905473496|Go Biznis 22 eur|[Beta Shop|https://www.orange.sk/eshop-beta]|',
      ].join('\n');

      const { container } = render(<WikiRenderer wikiText={fixture} />);

      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      // The named-link [Beta Shop|url] must become an <a> element inside the table.
      const link = table?.querySelector('a');
      expect(link).not.toBeNull();
      expect(link?.textContent).toContain('Beta Shop');
      expect(link?.getAttribute('href')).toBe('https://www.orange.sk/eshop-beta');
    });

    it('WikiRenderer headerless table — does not affect existing headed tables (regression)', () => {
      // A table WITH a header row must still render exactly as before.
      const fixture = ['||Phone||Plan||', '|0905473496|Go Biznis 22 eur|'].join('\n');

      const { container } = render(<WikiRenderer wikiText={fixture} />);

      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      // Exactly one table (no double-injection).
      expect(container.querySelectorAll('table').length).toBe(1);

      // Header row rendered in <thead>.
      const thead = table?.querySelector('thead');
      expect(thead).not.toBeNull();
      expect(thead?.textContent).toContain('Phone');
      expect(thead?.textContent).toContain('Plan');

      // Data row rendered in <tbody>.
      const tbody = table?.querySelector('tbody');
      expect(tbody?.textContent).toContain('0905473496');
    });
  });

  // --- Underscore preservation in link URLs ---
  //
  // jira2md's italic transformation (`_text_` → `*text*`) runs globally across
  // the entire input string, including inside `[display|url]` link syntax, before
  // it extracts the link parts. When a URL contains two or more underscores
  // (e.g. a hash parameter like Ve_ZplpPeXug), the first and last `_` form an
  // "italic pair" and content between them gets wrapped in `*`, corrupting both
  // the href and the display text in the resulting markdown link.
  //
  // `fixMarkdownLinkUnderscores` is applied post-jira2md to revert `*` → `_`
  // in link URLs (always safe — `*` is not valid in URLs) and in display text
  // that is itself a URL (starts with http:// or https://).
  describe('underscore preservation in link URLs (wiki-renderer-table-link-under)', () => {
    it('verbatim bug fixture — underscore in URL hash is preserved as _ not rendered as *', () => {
      // Exact input from the bug report: a headerless table row where the link
      // URL contains underscore pairs in the hash parameter.
      const fixture =
        '|0905473496|Go Biznis 22 eur|[https://www.orange.euro/e-shop-beta/rychla-vymena?hash=1D_D5LJtmN2Xr1bQQRvAcywIXXCd7fBCUz3Ve_ZplpPeXug=#ponuka|https://www.orange.euro/e-shop/rychla-vymena?hash=1D_D5LJtmN2Xr1bQQRvAcywIXXCd7fBCUz3Ve_ZplpPeXug=#ponuka]|';

      const { container } = render(<WikiRenderer wikiText={fixture} />);

      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      const link = table?.querySelector('a');
      expect(link).not.toBeNull();

      // The href must contain _ not * (root cause: jira2md italic corruption).
      const href = link?.getAttribute('href') ?? '';
      expect(href).toContain('Ve_ZplpPeXug');
      expect(href).not.toContain('Ve*ZplpPeXug');
      expect(href).toContain('1D_D5LJtmN2Xr1bQQRvAcywIXXCd7fBCUz3Ve_ZplpPeXug');

      // The display text (which is also a URL in this fixture) must also preserve _.
      const linkText = link?.textContent ?? '';
      expect(linkText).toContain('Ve_ZplpPeXug');
      expect(linkText).not.toContain('Ve*ZplpPeXug');
    });

    it('URL with a single underscore is not affected (single _ is not an italic pair)', () => {
      const fixture = '[Go to shop|https://www.example.com/path_only]';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toBe('https://www.example.com/path_only');
    });

    it('URL with two underscores has both preserved (regression target)', () => {
      const fixture = '[Shop|https://www.example.com/hash=abc_def_ghi]';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toBe('https://www.example.com/hash=abc_def_ghi');
      expect(link?.getAttribute('href')).not.toContain('*');
    });

    it('bold/italic in non-URL display text is not affected by the fix', () => {
      // [*bold label*|url] — jira2md converts this to [**bold label**](url).
      // The fix must NOT revert the ** in the display text (it is not a URL).
      const fixture = '[*bold link label*|https://www.example.com/path]';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      // The bold formatting must still render (strong element wraps the link text).
      const strong = link?.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe('bold link label');
    });

    it('underscores in URL inside a headed table cell are also preserved (not only headerless)', () => {
      const fixture = [
        '||Phone||Link||',
        '|0905473496|[Shop|https://www.example.com/hash=1A_B2_C3]|',
      ].join('\n');
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const table = container.querySelector('table');
      expect(table).not.toBeNull();
      const link = table?.querySelector('a');
      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toBe('https://www.example.com/hash=1A_B2_C3');
      expect(link?.getAttribute('href')).not.toContain('*');
    });

    it('underscores in URL in plain prose (outside table) are also preserved', () => {
      const fixture =
        'Check this out: [https://example.com/hash=Ve_Zpl_Xug|https://example.com/hash=Ve_Zpl_Xug]';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toContain('Ve_Zpl_Xug');
      expect(link?.getAttribute('href')).not.toContain('*');
    });

    it('[URL]-only syntax (autolink) — verbatim bug report URL: underscores in hash param are preserved', () => {
      // Exact reproduction URL from the bug report. [URL] without a display name
      // causes jira2md to emit a markdown autolink <https://...> instead of
      // [text](url). The italic pass corrupts underscores to * before the autolink
      // is formed; fixMarkdownLinkUnderscores must now also handle <https://...>.
      const fixture =
        '[https://www.orange.euro/e-shop-beta/vymena-internetu-a-televizie/rychla-vymena?hash=L_0mIHoqvPqgwUAu6FML8le7k8K_uXCDZ8OUVHEeqnheLRQ%3D]';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      // href must use _ not *
      const href = link?.getAttribute('href') ?? '';
      expect(href).toContain('L_0mIH');
      expect(href).toContain('K_uXCDZ');
      expect(href).not.toContain('L*0mIH');
      expect(href).not.toContain('K*uXCDZ');
    });

    it('[URL]-only syntax (autolink) — URL with two underscores renders both as _ not *', () => {
      const fixture = 'See: [https://example.com/hash=abc_def_ghi]';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toBe('https://example.com/hash=abc_def_ghi');
      expect(link?.getAttribute('href')).not.toContain('*');
    });

    it('[URL]-only syntax (autolink) — inside a list item underscores are preserved', () => {
      const fixture = '* [https://example.com/a_b_c]';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toBe('https://example.com/a_b_c');
      expect(link?.getAttribute('href')).not.toContain('*');
    });
  });

  // --- Monospace-wrapped links (wiki-url-not-clickable) ---
  //
  // Jira allows {{[URL]}} and {{[display|URL]}} where the outer {{...}} is
  // monospace syntax. jira2md converts {{...}} to a backtick code span; inside
  // code spans markdown link syntax is not processed, so the URL appears as
  // raw angle-bracket text `<URL>` rather than a clickable link.
  //
  // preprocessJiraMarkup strips the {{...}} wrapper when the content is a
  // bracket-link [...], so jira2md sees a plain [URL] or [display|URL] and
  // emits a proper hyperlink.
  describe('monospace-wrapped links (wiki-url-not-clickable)', () => {
    it('{{[URL]}} renders as a clickable <a> link (verbatim bug fixture)', () => {
      const fixture = '{{[https://www.orange.sk/e-shop/orange-mobilny-internet?click=int-mbb]}}';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toBe(
        'https://www.orange.sk/e-shop/orange-mobilny-internet?click=int-mbb',
      );
      // Must NOT appear as raw angle-bracket text
      expect(container.textContent).not.toContain('<https://');
    });

    it('{{[URL]}} — rendered link calls openUrl on click (not raw text)', () => {
      vi.mocked(openUrl).mockClear();
      const fixture = '{{[https://example.com/path]}}';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      fireEvent.click(link as HTMLAnchorElement);
      expect(openUrl).toHaveBeenCalledWith('https://example.com/path');
    });

    it('{{[display|URL]}} renders as a named <a> link (monospace wrapping a named link)', () => {
      const fixture = '{{[Click here|https://example.com/shop]}}';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toBe('https://example.com/shop');
      expect(link?.textContent).toContain('Click here');
    });

    it('{{non-link monospace}} is NOT affected — still renders as inline code', () => {
      // {{someCode}} has no bracket-link inside — must remain as <code> element.
      const { container } = render(<WikiRenderer wikiText="{{someCode}}" />);
      const code = container.querySelector('code');
      expect(code).not.toBeNull();
      expect(code?.textContent).toBe('someCode');
    });
  });

  // --- Jira emoticon shortcodes (jira-icons-not-rendered) ---
  //
  // Jira wiki supports shortcodes like "(/)" (green tick), "(x)" (red cross),
  // "(!)" (warning), "(+)", "(-)", "(?)", "(i)", "(*)", "(on)", "(off)",
  // "(flag)", "(flagoff)". jira2md does not handle these — they pass through
  // unchanged. preprocessJiraMarkup converts them to Unicode emoji via
  // JIRA_EMOTICON_MAP before the text reaches jira2md.
  describe('Jira emoticon shortcodes (jira-icons-not-rendered)', () => {
    it('JIRA_EMOTICON_MAP exports a non-empty array', () => {
      expect(JIRA_EMOTICON_MAP.length).toBeGreaterThan(0);
    });

    it('JIRA_EMOTICON_MAP — (flagoff) entry appears before (flag) entry to prevent partial match', () => {
      const flagoffIdx = JIRA_EMOTICON_MAP.findIndex(([re]) => re.source.includes('flagoff'));
      const flagIdx = JIRA_EMOTICON_MAP.findIndex(
        ([re]) => re.source.includes('flag') && !re.source.includes('flagoff'),
      );
      expect(flagoffIdx).toBeGreaterThanOrEqual(0);
      expect(flagIdx).toBeGreaterThanOrEqual(0);
      expect(flagoffIdx).toBeLessThan(flagIdx);
    });

    it('JIRA_EMOTICON_MAP — (*) catch-all appears after (*r), (*g), (*b), (*y) entries', () => {
      // (*r), (*g), (*b), (*y) are starred variants; the plain (*) must come last
      // so it does not shadow the named variants.
      const rIdx = JIRA_EMOTICON_MAP.findIndex(([re]) => /\\\*r/.test(re.source));
      const gIdx = JIRA_EMOTICON_MAP.findIndex(([re]) => /\\\*g/.test(re.source));
      const bIdx = JIRA_EMOTICON_MAP.findIndex(([re]) => /\\\*b/.test(re.source));
      const yIdx = JIRA_EMOTICON_MAP.findIndex(([re]) => /\\\*y/.test(re.source));
      // The catch-all (*) pattern: source is exactly \(\*\)
      const catchAllIdx = JIRA_EMOTICON_MAP.findIndex(([re]) => re.source === '\\(\\*\\)');
      expect(catchAllIdx).toBeGreaterThan(rIdx);
      expect(catchAllIdx).toBeGreaterThan(gIdx);
      expect(catchAllIdx).toBeGreaterThan(bIdx);
      expect(catchAllIdx).toBeGreaterThan(yIdx);
    });

    it('renders (/) as ✅ — raw text "(/) is not present in output', () => {
      const { container } = render(<WikiRenderer wikiText="Status: (/)" />);
      // The shortcode must be gone; the emoji must appear.
      expect(container.textContent).not.toContain('(/)');
      expect(container.textContent).toContain('✅');
    });

    it('renders (x) as ❌ — raw text "(x)" is not present in output', () => {
      const { container } = render(<WikiRenderer wikiText="Status: (x)" />);
      expect(container.textContent).not.toContain('(x)');
      expect(container.textContent).toContain('❌');
    });

    it('renders (!) as ⚠️ — raw text "(!)" is not present in output', () => {
      const { container } = render(<WikiRenderer wikiText="Warning: (!)" />);
      expect(container.textContent).not.toContain('(!)');
      expect(container.textContent).toContain('⚠');
    });

    it('renders (+) as ➕ — raw text "(+)" is not present in output', () => {
      const { container } = render(<WikiRenderer wikiText="Add: (+)" />);
      expect(container.textContent).not.toContain('(+)');
      expect(container.textContent).toContain('➕');
    });

    it('renders (-) as ➖ — raw text "(-)" is not present in output', () => {
      const { container } = render(<WikiRenderer wikiText="Remove: (-)" />);
      expect(container.textContent).not.toContain('(-)');
      expect(container.textContent).toContain('➖');
    });

    it('renders (?) as ❓ — raw text "(?)" is not present in output', () => {
      const { container } = render(<WikiRenderer wikiText="Question: (?)" />);
      expect(container.textContent).not.toContain('(?)');
      expect(container.textContent).toContain('❓');
    });

    it('renders (i) as ℹ️ — raw text "(i)" is not present in output', () => {
      const { container } = render(<WikiRenderer wikiText="Info: (i)" />);
      expect(container.textContent).not.toContain('(i)');
      expect(container.textContent).toContain('ℹ');
    });

    it('renders (*) as ⭐ — raw text "(*)" is not present in output', () => {
      const { container } = render(<WikiRenderer wikiText="Star: (*)" />);
      expect(container.textContent).not.toContain('(*)');
      expect(container.textContent).toContain('⭐');
    });

    it('renders multiple emoticons in the same text block', () => {
      const { container } = render(<WikiRenderer wikiText="Passed (/) and failed (x)" />);
      expect(container.textContent).toContain('✅');
      expect(container.textContent).toContain('❌');
      expect(container.textContent).not.toContain('(/)');
      expect(container.textContent).not.toContain('(x)');
    });

    it('emoticons inside a Jira comment with surrounding prose are all converted', () => {
      const { container } = render(
        <WikiRenderer wikiText="Test result: (/) passed, (x) failed, (!) warning" />,
      );
      expect(container.textContent).toContain('✅');
      expect(container.textContent).toContain('❌');
      expect(container.textContent).toContain('⚠');
      expect(container.textContent).not.toContain('(/)');
      expect(container.textContent).not.toContain('(x)');
      expect(container.textContent).not.toContain('(!)');
    });

    it('emoticons inside a table cell are converted (not treated as table syntax)', () => {
      const fixture = '||Status||Note||\n|(/)|All good|\n|(x)|Broken|';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const table = container.querySelector('table');
      expect(table).not.toBeNull();
      expect(table?.textContent).toContain('✅');
      expect(table?.textContent).toContain('❌');
      expect(table?.textContent).not.toContain('(/)');
      expect(table?.textContent).not.toContain('(x)');
    });

    it('unrecognised parenthesised tokens are left unchanged (no over-substitution)', () => {
      // (abc) is not a Jira emoticon — must pass through as-is.
      const { container } = render(<WikiRenderer wikiText="See ticket (abc) for details" />);
      expect(container.textContent).toContain('(abc)');
    });
  });

  describe('internal link routing (260518-pq2)', () => {
    beforeEach(() => {
      vi.mocked(openUrl).mockClear();
      navigateMock.mockClear();
      // Reset auth state before each test.
      authStoreState.jiraBaseUrl = null;
      authStoreState.gitlabBaseUrl = null;
      authStoreState.activeGitlabProject = null;
      authStoreState.activeGitlabProjectPath = null;
    });

    it('Jira browse URL matching jiraBaseUrl navigates in-app, does NOT call openUrl', () => {
      authStoreState.jiraBaseUrl = 'https://jira.example.com';
      render(
        <MemoryRouter>
          <WikiRenderer wikiText="[PROJ-123|https://jira.example.com/browse/PROJ-123]" />
        </MemoryRouter>,
      );
      const link = screen.getByRole('link', { name: /PROJ-123/ });
      fireEvent.click(link);
      expect(navigateMock).toHaveBeenCalledWith('/issue/PROJ-123');
      expect(openUrl).not.toHaveBeenCalled();
    });

    it('GitLab MR URL matching active project navigates in-app, does NOT call openUrl', () => {
      authStoreState.gitlabBaseUrl = 'https://gitlab.example.com';
      authStoreState.activeGitlabProject = 99;
      authStoreState.activeGitlabProjectPath = 'group/repo';
      render(
        <MemoryRouter>
          <WikiRenderer wikiText="[See MR|https://gitlab.example.com/group/repo/-/merge_requests/42]" />
        </MemoryRouter>,
      );
      const link = screen.getByRole('link', { name: /See MR/ });
      fireEvent.click(link);
      expect(navigateMock).toHaveBeenCalledWith('/mr/99/42');
      expect(openUrl).not.toHaveBeenCalled();
    });

    it('GitLab MR URL with mismatched project path falls back to openUrl, does NOT navigate', () => {
      authStoreState.gitlabBaseUrl = 'https://gitlab.example.com';
      authStoreState.activeGitlabProject = 99;
      authStoreState.activeGitlabProjectPath = 'group/repo';
      render(
        <MemoryRouter>
          <WikiRenderer wikiText="[Other MR|https://gitlab.example.com/other/repo/-/merge_requests/1]" />
        </MemoryRouter>,
      );
      const link = screen.getByRole('link', { name: /Other MR/ });
      fireEvent.click(link);
      expect(openUrl).toHaveBeenCalledWith(
        'https://gitlab.example.com/other/repo/-/merge_requests/1',
      );
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it('regression: non-Jira/non-GitLab external link still calls openUrl (host mismatch)', () => {
      // jira.orange.sk is different from jiraBaseUrl (jira.example.com), so falls back to openUrl.
      authStoreState.jiraBaseUrl = 'https://jira.example.com';
      render(
        <MemoryRouter>
          <WikiRenderer wikiText="[See PROJ-123|https://jira.orange.sk/browse/PROJ-123]" />
        </MemoryRouter>,
      );
      const link = screen.getByRole('link', { name: /See PROJ-123/ });
      fireEvent.click(link);
      expect(openUrl).toHaveBeenCalledWith('https://jira.orange.sk/browse/PROJ-123');
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it('regression: in-document anchor (#section) does NOT call openUrl or navigate', () => {
      render(
        <MemoryRouter>
          <WikiRenderer wikiText="[See here|#section]" />
        </MemoryRouter>,
      );
      const link = screen.getByRole('link', { name: /See here/ });
      fireEvent.click(link);
      expect(openUrl).not.toHaveBeenCalled();
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it('regression: image-extension anchor opens lightbox, does NOT call openUrl or navigate', () => {
      authStoreState.jiraBaseUrl = 'https://jira.example.com';
      const { container } = render(
        <MemoryRouter>
          <WikiRenderer wikiText="[VAS.png|https://jira.example.com/secure/attachment/123/VAS.png]" />
        </MemoryRouter>,
      );
      const link = screen.getByRole('link', { name: /VAS\.png/ });
      fireEvent.click(link);
      expect(openUrl).not.toHaveBeenCalled();
      expect(navigateMock).not.toHaveBeenCalled();
      // Lightbox should open.
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    });
  });

  describe('breadcrumb trail (260518-qw8)', () => {
    beforeEach(() => {
      vi.mocked(openUrl).mockClear();
      navigateMock.mockClear();
      pushMock.mockClear();
      breadcrumbState.trail.length = 0;
      authStoreState.jiraBaseUrl = null;
      authStoreState.gitlabBaseUrl = null;
      authStoreState.activeGitlabProject = null;
      authStoreState.activeGitlabProjectPath = null;
    });

    it('Jira browse URL click pushes source page onto breadcrumb trail before navigating', () => {
      authStoreState.jiraBaseUrl = 'https://jira.example.com';
      locationPathname = '/mr/99/42';
      render(<WikiRenderer wikiText="[PROJ-123|https://jira.example.com/browse/PROJ-123]" />);
      const link = screen.getByRole('link', { name: /PROJ-123/ });
      fireEvent.click(link);
      expect(pushMock).toHaveBeenCalledWith({ path: '/mr/99/42', label: '!42' });
      expect(navigateMock).toHaveBeenCalledWith('/issue/PROJ-123');
      expect(openUrl).not.toHaveBeenCalled();
    });

    it('GitLab MR URL click pushes source page (an /issue/...) onto breadcrumb trail', () => {
      authStoreState.gitlabBaseUrl = 'https://gitlab.example.com';
      authStoreState.activeGitlabProject = 99;
      authStoreState.activeGitlabProjectPath = 'group/repo';
      locationPathname = '/issue/SOURCE-1';
      render(
        <WikiRenderer wikiText="[See MR|https://gitlab.example.com/group/repo/-/merge_requests/42]" />,
      );
      const link = screen.getByRole('link', { name: /See MR/ });
      fireEvent.click(link);
      expect(pushMock).toHaveBeenCalledWith({ path: '/issue/SOURCE-1', label: 'SOURCE-1' });
      expect(navigateMock).toHaveBeenCalledWith('/mr/99/42');
      expect(openUrl).not.toHaveBeenCalled();
    });

    it('unmatched external link does NOT push onto breadcrumb trail', () => {
      // jira.orange.sk is a different host from jiraBaseUrl (jira.example.com), falls back to openUrl.
      authStoreState.jiraBaseUrl = 'https://jira.example.com';
      locationPathname = '/mr/99/42';
      render(<WikiRenderer wikiText="[See PROJ-123|https://jira.orange.sk/browse/PROJ-123]" />);
      const link = screen.getByRole('link', { name: /See PROJ-123/ });
      fireEvent.click(link);
      expect(pushMock).not.toHaveBeenCalled();
      expect(openUrl).toHaveBeenCalledWith('https://jira.orange.sk/browse/PROJ-123');
    });

    it('in-document anchor (#section) does NOT push onto breadcrumb trail', () => {
      locationPathname = '/mr/99/42';
      render(<WikiRenderer wikiText="[See here|#section]" />);
      const link = screen.getByRole('link', { name: /See here/ });
      fireEvent.click(link);
      expect(pushMock).not.toHaveBeenCalled();
      expect(openUrl).not.toHaveBeenCalled();
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  // --- Color macros (jira-color-macro) ---
  // {color:#hex}...{color} must render as inline colored text.
  // jira2md strips color macros entirely (index.js line 82); the fix is to
  // pre-process them in preprocessJiraMarkup before jira2md runs.
  describe('Jira {color} macro rendering (jira-color-macro)', () => {
    it('renders {color:#hex}text{color} with inline color style', () => {
      const { container } = render(<WikiRenderer wikiText="{color:#d04437}FAILED:{color}" />);
      // Text is present
      expect(container.textContent).toContain('FAILED:');
      // A span with the color style is rendered
      const colored = container.querySelector('span[style]');
      expect(colored).not.toBeNull();
      // JSDOM converts hex colors to rgb() when reading back computed style
      expect(colored?.getAttribute('style')).toMatch(/color/);
    });

    it('renders {color:#hex}*bold*{color} — bold survives inside color span', () => {
      const { container } = render(<WikiRenderer wikiText="{color:#d04437}*FAILED:*{color}" />);
      expect(container.textContent).toContain('FAILED:');
      const colored = container.querySelector('span[style]');
      expect(colored).not.toBeNull();
      // JSDOM converts hex colors to rgb() when reading back computed style
      expect(colored?.getAttribute('style')).toMatch(/color/);
      // Bold element must be inside the colored span
      const bold = colored?.querySelector('strong');
      expect(bold).not.toBeNull();
      expect(bold?.textContent).toContain('FAILED:');
    });

    it('renders multiple color macros in the same block', () => {
      const { container } = render(
        <WikiRenderer wikiText="{color:#d04437}RED{color} and {color:#00875a}GREEN{color}" />,
      );
      expect(container.textContent).toContain('RED');
      expect(container.textContent).toContain('GREEN');
      const spans = container.querySelectorAll('span[style]');
      expect(spans.length).toBeGreaterThanOrEqual(2);
    });

    it('color macro in a table cell renders with color', () => {
      const fixture = '||Status||Note||\n|{color:#d04437}FAIL{color}|See logs|';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      expect(container.textContent).toContain('FAIL');
      const colored = container.querySelector('span[style]');
      expect(colored).not.toBeNull();
      // JSDOM converts hex colors to rgb() when reading back computed style
      expect(colored?.getAttribute('style')).toMatch(/color/);
    });

    it('text without color macro is unaffected', () => {
      const { container } = render(<WikiRenderer wikiText="No color here" />);
      expect(container.textContent).toContain('No color here');
      expect(container.querySelector('span[style]')).toBeNull();
    });
  });

  // --- Brace-quoted bold/italic ({*}text{*} and {_}text{_}) (in-jira-description-text-is-no) ---
  //
  // Jira allows {*}text{*} as an alternative bold syntax and {_}text{_} for italic.
  // These are used in contexts where the bare * or _ might be ambiguous (e.g. inside
  // color macros, after emoticons, or in complex prose). jira2md does not handle them —
  // its bold regex matches the * inside {*} and produces {**}text{**} in the output,
  // which renders as literal brace characters ({ and }) surrounding bold text.
  //
  // preprocessJiraMarkup converts {*}..{*} → *..* and {_}..{_} → _.._ before any
  // further processing so that jira2md and normalizeTableCellInlineFormatting see
  // standard *..* / _.._ markers.
  describe('brace-quoted bold/italic (in-jira-description-text-is-no)', () => {
    it('{*}text{*} renders as bold — no literal braces in output', () => {
      const { container } = render(<WikiRenderer wikiText="{*}bold text{*}" />);
      // Must render as <strong>, not raw text
      const strong = container.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe('bold text');
      // Literal { and } must NOT appear in the output
      expect(container.textContent).not.toContain('{');
      expect(container.textContent).not.toContain('}');
    });

    it('{_}text{_} renders as italic — no literal braces in output', () => {
      const { container } = render(<WikiRenderer wikiText="{_}italic text{_}" />);
      const em = container.querySelector('em');
      expect(em).not.toBeNull();
      expect(em?.textContent).toBe('italic text');
      expect(container.textContent).not.toContain('{');
      expect(container.textContent).not.toContain('}');
    });

    it('{*}text{*} surrounded by prose renders bold without braces', () => {
      const { container } = render(<WikiRenderer wikiText="prefix {*}bold{*} suffix" />);
      const strong = container.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe('bold');
      expect(container.textContent).toContain('prefix');
      expect(container.textContent).toContain('suffix');
      expect(container.textContent).not.toContain('{');
    });

    it('multiple {*}..{*} spans on the same line all render bold', () => {
      const { container } = render(<WikiRenderer wikiText="{*}first{*} and {*}second{*}" />);
      const strongs = container.querySelectorAll('strong');
      expect(strongs.length).toBeGreaterThanOrEqual(2);
      const boldTexts = Array.from(strongs).map((s) => s.textContent);
      expect(boldTexts).toContain('first');
      expect(boldTexts).toContain('second');
    });

    it('{*}bold{*} inside a {color} macro renders bold AND colored', () => {
      const { container } = render(<WikiRenderer wikiText="{color:#d04437}{*}FAILED:{*}{color}" />);
      expect(container.textContent).toContain('FAILED:');
      // Bold element must be present inside the colored span
      const colored = container.querySelector('span[style]');
      expect(colored).not.toBeNull();
      const bold = colored?.querySelector('strong');
      expect(bold).not.toBeNull();
      expect(bold?.textContent).toContain('FAILED:');
      // No literal brace characters
      expect(container.textContent).not.toContain('{');
    });

    it('{*}bold{*} inside a table cell renders as <strong>', () => {
      const fixture = '||Header||\n|{*}cell bold{*}|';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const table = container.querySelector('table');
      expect(table).not.toBeNull();
      const strong = table?.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe('cell bold');
      expect(table?.textContent).not.toContain('{');
    });

    it('{*}..{*} with multi-word content renders correctly (regression: was {**}text{**})', () => {
      // Verbatim reproduction from the bug report
      const { container } = render(<WikiRenderer wikiText="{*}text{*}" />);
      const strong = container.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe('text');
      // The broken output was to show literal "{" and "}" around **text**
      expect(container.textContent).not.toMatch(/^\{/);
      expect(container.textContent).not.toMatch(/\}$/);
    });
  });

  // --- Inline single-line table expansion (table-not-render-issue-detail) ---
  //
  // Some Jira issues have table rows collapsed onto a single line — no `\n`
  // between rows. The entire heading, header cells, GFM separator (|---|---|),
  // and data rows appear space-separated on one source line. Neither
  // mergeOpenTableRows nor injectHeaderlessTableSeparators can handle this
  // because both are line-based and the line does not start with `|`.
  //
  // `splitInlineSingleLineTables` detects a multi-column inline separator row
  // (|---|---| preceded by a space) and reconstructs proper multi-line form.
  describe('inline single-line table expansion (table-not-render-issue-detail)', () => {
    // Verbatim failing input from the bug report.
    const FAILING_FIXTURE =
      '## Novy system sa bude nazyvat LST - Local Sales Tool | | | | | | | | | | | | | | | | | | | | | | |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---| |**Nazov systemu*|*Odkial ma data*|*Kto kalkuluje offer*|*Kto zobrazuje offer**| |Mpc|*Mpc_|_Noe_|_Noe*| |Ost|*Ost_|_Ost_|_Noe*| |Lst|*Noe_|_Noe_|_Noe*|';

    it('splitInlineSingleLineTables — splits the verbatim bug fixture into separate lines', () => {
      const result = splitInlineSingleLineTables(FAILING_FIXTURE);
      const lines = result.split('\n');

      // The single line must be split into at least 3 lines:
      // prefix, header row, separator row, and at least one data row.
      expect(lines.length).toBeGreaterThanOrEqual(4);

      // Separator row must be on its own line (starts with | and all cells are dashes).
      const sepLine = lines.find((l) => /^\|(?::?-+:?\|)+$/.test(l.trim()));
      expect(sepLine).toBeDefined();

      // Header prefix (heading text) must be on its own line.
      const headingLine = lines.find((l) => l.includes('Novy system'));
      expect(headingLine).toBeDefined();
      // Heading line must NOT contain the separator row pattern.
      expect(headingLine).not.toMatch(/\|---/);

      // Data rows must be present as separate lines starting with |.
      const dataLines = lines.filter(
        (l) => l.trim().startsWith('|') && !/^\|(?::?-+:?\|)+$/.test(l.trim()),
      );
      expect(dataLines.length).toBeGreaterThanOrEqual(2);
    });

    it('splitInlineSingleLineTables — leaves normal multi-line tables unchanged', () => {
      const normal = 'h2. Heading\n||col1||col2||\n|a|b|\n|c|d|';
      expect(splitInlineSingleLineTables(normal)).toBe(normal);
    });

    it('splitInlineSingleLineTables — leaves regular prose unchanged (no false positive)', () => {
      const prose = 'This text has dashes --- and pipes | but no inline table separator';
      expect(splitInlineSingleLineTables(prose)).toBe(prose);
    });

    it('splitInlineSingleLineTables — single |---| does not trigger (requires 2+ separator cells)', () => {
      const singleSep = 'Some text |---| more text';
      expect(splitInlineSingleLineTables(singleSep)).toBe(singleSep);
    });

    it('splitInlineSingleLineTables — leaves lines already starting with | unchanged', () => {
      const tableRow = '| cell1 | cell2 |';
      expect(splitInlineSingleLineTables(tableRow)).toBe(tableRow);
    });

    it('splitInlineSingleLineTables — two-cell inline table (minimal valid case)', () => {
      const input = 'Heading text | h1 | h2 | |---|---| |d1|d2| |d3|d4|';
      const result = splitInlineSingleLineTables(input);
      const lines = result.split('\n');

      expect(lines.length).toBeGreaterThanOrEqual(3);
      // Separator present as its own line.
      expect(lines.some((l) => /^\|---\|---\|$/.test(l.trim()))).toBe(true);
    });

    it('WikiRenderer renders the verbatim bug fixture as an HTML table (end-to-end fix)', () => {
      const { container } = render(<WikiRenderer wikiText={FAILING_FIXTURE} />);

      // The table must be rendered — not shown as raw pipe text.
      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      // Data rows contain cell content from the fixture.
      const allText = table?.textContent ?? '';
      expect(allText).toContain('Mpc');
      expect(allText).toContain('Ost');
      expect(allText).toContain('Lst');
    });

    it('WikiRenderer — plain prose with a single |---| (regression: must not trigger split)', () => {
      // A sentence like "score |---| range" must not be mangled into a table.
      const { container } = render(<WikiRenderer wikiText="Score |---| range: 1 to 10" />);
      expect(container.querySelector('table')).toBeNull();
      expect(container.textContent).toContain('Score');
      expect(container.textContent).toContain('range');
    });
  });

  // --- Jira bold/italic in table cells (table-not-render-issue-detail, cycle 2) ---
  //
  // Jira tables that use |*bold*| and |_italic_| syntax in data cells (single-pipe
  // rows) are corrupted by jira2md's greedy bold/italic regexes, which match across
  // cell-separator | characters. normalizeTableCellInlineFormatting converts the
  // markers per-cell before jira2md runs, preventing cross-boundary pairing.
  describe('table cell bold/italic normalization (table-not-render-issue-detail cycle-2)', () => {
    // Verbatim actual Jira source from the bug report (multi-line, with image macros).
    const ACTUAL_JIRA_SOURCE = [
      'h1. Vysledok analyzy',
      'h2. Strucny popis aktualneho stavu',
      '',
      'Mame 3 systemy v eshope: Mpc, Ost, Rework',
      '',
      '!aktualny-stav.png|width=899,height=770!',
      'h2. Chceny stav',
      '',
      'Chceme novy system...',
      '',
      '!checkouty.png|width=851,height=718!',
      'h2. Novy system sa bude nazyvat LST - Local Sales Tool',
      '|*Nazov systemu*|*Odkial ma data*|*Kto kalkuluje offer*|*Kto zobrazuje offer*|',
      '|Mpc|_Mpc_|_Noe_|_Noe_|',
      '|Ost|_Ost_|_Ost_|_Noe_|',
      '|Lst|_Noe_|_Noe_|_Noe_|',
    ].join('\n');

    it('renders a Jira table with *bold* headers after image macros as an HTML table', () => {
      const { container } = render(<WikiRenderer wikiText={ACTUAL_JIRA_SOURCE} />);

      // The table must be rendered as an actual HTML table.
      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      // All data rows must appear in the table.
      const allText = table?.textContent ?? '';
      expect(allText).toContain('Mpc');
      expect(allText).toContain('Ost');
      expect(allText).toContain('Lst');
      expect(allText).toContain('Noe');
    });

    it('bold header row cells render as <strong> elements within table cells', () => {
      const { container } = render(<WikiRenderer wikiText={ACTUAL_JIRA_SOURCE} />);
      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      // At least one strong element must exist — from *Nazov systemu* etc.
      const strong = table?.querySelector('strong');
      expect(strong).not.toBeNull();
    });

    it('italic data cells render as <em> elements (not raw asterisks)', () => {
      // A simpler fixture: one row with italic cells.
      const fixture = ['||Header A||Header B||', '|_italic value_|plain|'].join('\n');
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      // em element must exist inside the table.
      const em = table?.querySelector('em');
      expect(em).not.toBeNull();
      expect(em?.textContent).toBe('italic value');

      // Must NOT contain raw asterisks from jira2md bold corruption.
      const allText = table?.textContent ?? '';
      expect(allText).not.toContain('*italic');
    });

    it('bold in table cells renders as <strong> (not cross-cell bleed)', () => {
      // Without the fix, |*A*|*B*| becomes |**A*|*B**| — two "cells" with broken
      // bold syntax and no true cell separation. With the fix, each cell is
      // independently converted: |**A**|**B**|.
      const fixture = ['||Col1||Col2||', '|*Alpha*|*Beta*|'].join('\n');
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      // Both bold cells must render as individual <strong> elements.
      const strongs = table?.querySelectorAll('strong');
      expect(strongs?.length).toBeGreaterThanOrEqual(2);

      // Text content of both bold cells must be correct.
      const boldTexts = Array.from(strongs ?? []).map((s) => s.textContent);
      expect(boldTexts).toContain('Alpha');
      expect(boldTexts).toContain('Beta');
    });

    it('image macros with dimension options do not break content after them', () => {
      // !filename.png|width=N,height=N! — the | inside the options must not be
      // treated as a table cell separator or interfere with surrounding content.
      const fixture = [
        'Before image',
        '!diagram.png|width=800,height=600!',
        'After image text',
      ].join('\n');
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      // "Before image" and "After image text" must both be visible.
      expect(container.textContent).toContain('Before image');
      expect(container.textContent).toContain('After image text');
      // No table should be created from the image options.
      expect(container.querySelector('table')).toBeNull();
    });

    it('content between two image macros on separate lines is not swallowed', () => {
      // Regression: /!([^!\n]+?)(?:\|[^!]*)?!/g with [^!]* (no \n exclusion) was
      // greedy across newlines — consuming everything between the first ! and the
      // closing ! of the second macro, silently dropping all content in between.
      const fixture = [
        '!first.png|width=899,height=770!',
        'h2. Section between images',
        '',
        'Some paragraph text here.',
        '',
        '!second.png|width=851,height=718!',
        'h2. Section after second image',
      ].join('\n');
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      expect(container.textContent).toContain('Section between images');
      expect(container.textContent).toContain('Some paragraph text here');
      expect(container.textContent).toContain('Section after second image');
    });

    it('CRLF line endings (Jira Server) do not break table or post-image content', () => {
      // Jira Server/Data Center returns descriptions with \r\n line endings.
      // mergeOpenTableRows splits by \n and checks trimmedRight.endsWith('|'), but
      // \r left on line endings caused endsWithPipe to always be false — making
      // every table row appear "open" and causing mergeOpenTableRows to consume
      // up to 50 subsequent lines into one row, swallowing all content after it.
      const CRLF = '\r\n';
      const fixture = [
        'h2. Section before image',
        '!photo.png|width=800,height=600!',
        'h2. Section after image',
        'Some text after the image.',
        '|*Col A*|*Col B*|',
        '|val1|val2|',
      ].join(CRLF);
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      expect(container.textContent).toContain('Section before image');
      expect(container.textContent).toContain('Section after image');
      expect(container.textContent).toContain('Some text after the image');
      const table = container.querySelector('table');
      expect(table).not.toBeNull();
      expect(table?.textContent).toContain('val1');
      expect(table?.textContent).toContain('val2');
    });

    it('resolved attachment <img> does not swallow the heading immediately after it', () => {
      // jira2md heading conversion adds no blank lines. <img> on its own line with
      // only one \n before the next heading starts a CommonMark HTML block that
      // absorbs the heading. Fix: preprocessor appends \n to every <img> it emits.
      const attachments = {
        'diagram.png': 'https://jira.example.com/secure/attachment/1/diagram.png',
      };
      const fixture = [
        '!diagram.png!',
        'h2. Section After Image',
        '',
        'Paragraph under section.',
      ].join('\n');
      const { container } = render(<WikiRenderer wikiText={fixture} attachments={attachments} />);
      const headings = container.querySelectorAll('h2');
      expect(headings.length).toBeGreaterThanOrEqual(1);
      expect(Array.from(headings).some((h) => h.textContent?.includes('Section After Image'))).toBe(
        true,
      );
      expect(container.textContent).toContain('Paragraph under section');
    });
  });

  describe('escaped-plus and single-line table hard-break (jira-detail-rendering-of-pages)', () => {
    it('\\+ in a table cell renders as literal + not as <ins> underline', () => {
      // Jira \+ is a backslash escape meaning literal +. jira2md's +text+ →
      // <ins>text</ins> rule must not fire on escaped plus characters.
      // If the bug is present, (karticky + modal) in row 2 and (popis + modal)
      // in row 3 are paired by jira2md as <ins>…</ins> open/close across cell
      // boundaries, producing stringified &lt;ins&gt; / &lt;/ins&gt; in the output.
      const fixture = [
        '||*Step*||*Expected*||',
        '|Kontrola \\(karticky \\+ modal\\) |Kontrola OK |',
        '|Kontrola \\(popis \\+ modal\\) |Kontrola OK |',
      ].join('\n');
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const text = container.textContent ?? '';
      // Literal + must appear in the cell text
      expect(text).toContain('(karticky + modal)');
      expect(text).toContain('(popis + modal)');
      // No <ins> or stringified ins tags
      expect(text).not.toContain('<ins>');
      expect(text).not.toContain('</ins>');
      expect(text).not.toContain('&lt;ins&gt;');
      expect(text).not.toContain('&lt;/ins&gt;');
    });

    it('\\\\  in a single-line table row renders as <br/> not a row split', () => {
      // Jira \\\\ (double-backslash) is a hard line-break. Inside a table row that
      // already ends with |, mergeOpenTableRows passes it through unchanged.
      // The global \\\\ → "  \n" conversion must NOT apply inside table rows
      // because inserting \n mid-row breaks the GFM table structure.
      const fixture = ['||*Step*||*Expected*||', '|Row text \\\\ continued |OK |'].join('\n');
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const table = container.querySelector('table');
      expect(table).not.toBeNull();
      // The content after \\\\ must still be inside the table, not in a separate row
      const rows = table?.querySelectorAll('tr');
      // Should be 2 rows (header + 1 data row), not 3+
      expect(rows?.length).toBe(2);
      // "continued" must appear in the single data row, not spill outside
      expect(table?.textContent).toContain('continued');
    });

    it('full fixture — table with both \\+ and \\\\ in same row renders all rows correctly', () => {
      // Regression fixture from the bug report: a table where cells contain both
      // \+ (escaped plus) and \\\\ (hard break with price list items).
      // Expected: 3 data rows, each with their step text intact, no extra rows.
      const fixture = [
        '||*S.No.*||*Step*||*Expected*||',
        '|1. |Nacitanie eshop home page |Kontrola OK |',
        '|2. |Kontrola cien \\(karticky \\+ modal\\): \\\\ Pro Biznis S = 17,89 € \\\\ Pro Biznis M = 23,58 € |Kontrola OK |',
        '|3. |Kontrola cien \\(popis \\+ modal\\): \\\\ Pro Biznis S = 17,89 € \\\\ Pro Biznis M = 23,58 € |Kontrola OK |',
      ].join('\n');
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const table = container.querySelector('table');
      expect(table).not.toBeNull();

      const rows = table?.querySelectorAll('tr');
      // 1 header row + 3 data rows = 4 total; price lines must be inside cells, not extra rows
      expect(rows?.length).toBe(4);

      const allText = table?.textContent ?? '';
      // Escaped plus → literal +
      expect(allText).toContain('karticky + modal');
      expect(allText).toContain('popis + modal');
      // No cross-cell <ins> pairing
      expect(allText).not.toContain('<ins>');
      expect(allText).not.toContain('&lt;ins&gt;');
      // Price lines must be present (inside cells)
      expect(allText).toContain('Pro Biznis S');
      expect(allText).toContain('Pro Biznis M');
    });
  });

  // --- Consecutive exclamation marks (wiki-render-exclamation-split) ---
  //
  // jira2md's image regex /!(.+)!/g is greedy and matches any content between
  // two `!` characters, including a bare `!` inside `!!!`. For the text
  // `ponuka!!! - iba`, it matches `!!!` (ref = `!`) and emits `![](!)`
  // which react-markdown renders as a broken image. The ` - ` that follows
  // is then parsed as a GFM list item marker in some contexts.
  //
  // Fix (preprocessJiraMarkup): after the valid-image substitution step, any
  // remaining runs of 2+ consecutive `!` characters are prose punctuation.
  // Replace extra `!` with `&#33;` HTML entities so jira2md never sees two
  // raw `!` characters that could form a false image pair.
  describe('consecutive exclamation marks (wiki-render-exclamation-split)', () => {
    it('verbatim bug fixture — triple exclamation mark renders as plain text, no broken image', () => {
      const fixture =
        'pre XL extra a XXL nebude sa uplplatňovať geozónová ponuka!!! - iba zvýhodnená cena na 3 mesiace';
      const { container } = render(<WikiRenderer wikiText={fixture} />);

      // No <img> element — the !!! must not be treated as a Jira image macro.
      expect(container.querySelector('img')).toBeNull();

      // No <li> element — the " - " after !!! must not start a list item.
      expect(container.querySelector('li')).toBeNull();

      // All text must be present (the exclamation marks render as "!" characters).
      const text = container.textContent ?? '';
      expect(text).toContain('ponuka');
      expect(text).toContain('iba zvýhodnená cena na 3 mesiace');
      // The exclamation marks must appear as plain text characters in the output.
      expect(text).toContain('!');
    });

    it('double exclamation mark renders as plain text, no broken image', () => {
      const { container } = render(<WikiRenderer wikiText="Attention!! Please read." />);
      expect(container.querySelector('img')).toBeNull();
      const text = container.textContent ?? '';
      expect(text).toContain('Attention');
      expect(text).toContain('Please read');
      expect(text).toContain('!');
    });

    it('single exclamation mark that is not a valid image macro passes through unchanged', () => {
      // A lone ! with no closing ! is not a Jira image — must render as plain text.
      const { container } = render(<WikiRenderer wikiText="Just one! exclamation." />);
      expect(container.querySelector('img')).toBeNull();
      expect(container.textContent).toContain('Just one');
      expect(container.textContent).toContain('exclamation');
    });

    it('valid Jira image macro !filename.png! is still rendered as an image (no regression)', () => {
      const { container } = render(<WikiRenderer wikiText="See !screenshot.png! above." />);
      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toContain('screenshot.png');
    });

    it('!!! in a table cell renders as plain text, not a broken image', () => {
      const fixture = ['||Status||Note||', '|Done!!!|All good|'].join('\n');
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      expect(container.querySelector('img')).toBeNull();
      const table = container.querySelector('table');
      expect(table).not.toBeNull();
      expect(table?.textContent).toContain('Done');
      expect(table?.textContent).toContain('All good');
    });
  });

  // --- Horizontal divider (wiki-renderer-horizontal-divider) ---
  //
  // Jira wiki uses `----` on its own line as a full-width horizontal divider (<hr>).
  // jira2md's strikethrough regex /(\s+)-(\S+.*?\S)-(\s+)/g matches `----` when
  // surrounded by newlines, converting it to `~~--~~` (strikethrough of '--').
  // react-markdown renders that as struck-through dashes, not an <hr>.
  //
  // Fix: preprocessJiraMarkup replaces /^-{4,}$/gm with `---` (markdown thematic
  // break) BEFORE jira2md runs. jira2md leaves `---` untouched (inner content
  // would be 1 char, below the 2-char minimum of the strikethrough regex) and
  // react-markdown renders `---` on its own line as <hr>.
  describe('horizontal divider rendering (wiki-renderer-horizontal-divider)', () => {
    it('renders ---- on its own line as an <hr> element', () => {
      const { container } = render(<WikiRenderer wikiText="----" />);
      const hr = container.querySelector('hr');
      expect(hr).not.toBeNull();
    });

    it('does NOT render ---- as literal dashes or strikethrough text', () => {
      const { container } = render(<WikiRenderer wikiText="----" />);
      // Must not contain struck-through dashes (old bug: rendered as '--' via ~~--~~)
      const del = container.querySelector('del');
      expect(del).toBeNull();
      // The <hr> has no text content
      expect(container.textContent?.trim()).toBe('');
    });

    it('renders ---- surrounded by prose content as an <hr> between paragraphs', () => {
      const fixture = 'Text before divider\n----\nText after divider';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const hr = container.querySelector('hr');
      expect(hr).not.toBeNull();
      expect(container.textContent).toContain('Text before divider');
      expect(container.textContent).toContain('Text after divider');
    });

    it('renders ---- with blank lines around it as an <hr>', () => {
      const fixture = 'Before\n\n----\n\nAfter';
      const { container } = render(<WikiRenderer wikiText={fixture} />);
      const hr = container.querySelector('hr');
      expect(hr).not.toBeNull();
      expect(container.textContent).toContain('Before');
      expect(container.textContent).toContain('After');
    });

    it('renders 5 or more dashes as an <hr> (Jira allows -----)', () => {
      const { container } = render(<WikiRenderer wikiText="-----" />);
      const hr = container.querySelector('hr');
      expect(hr).not.toBeNull();
    });

    it('---- inside a sentence (not on its own line) is NOT converted to <hr>', () => {
      // Only standalone ---- lines (with nothing else on the line) become <hr>
      const { container } = render(<WikiRenderer wikiText="range: 1----10" />);
      expect(container.querySelector('hr')).toBeNull();
      expect(container.textContent).toContain('range');
    });
  });

  describe('attachment reference links (wiki-attachment-link-render)', () => {
    it('[^filename] with known attachment renders as a clickable anchor', () => {
      // Jira [^filename] attachment-reference syntax must not produce literal angle-bracket
      // text (<^filename>) — jira2md does not handle this form. The preprocessor converts
      // it to a raw <a href> element before jira2md runs.
      const attachments = {
        'rest-log-detail-85008276.txt':
          'https://jira.example.com/secure/attachment/1/rest-log-detail-85008276.txt',
      };
      const { container } = render(
        <WikiRenderer wikiText="[^rest-log-detail-85008276.txt]" attachments={attachments} />,
      );
      const anchor = container.querySelector('a');
      expect(anchor).not.toBeNull();
      expect(anchor?.getAttribute('href')).toBe(
        'https://jira.example.com/secure/attachment/1/rest-log-detail-85008276.txt',
      );
      expect(anchor?.textContent).toBe('rest-log-detail-85008276.txt');
      // Must NOT render as literal angle-bracket text
      expect(container.textContent).not.toContain('<^rest-log-detail-85008276.txt>');
    });

    it('multiple [^filename] references all render as anchors', () => {
      // The full symptom from the bug report: six consecutive [^...] references.
      const attachments = {
        'rest-log-detail-85008276.txt':
          'https://jira.example.com/secure/attachment/1/rest-log-detail-85008276.txt',
        'rest-log-detail-85053230.txt':
          'https://jira.example.com/secure/attachment/2/rest-log-detail-85053230.txt',
      };
      const wikiText = ['[^rest-log-detail-85008276.txt]', '[^rest-log-detail-85053230.txt]'].join(
        '',
      );
      const { container } = render(<WikiRenderer wikiText={wikiText} attachments={attachments} />);
      const anchors = container.querySelectorAll('a');
      // Both known attachments must be links
      const hrefs = Array.from(anchors).map((a) => a.getAttribute('href'));
      expect(hrefs).toContain(
        'https://jira.example.com/secure/attachment/1/rest-log-detail-85008276.txt',
      );
      expect(hrefs).toContain(
        'https://jira.example.com/secure/attachment/2/rest-log-detail-85053230.txt',
      );
    });

    it('[^filename] with unknown attachment renders as a code span, not a broken link', () => {
      // When no attachment map is provided or the filename is not in the map,
      // the reference should render as a visible code span rather than a broken link.
      const { container } = render(<WikiRenderer wikiText="[^unknown-file.txt]" />);
      const code = container.querySelector('code');
      expect(code).not.toBeNull();
      expect(code?.textContent).toBe('unknown-file.txt');
      // Must not produce a broken anchor with an empty/garbage href
      const anchors = container.querySelectorAll('a');
      const brokenAnchors = Array.from(anchors).filter(
        (a) => !a.getAttribute('href') || a.getAttribute('href') === '',
      );
      expect(brokenAnchors).toHaveLength(0);
    });

    it('[^filename] does not produce literal angle-bracket text (regression guard)', () => {
      // Core regression: the pre-fix output was "<^filename>" which must never appear.
      const attachments = {
        'file.txt': 'https://jira.example.com/secure/attachment/1/file.txt',
      };
      const { container } = render(
        <WikiRenderer wikiText="See [^file.txt] for details." attachments={attachments} />,
      );
      expect(container.textContent).not.toMatch(/<\^file\.txt>/);
      expect(container.textContent).toContain('file.txt');
    });
  });
});
