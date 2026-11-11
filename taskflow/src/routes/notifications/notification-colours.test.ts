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

  it('every unread halo is a static ring class in the same colour as its verb (261111-h9a)', () => {
    for (const s of all) {
      expect(s.halo, s.kind).toBe(s.text.replace(/text-/g, 'ring-'));
    }
  });
});
