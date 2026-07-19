import { describe, expect, it } from 'vitest';
import { AVATAR_MAX_BYTES, validateAvatarFile } from './avatar-policy';

const OK_TYPE = 'image/png';

describe('validateAvatarFile (AC-05/AC-06)', () => {
  it('accepts a valid type, in-size, large-enough image', () => {
    expect(validateAvatarFile({ type: OK_TYPE, size: 1024, width: 512, height: 512 })).toBeNull();
  });

  it('rejects an unsupported MIME type before anything else', () => {
    expect(validateAvatarFile({ type: 'image/gif', size: 10, width: 512, height: 512 })).toBe(
      'wrong_type',
    );
  });

  it('rejects a file over 5 MB even when the type is valid (AC-06)', () => {
    expect(validateAvatarFile({ type: OK_TYPE, size: AVATAR_MAX_BYTES + 1 })).toBe('too_large');
  });

  it('accepts a file exactly at the 5 MB boundary', () => {
    expect(
      validateAvatarFile({ type: OK_TYPE, size: AVATAR_MAX_BYTES, width: 256, height: 256 }),
    ).toBeNull();
  });

  it('rejects an image below the 256px minimum once decoded (AC-05)', () => {
    expect(validateAvatarFile({ type: OK_TYPE, size: 1024, width: 200, height: 512 })).toBe(
      'too_small',
    );
  });

  it('skips the dimension check until width/height are supplied (pre-decode gate)', () => {
    expect(validateAvatarFile({ type: OK_TYPE, size: 1024 })).toBeNull();
  });
});
