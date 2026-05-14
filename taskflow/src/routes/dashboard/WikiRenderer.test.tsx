import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeOpenTableRows, WikiRenderer } from './WikiRenderer';

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

    it('panels reset first/last-child paragraph margins to neutralize prose spacing', () => {
      // Verify all four callout types carry the surgical margin-reset classes that
      // prevent prose-sm paragraph margins from stacking with the panel's own p-3
      // padding (root cause: first <p> top-margin + p-3 = doubled apparent padding).
      const calloutCases: Array<{ type: string; wikiText: string }> = [
        { type: 'panel', wikiText: '{panel}line 1\n\nline 2{panel}' },
        { type: 'info', wikiText: '{info}line 1\n\nline 2{info}' },
        { type: 'warning', wikiText: '{warning}line 1\n\nline 2{warning}' },
        { type: 'note', wikiText: '{note}line 1\n\nline 2{note}' },
      ];
      for (const { type, wikiText } of calloutCases) {
        const { container } = render(<WikiRenderer wikiText={wikiText} />);
        const callout = container.querySelector(`[data-callout="${type}"]`);
        expect(callout, `${type}: callout element should exist`).not.toBeNull();
        const cls = callout!.className;
        expect(cls, `${type}: should contain [&>p:first-child]:mt-0`).toContain(
          '[&>p:first-child]:mt-0',
        );
        expect(cls, `${type}: should contain [&>p:last-child]:mb-0`).toContain(
          '[&>p:last-child]:mb-0',
        );
      }
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
      const article = container.querySelector('article');
      expect(article).not.toBeNull();
      // Clone the article and remove the table; what remains is "sibling content".
      const cloned = article!.cloneNode(true) as HTMLElement;
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
});
