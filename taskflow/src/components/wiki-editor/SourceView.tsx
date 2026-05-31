/**
 * SourceView — styled monospace textarea for editing raw Jira wiki markup.
 *
 * Extracted as a separate component so WYSIWYG and Source share consistent
 * layout (same border/padding/min-height as the TipTap editor container).
 *
 * CodeMirror 6 is an optional later polish (deferred per RESEARCH). The
 * <textarea> approach has no extra dependencies and matches the existing
 * DescriptionEditor font-mono style.
 */

interface SourceViewProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: number;
  id?: string;
}

export function SourceView({
  value,
  onChange,
  disabled,
  placeholder,
  minHeight = 80,
  id,
}: SourceViewProps) {
  return (
    <textarea
      id={id}
      aria-label="Source"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder ?? 'Enter Jira wiki markup…'}
      spellCheck={false}
      className="w-full resize-y rounded border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
      style={{ minHeight }}
    />
  );
}
