/**
 * AppearanceSection — Theme and density settings.
 *
 * Wraps the ThemeSection component for the three-way theme toggle and adds
 * a 3-tier density selector (Compact / Default / Comfortable).
 *
 * Calls applyDensity() on mount (via useEffect) to keep the DOM attribute in
 * sync after store hydration, and on every user selection.
 */
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { applyDensity } from '@/services/theme';
import { type Density, useSettingsStore } from '@/stores/settings.store';
import ThemeSection from './ThemeSection';

const DENSITY_OPTIONS: { value: Density; label: string; description: string }[] = [
  { value: 'compact', label: 'Compact', description: 'More rows visible' },
  { value: 'default', label: 'Default', description: 'Balanced spacing' },
  { value: 'comfortable', label: 'Comfortable', description: 'Extra breathing room' },
];

export default function AppearanceSection() {
  const { density, setDensity } = useSettingsStore();

  // Sync data-density attribute after store hydration
  useEffect(() => {
    applyDensity(density);
  }, [density]);

  return (
    <div data-testid="section-appearance" className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Appearance</h2>
      <ThemeSection />
      <div className="flex flex-col gap-3">
        {/* biome-ignore lint/a11y/noLabelWithoutControl: labels a group of toggle buttons, not a single form control */}
        <label className="text-sm font-medium">Display Density</label>
        <div className="flex gap-2">
          {DENSITY_OPTIONS.map(({ value, label, description }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setDensity(value);
                applyDensity(value);
              }}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border text-sm',
                density === value
                  ? 'border-primary bg-accent text-accent-foreground font-semibold'
                  : 'border-border hover:bg-accent',
              )}
            >
              <span className="font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">{description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
