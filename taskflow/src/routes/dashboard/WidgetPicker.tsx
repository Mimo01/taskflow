/**
 * WidgetPicker -- dialog listing all available widget types from WIDGET_REGISTRY.
 *
 * Each widget card shows icon, title, and description. Clicking adds the widget
 * to the dashboard. The dialog stays open for multiple adds (per UI-SPEC).
 */

import { Dialog } from '@base-ui/react/dialog';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WIDGET_REGISTRY } from './widgets/registry';

interface WidgetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddWidget: (type: string) => void;
  showTrigger?: boolean;
}

export default function WidgetPicker({
  open,
  onOpenChange,
  onAddWidget,
  showTrigger = true,
}: WidgetPickerProps) {
  const widgetDefs = Object.values(WIDGET_REGISTRY);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {showTrigger && (
        <Dialog.Trigger
          render={
            <Button variant="outline" size="sm">
              <Plus className="size-4 mr-1" />
              Add Widget
            </Button>
          }
        />
      )}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-background p-4 ring-1 ring-foreground/10 shadow-lg outline-none">
          <Dialog.Title className="text-base font-medium mb-4">
            Add a Widget
          </Dialog.Title>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {widgetDefs.map((def) => (
              <button
                key={def.type}
                type="button"
                role="button"
                aria-label={`Add ${def.title} widget`}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:bg-accent cursor-pointer text-center"
                onClick={() => onAddWidget(def.type)}
              >
                <def.icon className="h-5 w-5" />
                <span className="text-sm font-medium">{def.title}</span>
                <span className="text-xs text-muted-foreground">
                  {def.description}
                </span>
              </button>
            ))}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
