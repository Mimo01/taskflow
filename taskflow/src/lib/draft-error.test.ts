import { describe, expect, it } from 'vitest';
import { withDraftNote } from './draft-error';

describe('withDraftNote', () => {
  it('keeps the server message and appends the draft note', () => {
    expect(withDraftNote('Field customfield_1 is required.')).toBe(
      'Field customfield_1 is required. Your text is kept as a draft.',
    );
  });
  it('falls back to the generic text when there is no message', () => {
    expect(withDraftNote('')).toBe(
      "Couldn't save your changes. Your text is kept as a draft, try again.",
    );
  });
});
