import { describe, expect, it } from 'vitest';
import {
  ACTION_STYLE,
  EVENT_STYLE,
  type EventStyle,
  isActionableKind,
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

  it('Ledger: only mention, review, assignment, failure and due are actionable', () => {
    const actionable = new Set(all.filter((s) => isActionableKind(s.kind)).map((s) => s.kind));
    expect([...actionable].sort()).toEqual(['assignment', 'due', 'failure', 'mention', 'review']);
    for (const k of ['comment', 'update', 'multi', 'status', 'approval', 'milestone'] as const) {
      expect(isActionableKind(k), k).toBe(false);
    }
  });
});
