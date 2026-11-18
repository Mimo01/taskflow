import { describe, expect, it } from 'vitest';
import { MIN_MAIN_CONTENT_WIDTH, shouldAutoRailSidebar } from './sidebar-layout';

describe('shouldAutoRailSidebar', () => {
  it('keeps the sidebar expanded when main keeps >= 720px', () => {
    expect(shouldAutoRailSidebar({ viewportWidth: 1100, sidebarWidth: 224, peekWidth: 0 })).toBe(
      false,
    );
  });
  it('rails when peek open leaves too little room', () => {
    expect(shouldAutoRailSidebar({ viewportWidth: 1100, sidebarWidth: 224, peekWidth: 480 })).toBe(
      true,
    );
  });
  it('rails at 900px without peek', () => {
    expect(shouldAutoRailSidebar({ viewportWidth: 900, sidebarWidth: 224, peekWidth: 0 })).toBe(
      true,
    );
  });
  it('boundary of exactly 720 does not rail', () => {
    expect(
      shouldAutoRailSidebar({
        viewportWidth: MIN_MAIN_CONTENT_WIDTH + 224 + 100,
        sidebarWidth: 224,
        peekWidth: 100,
      }),
    ).toBe(false);
  });
  it('wide window with max sidebar and min peek does not rail', () => {
    expect(shouldAutoRailSidebar({ viewportWidth: 1440, sidebarWidth: 320, peekWidth: 360 })).toBe(
      false,
    );
  });
});
