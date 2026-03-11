/**
 * ThemeSection — Theme toggle in Settings.
 *
 * Three-way toggle: Light / Dark / System.
 * Calls applyTheme() immediately (instant DOM update) then saveTheme() to persist.
 * Reads/writes useSettingsStore().theme as the controlled value.
 */
import { Sun, Moon, Monitor } from 'lucide-react';
import { applyTheme, saveTheme, type Theme } from '@/services/theme';
import { useSettingsStore } from '@/stores/settings.store';
import { cn } from '@/lib/utils';

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="h-5 w-5" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-5 w-5" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-5 w-5" /> },
];

export default function ThemeSection() {
  const { theme, setTheme } = useSettingsStore();

  const handleThemeChange = async (selected: Theme) => {
    applyTheme(selected); // instant DOM update
    setTheme(selected); // update store
    await saveTheme(selected); // persist to Tauri Store
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold">Appearance</h3>
        <p className="text-sm text-muted-foreground">
          Choose your preferred color scheme.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {THEME_OPTIONS.map(({ value, label, icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleThemeChange(value)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors',
              theme === value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-foreground hover:bg-accent',
            )}
            aria-pressed={theme === value}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
