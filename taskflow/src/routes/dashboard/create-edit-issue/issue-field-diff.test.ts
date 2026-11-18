import { describe, expect, it } from 'vitest';
import { labelsFixVersionsCreateFields, labelsFixVersionsEditFields } from './issue-field-diff';

const fv = (id: string) => ({ id, name: `v${id}` });

describe('labelsFixVersionsCreateFields', () => {
  it('returns {} when both empty', () => {
    expect(labelsFixVersionsCreateFields({ labels: [], fixVersions: [] }, 'Story')).toEqual({});
  });
  it('sends labels and fixVersions ids', () => {
    expect(
      labelsFixVersionsCreateFields({ labels: ['a'], fixVersions: [fv('1')] }, 'Story'),
    ).toEqual({ labels: ['a'], fixVersions: [{ id: '1' }] });
  });
  it('never sends fixVersions for Subtask', () => {
    expect(
      labelsFixVersionsCreateFields({ labels: ['a'], fixVersions: [fv('1')] }, 'Subtask'),
    ).toEqual({ labels: ['a'] });
  });
});

describe('labelsFixVersionsEditFields', () => {
  it('is order-insensitive for labels', () => {
    expect(
      labelsFixVersionsEditFields(
        { labels: ['a', 'b'], fixVersions: [] },
        { labels: ['b', 'a'], fixVersions: [] },
      ),
    ).toEqual({});
  });
  it('sends labels when changed', () => {
    expect(
      labelsFixVersionsEditFields({ labels: ['a'], fixVersions: [] }, { labels: ['a', 'b'] }),
    ).toEqual({ labels: ['a'] });
  });
  it('never sends when initial is absent', () => {
    expect(labelsFixVersionsEditFields({ labels: [], fixVersions: [] }, {})).toEqual({});
  });
  it('sends fixVersions when the id set changed', () => {
    expect(
      labelsFixVersionsEditFields(
        { labels: [], fixVersions: [fv('1'), fv('2')] },
        { fixVersions: [fv('1')] },
      ),
    ).toEqual({ fixVersions: [{ id: '1' }, { id: '2' }] });
  });
  it('sends [] when all removed', () => {
    expect(
      labelsFixVersionsEditFields({ labels: [], fixVersions: [] }, { fixVersions: [fv('1')] }),
    ).toEqual({ fixVersions: [] });
  });
});
