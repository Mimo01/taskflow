/**
 * KeyboardShortcutsPanel — centered modal listing all registered keyboard shortcuts.
 *
 * Opens when the user presses `?` (from anywhere, except inside text inputs — KEYS-07).
 * Closes on Escape (handled natively by @base-ui/react/dialog — KEYS-02).
 * Do NOT add useHotkeys('escape') here — it would cause double-fire.
 *
 * To add more shortcuts in future phases: append entries to src/lib/shortcuts.ts.
 * This component reads from the SHORTCUTS constant and needs no changes.
 */
import { Dialog } from '@base-ui/react/dialog';
import { SHORTCUTS, type ShortcutCategory } from '@/lib/shortcuts';

const CATEGORIES: ShortcutCategory[] = ['Navigation', 'Lists', 'Actions', 'General'];

export interface KeyboardShortcutsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsPanel({ open, onClose }: KeyboardShortcutsPanelProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2
                     w-full max-w-[500px] max-h-[80vh] overflow-y-auto
                     bg-background rounded-lg shadow-lg p-6"
          aria-describedby="kbd-panel-desc"
        >
          <Dialog.Title className="text-lg font-semibold mb-4">
            Keyboard Shortcuts
          </Dialog.Title>
          <p id="kbd-panel-desc" className="sr-only">
            A list of all available keyboard shortcuts grouped by category.
          </p>
          {CATEGORIES.map((cat) => {
            const entries = SHORTCUTS.filter((s) => s.category === cat);
            if (entries.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-4 pb-1 first:pt-0">
                  {cat}
                </h3>
                {entries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-2 gap-4">
                    <span className="text-sm text-foreground">{entry.description}</span>
                    <kbd className="inline-flex items-center px-2 py-1 text-xs font-normal bg-muted text-foreground border border-border rounded-sm font-mono">
                      {entry.defaultKey}
                    </kbd>
                  </div>
                ))}
              </div>
            );
          })}
          <Dialog.Close
            render={
              <button
                type="button"
                className="sr-only"
                aria-label="Close keyboard shortcuts"
              />
            }
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
