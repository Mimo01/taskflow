import AioBlock from '@/components/integrations/AioBlock';
import { useSettingsStore } from '../../stores/settings.store';

export default function IntegrationsSection() {
  // IN-01: fine-grained selectors avoid re-rendering this component on every
  // unrelated settings-store mutation (theme, density, sidebarCollapsed, etc.).
  const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);
  const setTempoEnabled = useSettingsStore((s) => s.setTempoEnabled);

  return (
    <div data-testid="section-integrations" className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Integrations</h2>
      <AioBlock />
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Tempo Timesheets
        </h3>
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-semibold">Enable Tempo Timesheets</p>
            <p className="text-xs text-muted-foreground">
              Show worklog data from Jira Tempo Timesheets. Requires Tempo plugin on your Jira
              instance.
            </p>
          </div>
          <input
            type="checkbox"
            aria-label="Enable Tempo Timesheets"
            checked={tempoEnabled}
            onChange={(e) => setTempoEnabled(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
        </label>
      </div>
    </div>
  );
}
