/**
 * KeyboardShortcutsPanel — centered modal listing all registered keyboard shortcuts.
 *
 * Opens when the user presses `mod+/` / Cmd+/ (macOS) / Ctrl+/ (from anywhere, except inside text inputs — KEYS-07).
 * Closes on Escape (handled natively by @base-ui/react/dialog — KEYS-02).
 * Do NOT add useHotkeys('escape') here — it would cause double-fire.
 *
 * To add more shortcuts in future phases: append entries to src/lib/shortcuts.ts.
 * This component reads from the SHORTCUTS constant and needs no changes.
 */
import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Keyboard, Compass, List, Zap } from 'lucide-react';
import { SHORTCUTS, type ShortcutCategory } from '@/lib/shortcuts';

const CATEGORIES: { key: ShortcutCategory; icon: React.ReactNode }[] = [
  { key: 'General', icon: <Keyboard className="h-3.5 w-3.5" /> },
  { key: 'Navigation', icon: <Compass className="h-3.5 w-3.5" /> },
  { key: 'Lists', icon: <List className="h-3.5 w-3.5" /> },
  { key: 'Actions', icon: <Zap className="h-3.5 w-3.5" /> },
];

const keycapClass =
  'inline-flex items-center justify-center min-w-[24px] h-[22px] px-1.5 text-[11px] font-medium font-mono bg-gradient-to-b from-muted to-muted/80 text-muted-foreground border border-border/80 rounded-[4px] shadow-[0_1px_0_1px_rgba(0,0,0,0.05)]';

function Keycap({ children }: { children: React.ReactNode }) {
  return <kbd className={keycapClass}>{children}</kbd>;
}

export interface KeyboardShortcutsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsPanel({ open, onClose }: KeyboardShortcutsPanelProps) {
  const [search, setSearch] = useState('');

  const query = search.toLowerCase().trim();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setSearch('');
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2
                     w-full max-w-[500px]
                     bg-background rounded-lg shadow-lg
                     flex flex-col
                     animate-in fade-in-0 zoom-in-95 duration-200"
          aria-describedby="kbd-panel-desc"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-3 space-y-3">
            <Dialog.Title className="text-base font-semibold">
              Keyboard Shortcuts
            </Dialog.Title>
            <p id="kbd-panel-desc" className="sr-only">
              A list of all available keyboard shortcuts grouped by category.
            </p>
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Filter shortcuts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-border rounded-md pl-8 pr-3 py-1.5 text-sm bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto max-h-[50vh] px-6">
            {(() => {
              let hasAnyMatch = false;
              const sections = CATEGORIES.map(({ key: cat, icon }, catIdx) => {
                const entries = SHORTCUTS.filter(
                  (s) =>
                    s.category === cat &&
                    (query === '' || s.description.toLowerCase().includes(query))
                );
                if (entries.length === 0) return null;
                hasAnyMatch = true;
                return (
                  <div key={cat}>
                    <div
                      className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground py-2${
                        catIdx > 0 ? ' border-t border-border mt-2' : ''
                      }`}
                    >
                      {icon}
                      {cat}
                    </div>
                    {entries.map((entry) => {
                      const keys = entry.displayKeys ?? [entry.defaultKey];
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <span className="text-sm">{entry.description}</span>
                          <span className="flex items-center gap-1 shrink-0 ml-4">
                            {keys.map((k, i) => (
                              <Keycap key={i}>{k}</Keycap>
                            ))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              });

              if (!hasAnyMatch && query !== '') {
                return (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No shortcuts found
                  </div>
                );
              }

              return sections;
            })()}
          </div>

          {/* Footer */}
          <div className="border-t border-border pt-3 pb-4 mt-3 flex justify-center text-xs text-muted-foreground px-6">
            <span>
              Press <Keycap>Esc</Keycap> to close
            </span>
          </div>

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
