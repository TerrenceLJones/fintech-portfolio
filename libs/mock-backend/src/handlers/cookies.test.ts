import { describe, expect, it } from 'vitest';
import { parseCookie } from './cookies';

describe('parseCookie', () => {
  it('returns the value for a matching cookie among several', () => {
    expect(parseCookie('foo=bar; refreshToken=abc123; other=xyz', 'refreshToken')).toBe('abc123');
  });

  it('returns undefined when the header is null', () => {
    expect(parseCookie(null, 'refreshToken')).toBeUndefined();
  });

  it('returns undefined when the named cookie is not present', () => {
    expect(parseCookie('foo=bar; other=xyz', 'refreshToken')).toBeUndefined();
  });

  it('handles a single cookie with no others', () => {
    expect(parseCookie('refreshToken=solo-value', 'refreshToken')).toBe('solo-value');
  });

  it('splits only on the first "=", preserving "=" characters within the value', () => {
    expect(parseCookie('refreshToken=abc=123==', 'refreshToken')).toBe('abc=123==');
  });

  it('trims whitespace around ";"-separated pairs', () => {
    expect(parseCookie('foo=bar;   refreshToken=abc123  ;other=xyz', 'refreshToken')).toBe(
      'abc123',
    );
  });

  it('returns undefined for an empty header string', () => {
    expect(parseCookie('', 'refreshToken')).toBeUndefined();
  });
});
