/**
 * ThemeToggle — Compact icon button cycling through light/dark/system themes.
 *
 * Minimal UI for use in sidebars/headers. A single icon (Sun/Moon/Monitor)
 * cycles on each click: light → dark → system → light.
 * Calls applyTheme() immediately then saveTheme() to persist.
 */
import { Sun, Moon, Monitor } from 'lucide-react';
import { applyTheme, saveTheme, type Theme } from '@/services/theme';
import { useSettingsStore } from '@/stores/settings.store';

const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];

const THEME_ICONS: Record<Theme, React.ReactNode> = {
  light: <Sun className="h-4 w-4" />,
  dark: <Moon className="h-4 w-4" />,
  system: <Monitor className="h-4 w-4" />,
};

const THEME_LABELS: Record<Theme, string> = {
  light: 'Switch to dark mode',
  dark: 'Switch to system mode',
  system: 'Switch to light mode',
};

export default function ThemeToggle() {
  const { theme, setTheme } = useSettingsStore();

  const handleClick = async () => {
    const currentIndex = THEME_CYCLE.indexOf(theme);
    const nextTheme = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
    applyTheme(nextTheme);
    setTheme(nextTheme);
    await saveTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={THEME_LABELS[theme]}
      title={THEME_LABELS[theme]}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent transition-colors w-full text-left"
    >
      {THEME_ICONS[theme]}
      <span className="hidden md:block capitalize">{theme}</span>
    </button>
  );
}
