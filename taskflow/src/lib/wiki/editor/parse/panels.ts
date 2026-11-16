import type { JSONContent } from '@tiptap/core';
import type { MacroSpan } from './macros';

/**
 * Panel family parser (Phase 97, Plan 06): `{panel}`, `{info}`, `{note}`,
 * `{warning}`, `{tip}`, bare or with `title=` parameters. Only the opener forms
 * the renderer turns into panels (bare, or `title=<text>`) are modelled; any
 * other parameter list stays a rawBlock (D-12, T-97-20).
 */

const OPENER = /^\{(panel|info|note|warning|tip)(?::([^}]*))?\}/;

type Block = { end: number; node: JSONContent };
export type ContainerBodyParser = (src: string) => {
  content: JSONContent[];
  bodyLead: string;
  bodyTail: string;
};

/** True for the parameter text the renderer converts (`title=` plus something). */
export const isPanelParams = (params: string | undefined): boolean =>
  params === undefined || (params.startsWith('title=') && params.length > 6);

/**
 * The panel opened at the start of `lines[i]`, or null when it cannot be
 * modelled without guessing (other parameters, text after the closer, a nested
 * opener of the same name).
 */
export function parsePanel(
  lines: readonly string[],
  i: number,
  span: MacroSpan,
  parseBody: ContainerBodyParser,
): Block | null {
  const line = lines[i] ?? '';
  const m = OPENER.exec(line);
  if (!m || !span.closer) return null;
  const name = m[1] as string;
  const params = m[2];
  if (!isPanelParams(params)) return null;
  const closeToken = `{${name}}`;
  const [k, col] = span.closer;
  const closeLine = lines[k] ?? '';
  if (closeLine.length !== col + closeToken.length) return null;
  const body =
    k === i
      ? line.slice(m[0].length, col)
      : [line.slice(m[0].length), ...lines.slice(i + 1, k), closeLine.slice(0, col)].join('\n');
  if (body.includes(`{${name}:`)) return null;
  const parsed = parseBody(body);
  return {
    end: span.end,
    node: {
      type: 'panel',
      attrs: {
        type: name,
        params: params ?? null,
        bodyLead: parsed.bodyLead,
        bodyTail: parsed.bodyTail,
      },
      content: parsed.content,
    },
  };
}
