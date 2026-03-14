import { useRef } from 'react'
import { Bold, Italic, Code, List } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { WikiRenderer } from './WikiRenderer'

interface DescriptionEditorProps {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

function insertAtCursor(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  before: string,
  after: string,
  setValue: (v: string) => void,
  currentValue: string,
) {
  const el = textareaRef.current
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const newText =
    currentValue.slice(0, start) +
    before +
    currentValue.slice(start, end) +
    after +
    currentValue.slice(end)
  setValue(newText)
  requestAnimationFrame(() => {
    el.selectionStart = start + before.length
    el.selectionEnd = end + before.length
    el.focus()
  })
}

export function DescriptionEditor({ value, onChange, disabled }: DescriptionEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  return (
    <Tabs defaultValue="edit" className="w-full">
      <TabsList>
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>

      <TabsContent value="edit">
        <div className="flex flex-col gap-1">
          {/* Formatting toolbar */}
          <div className="flex items-center gap-1 border-b pb-1">
            <button
              type="button"
              disabled={disabled}
              className="rounded p-1 hover:bg-accent disabled:opacity-50"
              title="Bold"
              onClick={() => insertAtCursor(textareaRef, '*', '*', onChange, value)}
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              className="rounded p-1 hover:bg-accent disabled:opacity-50"
              title="Italic"
              onClick={() => insertAtCursor(textareaRef, '_', '_', onChange, value)}
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              className="rounded p-1 hover:bg-accent disabled:opacity-50"
              title="Inline Code"
              onClick={() => insertAtCursor(textareaRef, '{code}', '{code}', onChange, value)}
            >
              <Code className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              className="rounded p-1 hover:bg-accent disabled:opacity-50"
              title="Bullet"
              onClick={() => insertAtCursor(textareaRef, '* ', '', onChange, value)}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="Describe the issue..."
            className="min-h-[120px] resize-y font-mono text-sm"
          />
        </div>
      </TabsContent>

      <TabsContent value="preview">
        {value ? (
          <WikiRenderer wikiText={value} className="min-h-[120px]" />
        ) : (
          <p className="min-h-[120px] text-sm text-muted-foreground">Nothing to preview</p>
        )}
      </TabsContent>
    </Tabs>
  )
}
