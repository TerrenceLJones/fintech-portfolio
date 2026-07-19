/**
 * Client-side avatar validation (US-CW-034 AC-05/AC-06). Every rule is checked BEFORE any upload is
 * attempted — an oversized or wrong-type file never leaves the browser. Dimensions are checked once
 * the image has decoded; type and size are known from the File alone, so they gate first.
 */

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MIN_DIMENSION = 256;
export const AVATAR_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AvatarRejectReason = 'wrong_type' | 'too_large' | 'too_small';

export interface AvatarValidationInput {
  type: string;
  size: number;
  /** Pixel dimensions, once decoded. Omit to validate type + size only (the pre-decode gate). */
  width?: number;
  height?: number;
}

/** The user-facing message for each rejection, phrased exactly as the design and AC require. */
export const AVATAR_REJECT_MESSAGE: Record<AvatarRejectReason, string> = {
  wrong_type: 'Unsupported file type. Use a JPG, PNG, or WebP image.',
  too_large: 'This file is too large. Maximum size is 5 MB.',
  too_small: `Image is too small. Use one at least ${AVATAR_MIN_DIMENSION}×${AVATAR_MIN_DIMENSION}px.`,
};

/**
 * The first failing rule, or null when the file is acceptable. Order matters: type, then size, then
 * dimension — so a valid-type file over 5 MB reports the size message the AC-06 flow expects, and
 * dimension is only judged once width/height are supplied.
 */
export function validateAvatarFile(input: AvatarValidationInput): AvatarRejectReason | null {
  if (!(AVATAR_ALLOWED_MIME as readonly string[]).includes(input.type)) {
    return 'wrong_type';
  }
  if (input.size > AVATAR_MAX_BYTES) {
    return 'too_large';
  }
  if (
    input.width !== undefined &&
    input.height !== undefined &&
    (input.width < AVATAR_MIN_DIMENSION || input.height < AVATAR_MIN_DIMENSION)
  ) {
    return 'too_small';
  }
  return null;
}
