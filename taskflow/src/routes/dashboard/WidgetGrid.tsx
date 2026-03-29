/**
 * WidgetGrid -- responsive grid layout for dashboard widgets.
 *
 * Wraps react-grid-layout's ResponsiveGridLayout with project-specific
 * configuration (breakpoints, columns, row height, gutter). Merges
 * position updates back into DashboardLayoutItem[] preserving `type`
 * and `config` fields that react-grid-layout strips from its Layout type.
 */

import type { Layout } from 'react-grid-layout';
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { DashboardLayoutItem } from '@/stores/settings.store';
import WidgetCard from './WidgetCard';

interface WidgetGridProps {
  layout: DashboardLayoutItem[];
  onLayoutChange: (layout: DashboardLayoutItem[]) => void;
  onRemoveWidget: (widgetId: string) => void;
  isEditable: boolean;
}

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768 };
const COLS = { lg: 12, md: 8, sm: 4 };

export default function WidgetGrid({
  layout,
  onLayoutChange,
  onRemoveWidget,
  isEditable,
}: WidgetGridProps) {
  const { width, containerRef } = useContainerWidth();

  // Build a lookup map to merge position changes back into full items
  const itemMap = new Map<string, DashboardLayoutItem>();
  for (const item of layout) {
    itemMap.set(item.i, item);
  }

  function handleLayoutChange(currentLayout: Layout) {
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

  // When not editable, mark all layout items as static to prevent resize
  const effectiveLayout = layout.map((item) => ({ ...item, static: !isEditable }));

  return (
    <div ref={containerRef}>
      {width > 0 && (
        <ResponsiveGridLayout
          width={width}
          layouts={{ lg: effectiveLayout }}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          rowHeight={80}
          margin={[16, 16]}
          compactor={verticalCompactor}
          dragConfig={{ enabled: isEditable, bounded: false, handle: '.widget-drag-handle' }}
          onLayoutChange={handleLayoutChange}
        >
          {layout.map((item) => (
            <div key={item.i}>
              <WidgetCard
                widgetId={item.i}
                widgetType={item.type}
                onRemove={() => onRemoveWidget(item.i)}
                isEditable={isEditable}
              />
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
