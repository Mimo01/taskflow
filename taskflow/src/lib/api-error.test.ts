import { describe, it, expect } from 'vitest';
import { ApiError, isAuthError, getErrorSource } from './api-error';

describe('ApiError', () => {
  it('extends Error with name ApiError', () => {
    const err = new ApiError('msg', 401, 'jira');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
  });

  it('stores status and source fields', () => {
    const err = new ApiError('msg', 401, 'jira');
    expect(err.status).toBe(401);
    expect(err.source).toBe('jira');
    expect(err.message).toBe('msg');
  });
});

describe('isAuthError', () => {
  it('returns true for ApiError with status 401', () => {
    expect(isAuthError(new ApiError('x', 401, 'jira'))).toBe(true);
  });

  it('returns true for ApiError with status 403', () => {
    expect(isAuthError(new ApiError('x', 403, 'gitlab'))).toBe(true);
  });

  it('returns false for ApiError with status 500', () => {
    expect(isAuthError(new ApiError('x', 500, 'jira'))).toBe(false);
  });

  it('returns true for raw Response-like object with status 401', () => {
    expect(isAuthError({ status: 401 })).toBe(true);
  });

  it('returns true for Error with status code in message', () => {
    expect(isAuthError(new Error('status 401'))).toBe(true);
  });

  it('returns true for Error with token expired message', () => {
    expect(isAuthError(new Error('token has expired'))).toBe(true);
  });

  it('returns false for unrelated Error', () => {
    expect(isAuthError(new Error('something else'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isAuthError(null)).toBe(false);
  });
});

describe('getErrorSource', () => {
  it('returns source from ApiError', () => {
    expect(getErrorSource(new ApiError('x', 401, 'gitlab'))).toBe('gitlab');
  });

  it('returns null for plain Error', () => {
    expect(getErrorSource(new Error('x'))).toBeNull();
  });
});
