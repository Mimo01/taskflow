/**
 * DescriptionEditor — wraps <WikiEditor> for the issue description field.
 *
 * D-OQ3: Dropped Edit/Preview tabs — the WYSIWYG view IS the preview.
 * The Source toggle covers raw Jira wiki markup editing.
 *
 * This is a near-drop-in replacement: same value/onChange/disabled/id API.
 */
import { WikiEditor } from '@/components/wiki-editor';

interface DescriptionEditorProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function DescriptionEditor({ id, value, onChange, disabled }: DescriptionEditorProps) {
  return (
    <WikiEditor
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      variant="description"
      placeholder="Describe the issue…"
      showSourceToggle
    />
  );
}
