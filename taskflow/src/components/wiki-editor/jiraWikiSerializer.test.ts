/**
 * jiraWikiSerializer — Round-trip test matrix (RED gate for Task 3).
 *
 * Tests: Jira wiki string -> jiraToTiptap -> TipTap JSON doc -> serializeToJiraWiki
 * -> Jira wiki string, asserting semantic equality for every supported style.
 *
 * Tests operate on the TipTap JSON / schema layer — no live browser/DOM required.
 * jsdom environment is sufficient because TipTap headless schema operations don't
 * need a real layout engine.
 *
 * HARD GATE: All tests must pass before Task 4 proceeds.
 */

import { describe, expect, it } from 'vitest';

// These imports will fail (RED) until jiraToTiptap.ts and jiraWikiSerializer.ts
// are implemented — that is the expected RED state.
import { isSafeColor } from './extensions/JiraColorMark';
import { jiraToTiptap } from './jiraToTiptap';
import { serializeToJiraWiki } from './jiraWikiSerializer';

/**
 * Round-trip helper: Jira wiki -> TipTap JSON -> Jira wiki.
 * Returns the serialized output for assertion.
 */
function roundTrip(wiki: string): string {
  const json = jiraToTiptap(wiki);
  return serializeToJiraWiki(json);
}

// ---------------------------------------------------------------------------
// Inline marks
// ---------------------------------------------------------------------------

describe('inline marks', () => {
  it('bold: *text* round-trips', () => {
    expect(roundTrip('*hello*')).toBe('*hello*');
  });

  it('italic: _text_ round-trips', () => {
    expect(roundTrip('_hello_')).toBe('_hello_');
  });

  it('strikethrough: -text- round-trips', () => {
    expect(roundTrip('-hello-')).toBe('-hello-');
  });

  it('inline code: {{text}} round-trips', () => {
    expect(roundTrip('{{hello}}')).toBe('{{hello}}');
  });
});

// ---------------------------------------------------------------------------
// Headings
// ---------------------------------------------------------------------------

describe('headings', () => {
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    it(`h${level}. round-trips`, () => {
      const input = `h${level}. My Heading`;
      const output = roundTrip(input);
      expect(output).toBe(input);
    });
  }
});

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

