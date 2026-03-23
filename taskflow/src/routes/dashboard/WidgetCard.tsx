/**
 * WidgetCard -- card shell for each dashboard widget.
 *
 * Provides a title bar with drag handle (GripVertical), widget title,
 * and remove button (X). Resolves the widget component from WIDGET_REGISTRY
 * and renders it in a scrollable content area.
 */

import { GripVertical, X } from 'lucide-react';
import { WIDGET_REGISTRY } from './widgets/registry';

interface WidgetCardProps {
  widgetId: string;
  widgetType: string;
  onRemove: () => void;
}

export default function WidgetCard({
  widgetId,
  widgetType,
  onRemove,
}: WidgetCardProps) {
  const widgetDef = WIDGET_REGISTRY[widgetType];

  if (!widgetDef) {
    return (
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden h-full flex flex-col items-center justify-center text-sm text-muted-foreground p-3">
        Unknown widget type: {widgetType}
      </div>
    );
  }

  const WidgetComponent = widgetDef.component;

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden h-full flex flex-col">
      {/* Title bar */}
      <div className="flex items-center h-10 px-3 border-b border-border bg-card gap-2">
        <div className="widget-drag-handle cursor-grab">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-sm font-medium text-foreground truncate flex-1">
          {widgetDef.title}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="size-6 rounded-sm hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
          aria-label={`Remove ${widgetDef.title} widget`}
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-3">
        <WidgetComponent widgetId={widgetId} />
      </div>
    </div>
  );
}
