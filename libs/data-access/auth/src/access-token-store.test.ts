import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAccessToken, getAccessToken, setAccessToken } from './access-token-store';

describe('accessTokenStore', () => {
  afterEach(() => clearAccessToken());

  it('returns null when no token has been set', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('returns the token after it has been set', () => {
    setAccessToken('access_abc123');
    expect(getAccessToken()).toBe('access_abc123');
  });

  it('returns null after the token has been cleared', () => {
    setAccessToken('access_abc123');
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  it('never touches localStorage or sessionStorage', () => {
    const localSetSpy = vi.spyOn(Storage.prototype, 'setItem');

    setAccessToken('access_abc123');
    getAccessToken();
    clearAccessToken();

    expect(localSetSpy).not.toHaveBeenCalled();
    localSetSpy.mockRestore();
  });
});
