import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { WIKI_CODE_FRAME, WIKI_CODE_PRE } from '@/lib/wiki/prose';
import { CODE_LANGUAGES } from '../languages';
import { setCodeLanguage } from '../panel-commands';

const NONE = '__none__';

const OPTIONS = CODE_LANGUAGES.map((l) => ({
  value: l.value,
  label: l.label,
  detail: l.value,
  keywords: [l.label, l.value],
}));

const NONE_OPTION = { value: NONE, label: 'None', keywords: ['none', 'plain'] };

export function CodeBlockView({ node, editor, getPos }: NodeViewProps) {
  const noformat = node.attrs.open === '{noformat}';
  const language = typeof node.attrs.language === 'string' ? node.attrs.language : null;
  return (
    <NodeViewWrapper className={WIKI_CODE_FRAME}>
      <div
        contentEditable={false}
        className="flex h-7 items-center border-b border-border bg-muted px-2 text-xs text-muted-foreground"
      >
        {noformat ? (
          <span>Noformat</span>
        ) : (
          <SearchableSelect
            aria-label="Code language"
            value={language ?? NONE}
            options={OPTIONS}
            pinnedOption={NONE_OPTION}
            searchPlaceholder="Search languages…"
            className="h-6 text-xs"
            finalFocus={() => editor.view.dom}
            onValueChange={(v) => {
              const pos = getPos();
              if (typeof pos === 'number') setCodeLanguage(editor, pos, v === NONE ? null : v);
            }}
          />
        )}
      </div>
      <pre className={WIKI_CODE_PRE}>
        <NodeViewContent<'code'> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}
