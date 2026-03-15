/**
 * WorkflowSection — Settings page for workflow and sprint board preferences.
 *
 * Renders:
 * - StaleMrThresholdSection (existing, reads store internally)
 * - Sprint Board subsection: collapse parent stories + show subtasks toggles
 * - Advanced subsection: DebugModeSection (existing, reads store internally)
 */
import { useSettingsStore } from '../../stores/settings.store';
import StaleMrThresholdSection from './StaleMrThresholdSection';
import DebugModeSection from './DebugModeSection';

export default function WorkflowSection() {
  const {
    sprintCollapseByDefault,
    setSprintCollapseByDefault,
    showSubtasksInMyTasks,
    setShowSubtasksInMyTasks,
  } = useSettingsStore();

  return (
    <div data-testid="section-workflow" className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Workflow</h2>

      <StaleMrThresholdSection />

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Sprint Board
        </h3>
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-medium">Collapse parent stories by default</p>
            <p className="text-xs text-muted-foreground">
              Parent stories start collapsed on the board — click to expand
            </p>
          </div>
          <input
            type="checkbox"
            aria-label="Collapse parent stories by default"
            checked={sprintCollapseByDefault}
            onChange={(e) => setSprintCollapseByDefault(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
        </label>
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-medium">Show subtasks in My Tasks</p>
            <p className="text-xs text-muted-foreground">
              Include subtasks alongside their parent stories in the My Tasks list
            </p>
          </div>
          <input
            type="checkbox"
            aria-label="Show subtasks in My Tasks"
            checked={showSubtasksInMyTasks}
            onChange={(e) => setShowSubtasksInMyTasks(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
        </label>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Advanced
        </h3>
        <DebugModeSection />
      </div>
    </div>
  );
}
