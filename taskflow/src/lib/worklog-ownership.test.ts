import { describe, expect, it } from 'vitest';
import { isMeUsername, isOwnWorklog } from './worklog-ownership';

const me = { username: 'jdoe', userKey: 'JIRAUSER1' };

describe('isOwnWorklog', () => {
  it('matches on key', () => {
    expect(isOwnWorklog({ name: 'x', key: 'JIRAUSER1' }, me)).toBe(true);
  });
  it('matches on name ignoring case', () => {
    expect(isOwnWorklog({ name: 'JDoe' }, me)).toBe(true);
  });
  it('rejects a different author', () => {
    expect(isOwnWorklog({ name: 'alice', key: 'JIRAUSER2' }, me)).toBe(false);
  });
  it('fails closed with missing me data', () => {
    const none = { username: null, userKey: null };
    expect(isOwnWorklog({ name: 'jdoe', key: 'JIRAUSER1' }, none)).toBe(false);
  });
  it('rejects undefined author', () => {
    expect(isOwnWorklog(undefined, me)).toBe(false);
  });
  it('ignores displayName', () => {
    expect(isOwnWorklog({ name: 'alice', displayName: 'jdoe' } as never, me)).toBe(false);
  });
});

describe('isMeUsername', () => {
  it('matches ignoring case', () => {
    expect(isMeUsername('JDOE', { username: 'jdoe' })).toBe(true);
  });
  it('null username is not me', () => {
    expect(isMeUsername(null, { username: 'jdoe' })).toBe(false);
  });
  it('null me is not me', () => {
    expect(isMeUsername('jdoe', { username: null })).toBe(false);
  });
});