describe('lists', () => {
  it('bullet list (* item) round-trips', () => {
    const input = '* Item one\n* Item two';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });

  it('nested bullet list (** item) round-trips', () => {
    const input = '* Parent\n** Child';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });

  it('ordered list (# item) round-trips', () => {
    const input = '# First\n# Second';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });

  it('nested ordered list (## item) round-trips', () => {
    const input = '# First\n## Sub';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });

  it('task list items serialize to emoticon-prefix convention (D-OQ1)', () => {
    // Task items from TipTap serialize to (/) for checked, (x) for unchecked
    // We create the JSON directly to test the serializer path
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Done item' }] }],
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Todo item' }] }],
            },
          ],
        },
      ],
    };
    const output = serializeToJiraWiki(doc);
    expect(output).toContain('(/) Done item');
    expect(output).toContain('(x) Todo item');
  });

  it('task list round-trip: serialize → Jira → jiraToTiptap → taskList with correct checked state (CR-04)', () => {
    // Construct a taskList doc and serialize it to Jira wiki markup
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Done item' }] }],
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Todo item' }] }],
            },
          ],
        },
      ],
    };
    const jiraWiki = serializeToJiraWiki(doc);
    // Must emit the emoticon convention
    expect(jiraWiki).toContain('(/) Done item');
    expect(jiraWiki).toContain('(x) Todo item');

    // Re-load via jiraToTiptap — must reconstruct real taskList nodes (not emoticon text)
    const reloaded = jiraToTiptap(jiraWiki);
    const taskListNode = reloaded.content?.find((n) => n.type === 'taskList');
    expect(taskListNode).toBeDefined();
    const items = taskListNode?.content ?? [];
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('taskItem');
    expect(items[0].attrs?.checked).toBe(true);
    expect(items[1].type).toBe('taskItem');
    expect(items[1].attrs?.checked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Blockquote
// ---------------------------------------------------------------------------

describe('blockquote', () => {
  it('single-line blockquote (bq.) round-trips', () => {
    const input = 'bq. A quoted line';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });

  it('multi-line {quote} block round-trips', () => {
    const input = '{quote}\nLine one\nLine two\n{quote}';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Code block
// ---------------------------------------------------------------------------

describe('code block', () => {
  it('code block with language round-trips', () => {
    const input = '{code:javascript}\nconsole.log("hi");\n{code}';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });

  it('code block without language round-trips', () => {
    const input = '{code}\nsome code\n{code}';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Horizontal rule
// ---------------------------------------------------------------------------

describe('horizontal rule', () => {
  it('---- round-trips as ----', () => {
    const output = roundTrip('----');
    expect(output).toBe('----');
  });
});

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

describe('links', () => {
  it('[text|url] link round-trips', () => {
    const input = '[Click here|https://example.com]';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });

  it('[url] bare link round-trips', () => {
    const input = '[https://example.com]';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

describe('tables', () => {
  it('||header||header|| / |cell|cell| table round-trips', () => {
    const input = '||Name||Age||\n|Alice|30|\n|Bob|25|';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Mentions
// ---------------------------------------------------------------------------

describe('mentions', () => {
  it('[~username] mention round-trips', () => {
    const input = '[~jsmith]';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });

  it('[~accountId:XXX] mention round-trips', () => {
    const input = '[~accountId:abc123def456]';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Color macro
// ---------------------------------------------------------------------------

describe('color macro', () => {
  it('{color:#hex}text{color} round-trips via JiraColorMark', () => {
    const input = '{color:#ff0000}red text{color}';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Panel / callout
// ---------------------------------------------------------------------------

describe('panel callout', () => {
  it('{panel:title=T}body{panel} round-trips via JiraCalloutNode', () => {
    const input = '{panel:title=My Panel}\nPanel body text\n{panel}';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });

  it('{info}body{info} round-trips', () => {
    const input = '{info}\nInfo body\n{info}';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// RawJiraNode — verbatim unknown macro preservation (the #1 lossless guarantee)
// ---------------------------------------------------------------------------

describe('RawJiraNode passthrough', () => {
  it('unknown macro is preserved verbatim — not dropped', () => {
    const unknownMacro = '{unknownmacro}stuff inside{unknownmacro}';
    // Unknown macros should be captured in a rawJira node and emitted verbatim
    const output = roundTrip(unknownMacro);
    expect(output).toContain(unknownMacro);
  });
});

// ---------------------------------------------------------------------------
// No-op idempotence (RESEARCH Pitfall 2 guard)
// ---------------------------------------------------------------------------

describe('no-op idempotence', () => {
  it('loading and serializing a plain paragraph does not rewrite it', () => {
    const input = 'Hello world';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });

  it('loading and serializing bold + italic does not normalize the markup', () => {
    const input = '*bold* and _italic_';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });

  it('loading and serializing a heading+list combo is idempotent', () => {
    const input = 'h2. Title\n* Item one\n* Item two';
    const output = roundTrip(input);
    expect(output).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// CR-01: isSafeColor — CSS injection guard (JiraColorMark security test)
// ---------------------------------------------------------------------------

describe('isSafeColor (CSS injection guard)', () => {
  it('accepts 3-digit hex', () => expect(isSafeColor('#f0a')).toBe(true));
  it('accepts 6-digit hex', () => expect(isSafeColor('#ff0000')).toBe(true));
  it('accepts 4-digit hex (with alpha)', () => expect(isSafeColor('#f0a8')).toBe(true));
  it('accepts 8-digit hex (with alpha)', () => expect(isSafeColor('#ff0000cc')).toBe(true));
  it('accepts rgb()', () => expect(isSafeColor('rgb(255, 0, 0)')).toBe(true));
  it('accepts rgba()', () => expect(isSafeColor('rgba(255, 0, 0, 0.5)')).toBe(true));
  it('accepts CSS named color', () => expect(isSafeColor('red')).toBe(true));
  it('accepts "transparent"', () => expect(isSafeColor('transparent')).toBe(true));

  // Malicious / injection values must be rejected
  it('rejects injection: "red;background:url(...)"', () =>
    expect(isSafeColor('red;background:url(https://evil.example)')).toBe(false));
  it('rejects injection: value with semicolon', () =>
    expect(isSafeColor('#ff0000;color:red')).toBe(false));
  it('rejects injection: expression() (IE legacy)', () =>
    expect(isSafeColor('expression(alert(1))')).toBe(false));
  it('rejects injection: closing style tag fragment', () =>
    expect(isSafeColor('</style><script>alert(1)</script>')).toBe(false));
  it('rejects injection: url() exfiltration', () =>
    expect(isSafeColor('url(javascript:alert(1))')).toBe(false));
  it('rejects hex with trailing junk', () =>
    expect(isSafeColor('#ff0000 !important')).toBe(false));
});
