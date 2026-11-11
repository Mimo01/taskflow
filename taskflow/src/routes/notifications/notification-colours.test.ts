import { describe, expect, it } from 'vitest';
import {
  ACTION_STYLE,
  EVENT_STYLE,
  type EventStyle,
  MULTI_UPDATE_STYLE,
  STATUS_STYLE,
  UPDATE_STYLE,
} from './notification-colours';

describe('notification event styles', () => {
  const all: EventStyle[] = [
    ...Object.values(EVENT_STYLE),
    ...Object.values(ACTION_STYLE),
    UPDATE_STYLE,
    MULTI_UPDATE_STYLE,
    STATUS_STYLE,
  ];

  it('Ledger: styles carry no halo (unread is a surface, not a coloured ring)', () => {
    for (const s of all) {
      expect(s as unknown as Record<string, unknown>, s.kind).not.toHaveProperty('halo');
      expect(s.text, s.kind).toMatch(/^text-/);
    }
  });

  it('every event style carries a real colour for its action phrase (no neutral carriers)', () => {
    for (const s of all) {
      expect(s.text, s.kind).not.toMatch(/text-(foreground|muted)/);
    }
  });
});
