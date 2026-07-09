import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { CODE_EXTENSION_LANGUAGE_MAP as EXTENSION_TO_LANGUAGE } from './resolvePreviewKind';

hljs.registerLanguage('json', json);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('java', java);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx === -1 || idx === filename.length - 1) return '';
  return filename.slice(idx + 1).toLowerCase();
}

/**
 * Highlights source code using highlight.js core (only the languages
 * registered above are bundled — keeps the bundle small per RESEARCH's
 * highlight.js guidance). Maps the filename extension to a registered
 * language; falls back to highlightAuto for unmapped extensions. Returns
 * hljs-escaped HTML (safe to inject via dangerouslySetInnerHTML — the
 * source text is HTML-escaped by hljs before being wrapped in token spans).
 */
export function highlightCode(source: string, filename: string): string {
  const ext = getExtension(filename);
  const language = EXTENSION_TO_LANGUAGE[ext];

  if (language) {
    return hljs.highlight(source, { language, ignoreIllegals: true }).value;
  }

  return hljs.highlightAuto(source).value;
}
