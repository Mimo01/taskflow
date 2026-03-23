/**
 * WidgetGrid -- responsive grid layout for dashboard widgets.
 *
 * Wraps react-grid-layout's ResponsiveGridLayout with project-specific
 * configuration (breakpoints, columns, row height, gutter). Merges
 * position updates back into DashboardLayoutItem[] preserving `type`
 * and `config` fields that react-grid-layout strips from its Layout type.
 */

import { useMemo } from 'react';
import type { ComponentClass } from 'react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { DashboardLayoutItem } from '@/stores/settings.store';
import WidgetCard from './WidgetCard';

// react-grid-layout CJS interop: the module exports Responsive and WidthProvider
// as properties on the default export, but TypeScript types declare them as
// namespace members. We import the raw module and extract at runtime.
// eslint-disable-next-line @typescript-eslint/no-var-requires
import _RGL from 'react-grid-layout';

const _module = _RGL as unknown as {
  Responsive: ComponentClass<Record<string, unknown>>;
  WidthProvider: (component: ComponentClass<Record<string, unknown>>) => ComponentClass<Record<string, unknown>>;
};
const ResponsiveGridLayout = _module.WidthProvider(_module.Responsive);

interface RGLLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface WidgetGridProps {
  layout: DashboardLayoutItem[];
  onLayoutChange: (layout: DashboardLayoutItem[]) => void;
  onRemoveWidget: (widgetId: string) => void;
}

export default function WidgetGrid({
  layout,
  onLayoutChange,
  onRemoveWidget,
}: WidgetGridProps) {
  // Build a lookup map to merge position changes back into full items
  const itemMap = useMemo(() => {
    const map = new Map<string, DashboardLayoutItem>();
    for (const item of layout) {
      map.set(item.i, item);
    }
    return map;
  }, [layout]);

  function handleLayoutChange(currentLayout: RGLLayout[]) {
    const merged: DashboardLayoutItem[] = currentLayout
      .map((l) => {
        const original = itemMap.get(l.i);
        if (!original) return null;
        return {
          ...original,
          x: l.x,
          y: l.y,
          w: l.w,
          h: l.h,
        };
      })
      .filter((item): item is DashboardLayoutItem => item !== null);

    onLayoutChange(merged);
  }

  return (
    <ResponsiveGridLayout
      layouts={{ lg: layout }}
      breakpoints={{ lg: 1200, md: 996, sm: 768 }}
      cols={{ lg: 12, md: 8, sm: 4 }}
      rowHeight={80}
      margin={[16, 16]}
      compactType="vertical"
      draggableHandle=".widget-drag-handle"
      onLayoutChange={handleLayoutChange}
    >
      {layout.map((item) => (
        <div key={item.i}>
          <WidgetCard
            widgetId={item.i}
            widgetType={item.type}
            onRemove={() => onRemoveWidget(item.i)}
          />
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
