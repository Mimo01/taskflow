/**
 * LinksSection — Settings section for choosing which browser external links open in.
 *
 * Applies to every external link app-wide: dedicated "open in browser"
 * buttons/menu items AND links clicked inside rendered descriptions/comments.
 * See src/lib/openExternal.ts for the single sanctioned boundary that reads
 * this preference.
 */

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BrowserInfo } from '@/lib/openExternal';
import { tauriService } from '@/services/tauri';
import { useSettingsStore } from '@/stores/settings.store';

const SYSTEM_DEFAULT_VALUE = '__default__';

function basename(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export default function LinksSection() {
  const externalBrowser = useSettingsStore((s) => s.externalBrowser);
  const setExternalBrowser = useSettingsStore((s) => s.setExternalBrowser);
  const [browsers, setBrowsers] = useState<BrowserInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    tauriService
      .invoke<BrowserInfo[]>('list_browsers')
      .then((result) => {
        if (!cancelled) setBrowsers(result);
      })
      .catch(() => {
        // Degrade to System Default only — no toast, per the locked
        // fail-quietly decision.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // If the persisted preference points at a browser no longer in the
  // detected list (moved or uninstalled), surface it anyway so the Select
  // still reflects the user's choice rather than silently falling back.
  const missingSelection =
    externalBrowser !== null && !browsers.some((b) => b.path === externalBrowser)
      ? externalBrowser
      : null;

  const selectValue = externalBrowser === null ? SYSTEM_DEFAULT_VALUE : externalBrowser;

  return (
    <div data-testid="section-links" className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Links</h2>
      <div className="flex flex-col gap-3">
        <label htmlFor="external-browser" className="text-sm font-medium">
          Open links in
        </label>
        <p className="text-sm text-muted-foreground">
          Applies to every external link — issue/MR "open in browser" buttons and links inside
          descriptions and comments.
        </p>
        <Select
          value={selectValue}
          onValueChange={(val) => setExternalBrowser(val === SYSTEM_DEFAULT_VALUE ? null : val)}
        >
          <SelectTrigger id="external-browser" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SYSTEM_DEFAULT_VALUE}>System Default</SelectItem>
            {browsers.map((browser) => (
              <SelectItem key={browser.path} value={browser.path}>
                {browser.label}
              </SelectItem>
            ))}
            {missingSelection && (
              <SelectItem value={missingSelection}>
                {basename(missingSelection)} (not found)
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
